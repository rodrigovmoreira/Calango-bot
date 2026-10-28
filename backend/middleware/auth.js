import jwt from 'jsonwebtoken';
import SystemUser from '../models/SystemUser.js';
import BusinessConfig from '../models/BusinessConfig.js';
import { activeMemberships } from '../utils/membership.js';

// Slug desta aplicação no ecossistema (usado para validar o token SSO).
const APP_SLUG = 'calango-bot';

// ============================================================================
// authenticateToken — valida o token JWT emitido pelo Squamata-Login (SSO).
// O payload esperado é: { uid, email, appSlug, tenantId, iat, exp }.
// Usuários novos (primeiro acesso via SSO) são provisionados automaticamente.
// ============================================================================
export const authenticateToken = async (req, res, next) => {
  const token = req.cookies?.auth_token || req.headers['authorization']?.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Token necessário' });

  try {
    // Valida o token com a chave compartilhada com o Squamata-Login.
    const decoded = jwt.verify(token, process.env.JWT_SECRET_LOGIN);

    // Garante que o token é destinado a esta aplicação.
    if (decoded.appSlug && decoded.appSlug !== APP_SLUG) {
      console.warn(`⛔ [auth] Token com appSlug inválido: ${decoded.appSlug}`);
      return res.status(403).json({ message: 'Token não autorizado para esta aplicação' });
    }

    // UPSERT: encontra ou provisiona o SystemUser local a partir do SSO.
    let user = await SystemUser.findOne({ email: decoded.email });
    const isFirstLogin = !user;

    if (!user) {
      user = await SystemUser.create({
        name: decoded.email.split('@')[0],
        email: decoded.email,
        password: 'sso_placeholder_do_not_use',
        isVerified: true,
        isActive: true
      });
      console.log(`🆕 [auth] SystemUser criado via SSO: ${decoded.email} (appSlug=${decoded.appSlug})`);
    }

    // === Resolução do negócio ativo ===
    // Só vínculos ATIVOS contam: inativar o vínculo (offboarding) tira o acesso
    // sem apagar o histórico (ADR 004).
    const vinculosAtivos = activeMemberships(user);

    if (vinculosAtivos.length === 0) {
      // Provisiona um negócio APENAS no primeiro acesso (onboarding SSO).
      // Usuário que já existia e ficou sem vínculo ativo foi removido por
      // offboarding: recriar aqui desfaria a revogação de acesso.
      if (!isFirstLogin) {
        console.warn(`⛔ [auth] ${decoded.email} sem vínculo ativo — acesso negado`);
        return res.status(403).json({
          code: 'NO_ACTIVE_BUSINESS',
          message: 'Sua conta não está vinculada a nenhum negócio. Contate o administrador.'
        });
      }

      // Primeiro acesso: cria um BusinessConfig padrão e vincula como admin.
      // NÃO definir phoneNumber aqui: o índice é unique e o número só existe
      // quando o usuário conecta um WhatsApp de verdade. Um placeholder fixo
      // ('5511999999999') fazia o 2º usuário SSO falhar com E11000, derrubando
      // toda requisição autenticada.
      const businessConfig = await BusinessConfig.create({
        businessName: `Empresa de ${decoded.email}`,
        prompts: { chatSystem: 'Você é um assistente virtual.', visionSystem: '' }
      });
      user.businesses.push({ businessId: businessConfig._id, role: 'admin' });
      user.activeBusinessId = businessConfig._id;
      await user.save();
      vinculosAtivos.push(user.businesses[user.businesses.length - 1]);
      console.log(`🏢 [auth] BusinessConfig criado via SSO para: ${decoded.email}`);
    }

    // === 6.2 — contexto revogado ===
    // O activeBusinessId precisa pertencer a um vínculo ATIVO. Se não pertencer
    // (o vínculo foi inativado), não deixamos a requisição seguir com o contexto
    // antigo: trocamos para o primeiro vínculo válido. Isso corta o acesso sem
    // trancar o usuário fora do sistema (o 403 puro impediria até o switch).
    const activeId = user.activeBusinessId ? String(user.activeBusinessId) : null;
    const activePertence = activeId
      ? vinculosAtivos.some((b) => String(b.businessId) === activeId)
      : false;

    if (!activePertence) {
      const novoContexto = vinculosAtivos[0].businessId;
      console.warn(
        `⚠️ [auth] ${decoded.email}: contexto ${activeId ?? '(vazio)'} sem vínculo ativo → trocado para ${novoContexto}`
      );
      user.activeBusinessId = novoContexto;
      await user.save();
    }

    // Determina o role do usuário no negócio ativo.
    let role = 'operator';
    const businessInfo = vinculosAtivos.find(
      (b) => b.businessId.toString() === user.activeBusinessId.toString()
    );
    if (businessInfo) role = businessInfo.role;

    req.user = {
      userId: user._id,
      email: decoded.email,
      activeBusinessId: user.activeBusinessId,
      role,
      squamataUid: decoded.uid
    };
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expirado. Faça login novamente.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(403).json({ message: 'Token inválido' });
    }
    console.error('Erro no authenticateToken:', err);
    res.status(500).json({ message: 'Erro interno de autenticação' });
  }
};

export const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.activeBusinessId) {
      return res.status(403).json({ message: 'Nenhum negócio ativo' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Acesso negado: Requer permissão de administrador' });
    }

    next();
  } catch (error) {
    console.error('Erro no requireAdmin:', error);
    res.status(500).json({ message: 'Erro ao verificar permissões' });
  }
};

export default authenticateToken;
