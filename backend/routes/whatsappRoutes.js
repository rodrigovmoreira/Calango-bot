import express from 'express';
const router = express.Router();
import authenticateToken from '../middleware/auth.js';
import { connect, disconnect, getStatus, removeSession } from '../services/whatsapp/client.js';
import * as whatsappController from '../controllers/whatsappController.js';

// ROTA: GET /api/v1/whatsapp/status
// Degrada em vez de falhar: serviço fora do ar aparece como desconectado
// (requisito 5 da 11.1 do PLANEJAMENTO.md).
router.get('/status', authenticateToken, async (req, res) => {
  const status = await getStatus(req.user.activeBusinessId);
  res.json({ isConnected: status.isConnected, mode: status.mode, phone: status.phone || null });
});

// ROTA: POST /api/v1/whatsapp/start
// Cria a sessão no serviço no primeiro uso (D13) e inicia o pareamento.
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const businessId = req.user.activeBusinessId;
    console.log(`▶️ Iniciando sessão para: ${businessId}`);
    const session = await connect(businessId);
    res.json({ message: 'Inicializando sessão...', status: session?.status || 'initializing' });
  } catch (error) {
    console.error('💥 Erro ao iniciar sessão no squamata-whatsapp:', error.code || error.message);
    res.status(502).json({ message: 'Não foi possível falar com o serviço de WhatsApp.' });
  }
});

// ROTA: POST /api/v1/whatsapp/logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    await disconnect(req.user.activeBusinessId);
    res.json({ message: 'Desconectado com sucesso' });
  } catch (error) {
    console.error('💥 Erro ao desconectar no squamata-whatsapp:', error.code || error.message);
    res.status(502).json({ message: 'Erro ao desconectar' });
  }
});

// ROTA: DELETE /api/v1/whatsapp/session
// Remove a sessão e o pareamento: o próximo connect pede QR novo.
router.delete('/session', authenticateToken, async (req, res) => {
  try {
    await removeSession(req.user.activeBusinessId);
    res.json({ message: 'Sessão removida. Conecte novamente para parear.' });
  } catch (error) {
    console.error('💥 Erro ao remover sessão no squamata-whatsapp:', error.code || error.message);
    res.status(502).json({ message: 'Erro ao remover a sessão' });
  }
});

// ROTA: POST /api/v1/whatsapp/import-labels
// Pendente da F6 (labels via app state); mantida para o painel não quebrar.
router.post('/import-labels', authenticateToken, whatsappController.importLabels);

export default router;
