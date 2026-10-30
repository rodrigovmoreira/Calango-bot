import crypto from 'crypto';
import mongoose from 'mongoose';
import Contact from '../../models/Contact.js';
import Message from '../../models/Message.js';
import { adaptSquamataMessage } from '../providerAdapter.js';
import { handleIncomingMessage } from '../../messageHandler.js';
import { saveMessage } from '../message.js';
import { normalizePhone, canonicalWhatsAppId, whatsAppIdCandidates } from '../../utils/phoneUtils.js';

const SIGNATURE_PREFIX = 'sha256=';

/**
 * Valida o HMAC-SHA256 do webhook do squamata-whatsapp (PLANEJAMENTO.md §5).
 * A comparação é sobre o corpo BRUTO: qualquer reserialização invalida.
 *
 * @param {Buffer} rawBody
 * @param {string} signatureHeader valor de X-Signature ("sha256=<hex>")
 * @param {string} secret SQUAMATA_WEBHOOK_SECRET
 * @returns {boolean}
 */
function verifySignature(rawBody, signatureHeader, secret) {
    if (!rawBody || !signatureHeader || !secret) return false;
    if (!signatureHeader.startsWith(SIGNATURE_PREFIX)) return false;

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const received = signatureHeader.slice(SIGNATURE_PREFIX.length);

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const receivedBuffer = Buffer.from(received, 'utf8');
    if (expectedBuffer.length !== receivedBuffer.length) return false;

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

/**
 * Idempotência na ENTRADA (D8): se a mensagem já está no histórico, o reenvio
 * do outbox não pode rodar a IA de novo nem duplicar a conversa.
 */
async function alreadyProcessed(messageId) {
    if (!messageId) return false;
    return Boolean(await Message.exists({ waMessageId: messageId }));
}

function emit(io, tenantId, event, payload) {
    if (!io || !tenantId) return;
    io.to(tenantId).emit(event, payload);
}

/**
 * Eventos de sessão viram evento de socket para o painel.
 * Emitimos também os nomes antigos (`wwebjs_*`) como ponte: o painel atual
 * ainda escuta esses nomes e o driver antigo continua funcionando até a F8.
 */
function publishSessionEvent(io, payload) {
    switch (payload.event) {
        case 'session.status':
            emit(io, payload.tenantId, 'whatsapp_status', payload.status);
            emit(io, payload.tenantId, 'wwebjs_status', payload.status);
            break;
        case 'session.qr':
            emit(io, payload.tenantId, 'whatsapp_qr', payload.qr);
            emit(io, payload.tenantId, 'whatsapp_qr_image', payload.image);
            emit(io, payload.tenantId, 'wwebjs_qr', payload.qr);
            break;
        case 'session.auth_failure':
            console.error(`❌ [squamata] sessão ${payload.sessionId} do tenant ${payload.tenantId}: ${payload.message}`);
            emit(io, payload.tenantId, 'session_error', {
                message: payload.message || 'Falha na conexão do WhatsApp. Escaneie o QR code novamente.',
            });
            break;
        default:
            break;
    }
}

async function handleIncoming(payload, businessId) {
    if (await alreadyProcessed(payload.messageId)) {
        console.log(`🔁 [squamata] mensagem ${payload.messageId} já processada — ignorando.`);
        return;
    }

    const normalized = adaptSquamataMessage(payload);
    console.log(`📥 [squamata] ${normalized.from} | tipo=${normalized.type} | de=${normalized.name}`);
    await handleIncomingMessage(normalized, businessId);
}

/**
 * Mensagem enviada pelo próprio celular do dono do número (`message.sent`).
 * Sem isso ela nunca apareceria no histórico do CRM.
 */
async function handleOutgoing(payload, businessId) {
    if (await alreadyProcessed(payload.messageId)) return;

    const phone = normalizePhone(payload.from);
    const whatsappId = canonicalWhatsAppId(payload.rawFrom || payload.from);

    // Consulta aceita o formato canônico (@s.whatsapp.net) e o legado (@c.us) — D15.
    let contact = await Contact.findOne({
        businessId,
        $or: [{ whatsappId: { $in: whatsAppIdCandidates(whatsappId) } }, { phone }],
    });

    if (!contact) {
        contact = await Contact.create({
            businessId,
            phone,
            whatsappId,
            name: 'Contato',
            channel: 'whatsapp',
            totalMessages: 0,
            followUpStage: 0,
            followUpActive: false,
            lastInteraction: new Date(),
        });
    }

    const timestamp = payload.timestamp ? new Date(payload.timestamp) : null;
    await saveMessage(
        phone,
        'agent',
        payload.text || '',
        payload.type || 'text',
        null,
        businessId,
        'whatsapp',
        null,
        whatsappId,
        contact._id,
        payload.messageId,
        { timestamp }
    );

    console.log(`📤 [squamata] enviada pelo celular para ${phone}`);
}

/**
 * Ponto único de entrada dos eventos do serviço Go.
 *
 * @param {object} payload corpo do webhook já validado
 * @param {import('socket.io').Server} io servidor de socket do painel
 */
async function handleSquamataEvent(payload, io) {
    if (!payload || typeof payload !== 'object') return;

    publishSessionEvent(io, payload);

    if (payload.event !== 'message' && payload.event !== 'message.sent') return;

    const businessId = payload.tenantId;
    if (!mongoose.isValidObjectId(businessId)) {
        console.warn(`⚠️ [squamata] tenantId inválido no evento: ${businessId}`);
        return;
    }

    if (payload.event === 'message.sent') {
        return handleOutgoing(payload, businessId);
    }
    return handleIncoming(payload, businessId);
}

export { verifySignature, handleSquamataEvent, publishSessionEvent };
