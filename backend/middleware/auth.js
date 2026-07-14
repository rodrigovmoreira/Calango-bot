import jwt from 'jsonwebtoken';
import SystemUser from '../models/SystemUser.js';
import BusinessConfig from '../models/BusinessConfig.js';

export const authenticateToken = async (req, res, next) => {
  const token = req.cookies.auth_token || req.headers['authorization']?.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: 'Token necessário' });

  try {
    // 1. Tentar validar com JWT_SECRET_LOGIN (Squamata SSO)
    const secretLogin = process.env.JWT_SECRET_LOGIN;
    let decoded = null;
    let isSquamataToken = false;

    try {
      decoded = jwt.verify(token, secretLogin);
      isSquamataToken = !!decoded.uid;
    } catch (squamataErr) {
      // Se falhar, tentar com o segredo legado do Calango-Bot
      const secretLegacy = process.env.JWT_SECRET;
      decoded = jwt.verify(token, secretLegacy);
    }

    // ─── FLUXO SQUAMATA (NOVO) ──────────────────
    if (isSquamataToken) {
      if (decoded.appSlug && decoded.appSlug !== 'calango-bot') {
        return res.status(403).json({ message: 'Token não autorizado para esta aplicação' });
      }

      let user = await SystemUser.findOne({ email: decoded.email });

      if (!user) {
        user = await SystemUser.create({
          name: decoded.email.split('@')[0],
          email: decoded.email,
          password: 'sso_placeholder_do_not_use',
          isVerified: true,
          isActive: true
        });
        console.log(`🆕 SystemUser criado via SSO: ${decoded.email}`);
      }

      if (user.businesses && user.businesses.length > 0) {
        if (!user.activeBusinessId) {
          user.activeBusinessId = user.businesses[0].businessId;
          await user.save();
        }
      } else {
        const businessConfig = await BusinessConfig.create({
          businessName: `Empresa de ${decoded.email}`,
          phoneNumber: '5511999999999',
          prompts: { chatSystem: 'Você é um assistente virtual.', visionSystem: '' }
        });
        user.businesses.push({ businessId: businessConfig._id, role: 'admin' });
        user.activeBusinessId = businessConfig._id;
        await user.save();
        console.log(`🏢 BusinessConfig criado via SSO para: ${decoded.email}`);
      }

      if (!user.activeBusinessId) {
        return res.status(400).json({ message: 'Nenhum negócio configurado. Contate o suporte.' });
      }

      let role = 'operator';
      const businessInfo = user.businesses.find(b =>
        b.businessId.toString() === user.activeBusinessId.toString()
      );
      if (businessInfo) role = businessInfo.role;

      req.user = {
        userId: user._id,
        email: decoded.email,
        activeBusinessId: user.activeBusinessId,
        role: role,
        squamataUid: decoded.uid
      };
      return next();
    }

    // ─── FLUXO LEGADO (CALANGO-BOT ORIGINAL) ─────
    if (decoded.activeBusinessId && decoded.role) {
      req.user = {
        userId: decoded.userId,
        activeBusinessId: decoded.activeBusinessId,
        role: decoded.role
      };
      return next();
    }

    const user = await SystemUser.findById(decoded.userId).select('activeBusinessId businesses');
    if (!user) return res.status(401).json({ message: 'Usuário não encontrado' });

    let role = 'operator';
    if (user.activeBusinessId && user.businesses) {
      const business = user.businesses.find(b =>
        b.businessId.toString() === user.activeBusinessId.toString()
      );
      if (business) role = business.role;
    }

    req.user = {
      userId: decoded.userId,
      activeBusinessId: user.activeBusinessId,
      role: role
    };
    next();

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