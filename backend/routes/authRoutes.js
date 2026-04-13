import express from 'express';
const router = express.Router();
import jwt from 'jsonwebtoken';
import passport from 'passport';
import crypto from 'crypto';
import SystemUser from '../models/SystemUser.js';
import BusinessConfig from '../models/BusinessConfig.js';
import authenticateToken from '../middleware/auth.js';
import { stopSession } from '../services/wwebjsService.js';
import { sendVerificationEmail } from '../services/emailService.js';
import { loginLimiter, registerLimiter } from '../middleware/rateLimiters.js';

// ROTA: /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await SystemUser.findOne({ email }).select('+password');

    if (!user || !(await user.correctPassword(password))) {
      return res.status(400).json({ message: 'Credenciais inválidas' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    res.json({ token, user: { id: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl } });
  } catch (error) {
    console.error('Erro login:', error);
    res.status(500).json({ message: 'Erro interno' });
  }
});

// ROTA: /api/auth/register
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { name, email, password, company } = req.body;
    if (await SystemUser.findOne({ email })) return res.status(400).json({ message: 'Email existe' });

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // User is created with isVerified: false by default (from model)
    const user = await SystemUser.create({
      name,
      email,
      password,
      company: company || 'Meu Negócio',
      verificationToken
    });

    // Send Verification Email
    try {
      sendVerificationEmail(email, verificationToken)
        .catch(err => console.error('Warning: Failed to send email, but user created.', err.message));
    } catch (error) {
      console.error('Warning: Failed to initiate email sending.', error.message);
    }

    // Cria a configuração inicial padrão
    await BusinessConfig.create({
      userId: user._id,
      businessName: company || 'Novo Negócio',
      prompts: {
        chatSystem: "Você é um assistente virtual útil.",
        visionSystem: "Descreva o que vê."
      }
    });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.cookie('auth_token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } });
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
  (req, res) => {
    // Successful authentication
    const user = req.user;
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

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
    const userData = encodeURIComponent(JSON.stringify({ id: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl }));

    res.redirect(`${frontendUrl}/google-callback?token=${token}&user=${userData}`);
  }
);

// ROTA: /api/auth/logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Encerra sessão do WhatsApp para economizar recursos
    await stopSession(userId);

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
      await BusinessConfig.findOneAndUpdate({ userId: user._id }, { avatarUrl });
    }

    await user.save();

    res.json({
      message: 'Perfil atualizado com sucesso',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        company: user.company,
        avatarUrl: user.avatarUrl
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    res.status(500).json({ message: 'Erro ao atualizar perfil' });
  }
});

export default router;