import express from 'express';
const router = express.Router();
import authenticateToken from '../middleware/auth.js';
import { 
  startSession, 
  stopSession, 
  getSessionStatus 
} from '../services/wwebjsService.js';
import * as whatsappController from '../controllers/whatsappController.js';

// ROTA: GET /api/whatsapp/status
router.get('/status', authenticateToken, (req, res) => {
  const status = getSessionStatus(req.user.userId);
  const isConnected = (status === 'ready' || status === 'authenticated');
  res.json({ isConnected, mode: status || 'disconnected' });
});

// ROTA: POST /api/whatsapp/start
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log(`▶️ Iniciando sessão manual para: ${userId}`);
    await startSession(userId);
    res.json({ message: 'Inicializando sessão...' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao iniciar sessão' });
  }
});

// ROTA: POST /api/whatsapp/logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    await stopSession(req.user.userId);
    res.json({ message: 'Desconectado com sucesso' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao desconectar' });
  }
});

// ROTA: POST /api/whatsapp/import-labels
router.post('/import-labels', authenticateToken, whatsappController.importLabels);

export default router;