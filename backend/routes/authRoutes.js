import express from 'express';
const router = express.Router();
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import SystemUser from '../models/SystemUser.js';
import BusinessConfig from '../models/BusinessConfig.js';
import Invite from '../models/Invite.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { stopSession } from '../services/wwebjsService.js';

// URL do Squamata-Login (portal central de autenticação / Identity Provider).
const LOGIN_URL = process.env.FRONTEND_LOGIN_URL || 'http://localhost:5174';
const APP_SLUG = 'calango-bot';

// ============================================================================
// Helpers
// ============================================================================

// Formata a lista de negócios do usuário para o payload de resposta.
const formatBusinesses = (user) =>
  user.businesses.map((b) => ({
    businessId: {
      _id: b.businessId?._id ? b.businessId._id.toString() : b.businessId?.toString(),
      businessName: b.businessId?.businessName || 'Empresa'
    },
    role: b.role || 'operator'
  }));

// Descobre o role do usuário no negócio ativo.
const resolveActiveRole = (user) => {
  let role = 'operator';
  if (user.activeBusinessId && user.businesses) {
    const info = user.businesses.find((b) => {
      const bId = b.businessId?._id ? b.businessId._id.toString() : b.businessId?.toString();
      return bId === user.activeBusinessId.toString();
    });
    if (info) role = info.role;
  }
  return role;
};

// ============================================================================
// Rotas DESATIVADAS (Checkpoint 3 — SSO) → retornam 410 Gone
// ============================================================================

// O login local foi substituído pelo fluxo SSO do Squamata-Login.
router.post('/login', (req, res) => {
  res.status(410).json({
    message: 'Login local desativado. Use o portal central de autenticação.',
    redirectUrl: `${LOGIN_URL}/login?appSlug=${APP_SLUG}`
  });
});

// O registro local foi substituído pelo fluxo SSO do Squamata-Login.
router.post('/register', (req, res) => {
  res.status(410).json({
    message: 'Registro local desativado. Use o portal central de autenticação.',
    redirectUrl: `${LOGIN_URL}/login?appSlug=${APP_SLUG}`
  });
});

// A verificação de e-mail é gerenciada pelo portal central.
router.post('/verify-email', (req, res) => {
  res.status(410).json({
    message: 'Verificação de e-mail gerenciada pelo portal central de autenticação.',
    redirectUrl: `${LOGIN_URL}/login?appSlug=${APP_SLUG}`
  });
});

// Google OAuth é delegado ao Squamata-Login (não há mais Passport local).
router.get('/google', (req, res) => {
  res.redirect(`${LOGIN_URL}/login?appSlug=${APP_SLUG}`);
});

router.get('/google/callback', (req, res) => {
  res.redirect(`${LOGIN_URL}/login?appSlug=${APP_SLUG}`);
});

// ============================================================================
// Rotas ATIVAS
// ============================================================================

// ROTA: /api/auth/switch-business — troca de contexto multi-tenant (CRM-specific)
router.post('/switch-business', authenticateToken, async (req, res) => {
  try {
    const { targetBusinessId } = req.body;
    const userId = req.user.userId;

    const user = await SystemUser.findById(userId);
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    // Verifica se o negócio alvo pertence ao usuário (isolamento multi-tenant)
    const targetBusiness = user.businesses.find((b) => b.businessId.toString() === targetBusinessId);
    if (!targetBusiness) {
      return res.status(403).json({ message: 'Acesso negado a esta empresa' });
    }

    user.activeBusinessId = targetBusinessId;
    await user.save();
    await user.populate('businesses.businessId', 'businessName');

    const token = jwt.sign(
      {
        userId: user._id,
        activeBusinessId: user.activeBusinessId,
        role: targetBusiness.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        activeBusinessId: user.activeBusinessId,
        businesses: formatBusinesses(user)
      }
    });
  } catch (error) {
    console.error('Erro ao trocar de empresa:', error);
    res.status(500).json({ message: 'Erro interno ao trocar de empresa' });
  }
});

// ROTA: /api/auth/logout — encerra a sessão do WhatsApp e limpa o cookie
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Encerra sessão do WhatsApp para economizar recursos
    await stopSession(req.user.activeBusinessId);

    res.clearCookie('auth_token');
    res.json({ message: 'Logout realizado e bot desligado.' });
  } catch (error) {
    console.error('Erro no logout:', error);
    res.clearCookie('auth_token');
    res.json({ message: 'Logout realizado (erro ao fechar bot).' });
  }
});

// ROTA: /api/auth/update — atualização de perfil (nome, avatar)
router.put('/update', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, avatarUrl } = req.body;

    const user = await SystemUser.findById(userId);
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    if (name) user.name = name;
    if (avatarUrl !== undefined) {
      user.avatarUrl = avatarUrl;
      // Sync with BusinessConfig
      if (user.activeBusinessId) {
        await BusinessConfig.findByIdAndUpdate(user.activeBusinessId, { avatarUrl });
      }
    }

    await user.save();

    res.json({
      message: 'Perfil atualizado com sucesso',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    res.status(500).json({ message: 'Erro ao atualizar perfil' });
  }
});

// ROTA: /api/auth/invites — convites de equipe (CRM-specific)
router.post('/invites', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!role || !['admin', 'operator', 'campaign_manager'].includes(role)) {
      return res.status(400).json({ message: 'Role inválida' });
    }

    const user = await SystemUser.findById(req.user.userId);
    if (!user || !user.activeBusinessId) {
      return res.status(403).json({ message: 'Negócio ativo não encontrado' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const invite = new Invite({
      token,
      businessId: user.activeBusinessId,
      role,
      expiresAt
    });

    await invite.save();

    res.status(201).json({ token, invite });
  } catch (error) {
    console.error('Erro ao gerar convite:', error);
    res.status(500).json({ message: 'Erro ao gerar convite' });
  }
});

// ROTA: /api/auth/invites/:token — validação pública de convite
router.get('/invites/:token', async (req, res) => {
  try {
    const invite = await Invite.findOne({ token: req.params.token, status: 'pending' })
      .populate('businessId', 'businessName avatarUrl');

    if (!invite || invite.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Convite inválido ou expirado.' });
    }

    res.json({ invite });
  } catch (error) {
    console.error('Erro ao buscar convite:', error);
    res.status(500).json({ message: 'Erro ao buscar convite' });
  }
});

// ROTA: /api/auth/accept-invite — NOVO (Checkpoint 3 — SSO)
// O usuário autenticado via SSO aceita um convite, vinculando-se ao negócio convidado.
router.post('/accept-invite', authenticateToken, async (req, res) => {
  try {
    const { inviteToken } = req.body;
    if (!inviteToken) return res.status(400).json({ message: 'Token de convite é obrigatório' });

    const invite = await Invite.findOne({ token: inviteToken, status: 'pending' });
    if (!invite || invite.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Convite inválido ou expirado.' });
    }

    const user = await SystemUser.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    // Idempotência: se o usuário já pertence ao negócio, apenas ativa o contexto.
    const alreadyInBusiness = user.businesses.some(
      (b) => b.businessId.toString() === invite.businessId.toString()
    );

    if (!alreadyInBusiness) {
      user.businesses.push({ businessId: invite.businessId, role: invite.role });
    }
    user.activeBusinessId = invite.businessId;
    await user.save();

    // Marca o convite como usado
    invite.status = 'used';
    await invite.save();

    await user.populate('businesses.businessId', 'businessName');

    // Emite novo token no contexto do negócio convidado
    const token = jwt.sign(
      {
        userId: user._id,
        activeBusinessId: user.activeBusinessId,
        role: invite.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    res.json({
      message: 'Convite aceito com sucesso!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        activeBusinessId: user.activeBusinessId,
        businesses: formatBusinesses(user)
      }
    });
  } catch (error) {
    console.error('Erro ao aceitar convite:', error);
    res.status(500).json({ message: 'Erro ao aceitar convite' });
  }
});

// ROTA: /api/auth/profile — dados do usuário logado (Checkpoint 1 — SSO)
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await SystemUser.findById(req.user.userId)
      .populate('businesses.businessId', 'businessName');

    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      activeBusinessId: user.activeBusinessId,
      businesses: user.businesses,
      role: req.user.role
    });
  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    res.status(500).json({ message: 'Erro ao buscar perfil' });
  }
});

export default router;
