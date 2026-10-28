import jwt from 'jsonwebtoken';
import SystemUser from '../models/SystemUser.js';
import BusinessConfig from '../models/BusinessConfig.js';

// Slug desta aplicação no ecossistema (usado para validar o token SSO).
const APP_SLUG = 'calango-bot';

// ============================================================================
// authenticateToken — valida o token JWT emitido pelo Squamata-Login (SSO).
// O payload esperado é: { uid, email, appSlug, tenantId, iat, exp }.
// Usuários novos (primeiro acesso via SSO) são provisionados automaticamente.
// ============================================================================
export const authenticateToken = async (req, res, next) => {
  const token = req.cookies.auth_token || req.headers['authorization']?.split(' ')[1];

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

    // Resolve o negócio ativo do usuário.
    if (user.businesses && user.businesses.length > 0) {
      if (!user.activeBusinessId) {
        user.activeBusinessId = user.businesses[0].businessId;
        await user.save();
      }
    } else {
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
      console.log(`🏢 [auth] BusinessConfig criado via SSO para: ${decoded.email}`);
    }

    if (!user.activeBusinessId) {
      return res.status(400).json({ message: 'Nenhum negócio configurado. Contate o suporte.' });
    }

    // Determina o role do usuário no negócio ativo.
    let role = 'operator';
    const businessInfo = user.businesses.find(
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
