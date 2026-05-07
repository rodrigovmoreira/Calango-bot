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
  const status = getSessionStatus(req.user.activeBusinessId);
  const isConnected = (status === 'ready' || status === 'authenticated');
  res.json({ isConnected, mode: status || 'disconnected' });
});

// ROTA: POST /api/whatsapp/start
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const businessId = req.user.activeBusinessId;
    console.log(`▶️ Iniciando sessão manual para: ${businessId}`);
    await startSession(businessId);
    res.json({ message: 'Inicializando sessão...' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao iniciar sessão' });
  }
});

// ROTA: POST /api/whatsapp/logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    await stopSession(req.user.activeBusinessId);
    res.json({ message: 'Desconectado com sucesso' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao desconectar' });
  }
});

// ROTA: POST /api/whatsapp/import-labels
router.post('/import-labels', authenticateToken, whatsappController.importLabels);

export default router;