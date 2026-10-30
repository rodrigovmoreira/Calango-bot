import express from 'express';
import { verifySignature, handleSquamataEvent } from '../services/whatsapp/inbound.js';

const router = express.Router();

// Corpo BRUTO: a assinatura é calculada byte a byte, então este router é
// montado antes do express.json() global (ver server.js). O limite de 12 MB
// vale só para esta rota — é o teto de mídia do payload (D1).
router.post('/', express.raw({ type: 'application/json', limit: '12mb' }), async (req, res) => {
    const secret = process.env.SQUAMATA_WEBHOOK_SECRET;
    if (!secret) {
        console.error('❌ [squamata] SQUAMATA_WEBHOOK_SECRET não definido: webhook recusado.');
        return res.status(500).json({ error: 'webhook não configurado' });
    }

    const rawBody = req.body;
    if (!verifySignature(rawBody, req.get('X-Signature'), secret)) {
        console.warn('🚫 [squamata] assinatura inválida no webhook — requisição descartada.');
        return res.status(401).json({ error: 'assinatura inválida' });
    }

    let payload;
    try {
        payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
        return res.status(400).json({ error: 'JSON inválido' });
    }

    // 202 imediato: o serviço Go não pode ficar esperando o processamento
    // (buffer de 11 s + IA). Falha nossa não derruba a sessão dele.
    res.status(202).json({ received: true });

    try {
        await handleSquamataEvent(payload, req.app.get('io'));
    } catch (error) {
        console.error('💥 [squamata] erro ao processar evento:', error);
    }
});

export default router;
