import express from 'express';
const router = express.Router();
import jwt from 'jsonwebtoken';
import passport from 'passport';
import crypto from 'crypto';
import SystemUser from '../models/SystemUser.js';
import BusinessConfig from '../models/BusinessConfig.js';
import Invite from '../models/Invite.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { stopSession } from '../services/wwebjsService.js';
import { sendVerificationEmail } from '../services/emailService.js';
import { loginLimiter, registerLimiter } from '../middleware/rateLimiters.js';

// ROTA: /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password, inviteToken } = req.body;
    // Ponto 3.2: Populate businesses.businessId
    const user = await SystemUser.findOne({ email }).select('+password').populate('businesses.businessId', 'businessName');

    if (!user || !(await user.correctPassword(password))) {
      return res.status(400).json({ message: 'Credenciais inválidas' });
    }

    // Process Invite token on login if present
    if (inviteToken) {
      const invite = await Invite.findOne({ token: inviteToken, status: 'pending' });
      if (invite && invite.expiresAt > new Date()) {
        // Here we handle if the user is already in the business
        const alreadyInBusiness = user.businesses.some(b => {
          // Because of populate, b.businessId could be an object, let's safely get its string ID
          const bId = b.businessId._id ? b.businessId._id.toString() : b.businessId.toString();
          return bId === invite.businessId.toString();
        });

        if (!alreadyInBusiness) {
          user.businesses.push({ businessId: invite.businessId, role: invite.role });
        }
        user.activeBusinessId = invite.businessId; // Switch to the invited business
        await user.save();
        invite.status = 'used';
        await invite.save();

        // Re-populate because we just pushed a raw ID to businesses
        await user.populate('businesses.businessId', 'businessName');
      }
    }

    // Determine role for the active business
    let activeRole = 'operator';
    if (user.activeBusinessId && user.businesses) {
      const businessInfo = user.businesses.find(b => {
        const bId = b.businessId._id ? b.businessId._id.toString() : b.businessId.toString();
        return bId === user.activeBusinessId.toString();
      });
      if (businessInfo) activeRole = businessInfo.role;
    }

    // Ponto 3.1: Encode activeBusinessId and role in JWT
    const token = jwt.sign(
      {
        userId: user._id,
        activeBusinessId: user.activeBusinessId,
        role: activeRole
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

    res.json({ token, user: { id: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, activeBusinessId: user.activeBusinessId, businesses: user.businesses } });
  } catch (error) {
    console.error('Erro login:', error);
    res.status(500).json({ message: 'Erro interno' });
  }
});

// ROTA: /api/auth/register
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { name, email, password, company, inviteToken } = req.body;

    // Check if email exists
    if (await SystemUser.findOne({ email })) {
      if (inviteToken) {
        return res.status(409).json({ message: 'Email já existe. Por favor, faça login para aceitar o convite.', code: 'EMAIL_EXISTS_INVITE' });
      }
      return res.status(400).json({ message: 'Email já cadastrado.' });
    }

    let invite = null;
    if (inviteToken) {
      invite = await Invite.findOne({ token: inviteToken, status: 'pending' });
      if (!invite || invite.expiresAt < new Date()) {
        return res.status(400).json({ message: 'Convite inválido ou expirado.' });
      }
    }

    // Cria o usuário "limpo" (sem nome de empresa no perfil)
    const user = new SystemUser({
      name,
      email,
      password,
      verificationToken: crypto.randomBytes(32).toString('hex')
    });

    if (invite) {
      // CENÁRIO 1: USUÁRIO CONVIDADO (Não cria empresa, apenas herda o ID)
      user.businesses = [{ businessId: invite.businessId, role: invite.role }];
      user.activeBusinessId = invite.businessId;
      
      invite.status = 'used';
      await invite.save();
    } else {
      // CENÁRIO 2: USUÁRIO ADMIN NOVO (Cria a empresa)
      const newConfig = await BusinessConfig.create({
        businessName: company || 'Meu Negócio',
        prompts: {
          chatSystem: "Você é um assistente virtual útil.",
          visionSystem: "Descreva o que vê."
        }
      });
      user.businesses = [{ businessId: newConfig._id, role: 'admin' }];
      user.activeBusinessId = newConfig._id;
    }

    await user.save();

    // Send Verification Email
    try {
      sendVerificationEmail(email, user.verificationToken)
        .catch(err => console.error('Warning: Failed to send email, but user created.', err.message));
    } catch (error) {
      console.error('Warning: Failed to initiate email sending.', error.message);
    }

    // Determine role for the new/invited user
    let activeRole = 'operator';
    if (user.activeBusinessId && user.businesses) {
      const businessInfo = user.businesses.find(b => b.businessId.toString() === user.activeBusinessId.toString());
      if (businessInfo) activeRole = businessInfo.role;
    }

    // Ponto 3.1: Encode activeBusinessId and role in JWT
    const token = jwt.sign(
      {
        userId: user._id,
        activeBusinessId: user.activeBusinessId,
        role: activeRole
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.cookie('auth_token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    
    // Retorna os dados corretos pro frontend
    res.status(201).json({ 
      token, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        activeBusinessId: user.activeBusinessId, 
        businesses: user.businesses 
      } 
    });
  } catch (error) {
    console.error('Erro registro:', error);
    res.status(500).json({ message: 'Erro ao realizar cadastro.' });
  }
});

// ROTA: /api/auth/verify-email
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Token é obrigatório' });

    const user = await SystemUser.findOne({ verificationToken: token });
    if (!user) return res.status(400).json({ message: 'Token inválido ou expirado' });

    user.isVerified = true;
    user.verificationToken = undefined; // Clear token
    await user.save();

    res.json({ message: 'Email verificado com sucesso!' });
  } catch (error) {
    console.error('Erro verify-email:', error);
    res.status(500).json({ message: 'Erro ao verificar email' });
  }
});

// ROTA: /api/auth/google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// ROTA: /api/auth/google/callback
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  async (req, res) => {
    // Successful authentication
    try {
      // Ponto 3.2: Populate businesses.businessId
      const user = await SystemUser.findById(req.user._id).populate('businesses.businessId', 'businessName');

      let activeRole = 'operator';
      if (user.activeBusinessId && user.businesses) {
        const businessInfo = user.businesses.find(b => {
          const bId = b.businessId._id ? b.businessId._id.toString() : b.businessId.toString();
          return bId === user.activeBusinessId.toString();
        });
        if (businessInfo) activeRole = businessInfo.role;
      }

      // Ponto 3.1: Encode activeBusinessId and role in JWT
      const token = jwt.sign(
        {
          userId: user._id,
          activeBusinessId: user.activeBusinessId,
          role: activeRole
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Set cookie
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'lax'
      });

      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

      // We pass user info too, url encoded
      const userData = encodeURIComponent(JSON.stringify({
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        activeBusinessId: user.activeBusinessId,
        businesses: user.businesses
      }));

      res.redirect(`${frontendUrl}/google-callback?token=${token}&user=${userData}`);
    } catch (error) {
      console.error('Erro google callback:', error);
      res.redirect('/login');
    }
  }
);

// ROTA: /api/auth/switch-business
router.post('/switch-business', authenticateToken, async (req, res) => {
  try {
    const { targetBusinessId } = req.body;
    const userId = req.user.userId;

    // Fetch user without populate first to check and update
    const user = await SystemUser.findById(userId);
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    // Ponto 3.1: Verify if targetBusinessId exists in user's businesses array
    const targetBusiness = user.businesses.find(b => b.businessId.toString() === targetBusinessId);
    if (!targetBusiness) {
      return res.status(403).json({ message: 'Acesso negado a esta empresa' });
    }

    // Update active business
    user.activeBusinessId = targetBusinessId;
    await user.save();

    // Populate businesses.businessId for the response
    await user.populate('businesses.businessId', 'businessName');

    // Sign new JWT with new context
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
        businesses: user.businesses
      }
    });
  } catch (error) {
    console.error('Erro ao trocar de empresa:', error);
    res.status(500).json({ message: 'Erro interno ao trocar de empresa' });
  }
});

// ROTA: /api/auth/logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

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

// ROTA: /api/auth/update (Atualizar Perfil)
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


// ROTA: /api/auth/invites
router.post('/invites', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!role || !['admin', 'operator'].includes(role)) {
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

// ROTA: /api/auth/invites/:token (Público para validação)
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

export default router;