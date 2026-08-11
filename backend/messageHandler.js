import { saveMessage, getLastMessages } from './services/message.js';
import { parseMediaToText } from './services/mediaProcessorService.js';
import { sendUnifiedMessage } from './services/responseService.js';
import * as wwebjsService from './services/wwebjsService.js';
import BusinessConfig from './models/BusinessConfig.js';
import Contact from './models/Contact.js';
import Message from './models/Message.js';
import { processConversation } from './services/aiService.js';
import { evaluateMessageFilters, handleBlockedMessage } from './services/messageFilterService.js';
import { processQuickReplies, checkHumanPause } from './services/menuService.js';
import { normalizePhone } from './utils/phoneUtils.js';

// === CONTROLE DE PROTEÇÃO (ANTI-LOOP) ===
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_MSGS_PER_WINDOW = 10;
const COOLDOWN_TIME = 10 * 60 * 1000;
const HUMAN_DELAY_MIN = 5000;
const HUMAN_DELAY_MAX = 15000;

// === BUFFER DE MENSAGENS ===
const messageBuffer = new Map();
const BUFFER_DELAY = 11000;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function checkRateLimit(key) {
    if (process.env.NODE_ENV === 'test') return true;
    const now = Date.now();
    let record = rateLimitMap.get(key);
    if (!record) { rateLimitMap.set(key, { count: 1, startTime: now, isBlocked: false }); return true; }
    if (record.isBlocked) { if (now - record.blockedAt > COOLDOWN_TIME) { rateLimitMap.delete(key); return true; } return false; }
    if (now - record.startTime > RATE_LIMIT_WINDOW) { record.count = 1; record.startTime = now; return true; }
    record.count++;
    if (record.count > MAX_MSGS_PER_WINDOW) { record.isBlocked = true; record.blockedAt = now; return false; }
    return true;
}

// ==========================================
// 🚀 PROCESSADOR DE MENSAGENS BUFFERIZADAS
// ==========================================
async function processBufferedMessages(uniqueKey) {
    const bufferData = messageBuffer.get(uniqueKey);
    if (!bufferData) return;

    messageBuffer.delete(uniqueKey);

    const { messages, from, rawFrom, waMessageId, name, activeBusinessId, provider, channel, resolve } = bufferData;

    try {
        if (!activeBusinessId) {
            if (resolve) resolve({ success: false, error: 'No active business ID' });
            return;
        }

        const businessConfig = await BusinessConfig.findById(activeBusinessId);
        if (!businessConfig) {
            if (resolve) resolve({ success: false, error: 'Business config not found' });
            return;
        }

        if (!businessConfig.prompts) businessConfig.prompts = { chatSystem: "...", visionSystem: "..." };

        let contactQuery = { businessId: activeBusinessId };
        let cleanFromForDb = from;

        if (channel === 'web') {
            contactQuery.sessionId = from;
        } else {
            cleanFromForDb = normalizePhone(from);
            
            // 🔧 PRIORIDADE: Busca primeiro por whatsappId (formato @c.us original)
            // Este é o identificador mais confiável — o phone pode ter sido extraído
            // de um Alias ID falso em contas Business
            contactQuery.$or = [
                { whatsappId: rawFrom },           // 🥇 Prioridade 1: ID original do WhatsApp
                { phone: cleanFromForDb },         // 🥈 Prioridade 2: formato nacional
            ];
        }

        let contact = await Contact.findOne(contactQuery);

        const isNewContact = !contact || contact.totalMessages === 0;
        const currentName = contact?.name || name || "Cliente";
        const isUnknownName = !contact?.name || contact.name === 'Cliente' || contact.name === from;

        const filterResult = evaluateMessageFilters(contact, businessConfig, channel);
        const shouldProcessMedia = filterResult.shouldProcess;
        const blockReason = filterResult.blockReason;

        if (!shouldProcessMedia) {
            await handleBlockedMessage(blockReason, contact, businessConfig);

            if (blockReason === 'handover') {
                console.log(`🛑 Handover ativo para ${from}. Robô silenciado.`);
                if (resolve) resolve({ text: "" });
            } else if (blockReason === 'global') {
                console.log(`🛑 AI Global Disabled (Observer Mode) for business ${businessConfig._id}.`);
                if (resolve) resolve({ text: "" });
            } else if (blockReason === 'audience') {
                console.log(`🛑 AI Audience Filter: Ignored (Mode: ${businessConfig.aiResponseMode}).`);
                if (resolve) resolve({ text: "" });
            } else if (blockReason === 'hours') {
                const awayMsg = businessConfig.awayMessage;
                const lastMessages = await getLastMessages(cleanFromForDb, 1, activeBusinessId, channel);
                if (lastMessages && lastMessages.length > 0) {
                    const lastMsg = lastMessages[0];
                    if (lastMsg.role === 'bot' && lastMsg.content === awayMsg) {
                        console.log(`🔕 Away Message suprimida para ${from} (loop prevent).`);
                        if (resolve) resolve({ text: "" });
                        return;
                    }
                }
                await saveMessage(cleanFromForDb, 'bot', awayMsg, 'text', null, activeBusinessId, channel, null, rawFrom, null, waMessageId);
                if (resolve) {
                    resolve({ text: awayMsg });
                } else {
                    await sendUnifiedMessage(from, awayMsg, provider, businessConfig._id);
                }
            }
            return;
        }

        const userMessage = await parseMediaToText(messages, shouldProcessMedia, businessConfig);
        await saveMessage(cleanFromForDb, 'user', userMessage, 'text', null, activeBusinessId, channel, name, rawFrom, null, waMessageId);

        const isMenuHandled = await processQuickReplies({
            userMessage,
            businessConfig,
            activeBusinessId,
            from,
            rawFrom,  // ✅ ID original do WhatsApp para lookup preciso
            provider,
            uniqueKey,
            channel,
            cleanFromForDb,
            resolve
        });

        if (isMenuHandled) return;

        if (channel !== 'web') {
            wwebjsService.sendStateTyping(activeBusinessId, from).catch(() => { });
        }

        let finalResponseText = "";
        try {
            finalResponseText = await processConversation({
                userMessage,
                businessConfig,
                activeBusinessId,
                contact,
                currentName,
                isNewContact,
                isUnknownName,
                channel,
                provider,
                from,
                contactQuery,
                cleanFromForDb
            });
        } catch (aiErr) {
            console.error("Erro Geração IA:", aiErr);
            if (resolve) resolve({ success: false, error: 'AI Error' });
            return;
        }

        if (channel !== 'web') {
            wwebjsService.sendStateTyping(activeBusinessId, from).catch(() => { });
            if (process.env.NODE_ENV !== 'test') {
                const delay = Math.floor(Math.random() * (HUMAN_DELAY_MAX - HUMAN_DELAY_MIN + 1)) + HUMAN_DELAY_MIN;
                await sleep(delay);
            }
            await sendUnifiedMessage(from, finalResponseText, provider, businessConfig._id);
        }

        if (resolve) resolve({ text: finalResponseText });

        await saveMessage(cleanFromForDb, 'bot', finalResponseText, 'text', null, activeBusinessId, channel, null, rawFrom, null, waMessageId);

        if (contact && !contact.isHandover) {
            await Contact.updateOne(
                { _id: contact._id },
                {
                    $set: {
                        followUpActive: true,
                        followUpStage: 0,
                        lastResponseTime: new Date()
                    }
                }
            );
        }

    } catch (error) {
        console.error('💥 Erro Buffer Process:', error);
        if (resolve) resolve({ success: false, error: error.message });
    }
}

// ==========================================
// 🚀 HANDLER PRINCIPAL (AGORA COM BUFFER)
// ==========================================
async function handleIncomingMessage(normalizedMsg, activeBusinessId) {
    const { from, rawFrom, body, name, type, mediaData, provider, channel = 'whatsapp' } = normalizedMsg;
    
    // 🔧 Extrai o ID original da mensagem no WhatsApp (dedup)
    const originalMsg = normalizedMsg.originalEvent || normalizedMsg.msgInstance || null;
    const waMessageId = originalMsg?.id?._serialized || originalMsg?.id?.id || null;

    if (from && channel !== 'web') {
        const isInvalidSource =
            from.includes('@g.us') ||
            from.includes('status@broadcast') ||
            from.includes('@newsletter');

        const numericPart = from.replace(/\D/g, '');
        const isTooLong = numericPart.length > 15;

        if (isInvalidSource || isTooLong) {
            console.warn(`🚫 Handler Blocked: Invalid source ${from}`);
            return { error: "Blocked Source (Group/Channel/Invalid)" };
        }
    }

    if (!body && type === 'text') return;

    const uniqueKey = `${activeBusinessId}_${from}`;

    if (checkHumanPause(uniqueKey)) {
        return { text: "Atendimento pausado para intervenção humana." };
    }

    if (!checkRateLimit(uniqueKey)) {
        console.warn(`🚨 ANTI-SPAM ATIVADO: Mensagem ignorada! O contato [${uniqueKey}] excedeu o limite e está no gancho de 10 minutos.`);
        return { error: "Rate limit exceeded" };
    }

    const msgItem = {
        type: type,
        body: body ? body.trim() : "",
        mediaData: mediaData
    };

    if (msgItem.type === 'text' && !msgItem.body) return { error: "Empty message" };

    let buffer = messageBuffer.get(uniqueKey);
    let responsePromise = null;

    if (buffer) {
        clearTimeout(buffer.timer);
        buffer.messages.push(msgItem);
        buffer.lastActiveBusinessId = activeBusinessId;
    } else {
        buffer = {
            messages: [msgItem],
            from,
            rawFrom: rawFrom || from,  // ✅ WhatsApp ID original (@c.us) para lookup preciso
            waMessageId,               // 🔧 ID original da msg (dedup)
            name,
            activeBusinessId,
            provider,
            channel,
            timer: null,
            resolve: null
        };

        if (channel === 'web' || process.env.NODE_ENV === 'test') {
            responsePromise = new Promise((resolve) => {
                buffer.resolve = resolve;
            });
        }
    }

    const delay = channel === 'web' ? 3000 : BUFFER_DELAY;

    buffer.timer = setTimeout(() => {
        processBufferedMessages(uniqueKey);
    }, delay);

    messageBuffer.set(uniqueKey, buffer);

    if (channel === 'web' || process.env.NODE_ENV === 'test') {
        return responsePromise;
    }
}

// ==========================================
// 📤 HANDLER DE MENSAGENS ENVIADAS (fromMe / message_create)
// ==========================================
// Captura mensagens enviadas PELO WhatsApp conectado (celular/telefone).
// Sem isso, envios feitos fora do CRM nunca aparecem no histórico.
async function handleOutgoingMessage(msg, targetId, activeBusinessId) {
    try {
        if (!activeBusinessId) return;

        // 🔓 Desmascara @lid se necessário (o contato destino pode ter ID de privacidade)
        let waId = targetId;
        let phoneSource = targetId;
        if (targetId.includes('@lid')) {
            try {
                const client = wwebjsService.getClientSession(activeBusinessId);
                const lidMap = await client.getContactLidAndPhone([targetId]);
                if (lidMap && lidMap[0] && lidMap[0].pn) {
                    phoneSource = lidMap[0].pn;
                }
            } catch (e) { /* silencia */ }
        }

        const cleanPhone = normalizePhone(phoneSource);
        const waMessageId = msg.id?._serialized || msg.id?.id || null;
        const body = (msg.body || '').trim();
        if (!body) return;

        // 1. Busca ou cria o contato (pela chave técnica whatssappId)
        let contact = await Contact.findOne({
            businessId: activeBusinessId,
            $or: [
                { whatsappId: waId },
                { phone: cleanPhone },
            ].filter(Boolean)
        });

        if (!contact) {
            contact = await Contact.create({
                businessId: activeBusinessId,
                phone: cleanPhone,
                whatsappId: waId,
                name: 'Contato',
                channel: 'whatsapp',
                totalMessages: 0,
                followUpStage: 0,
                followUpActive: false,
                lastInteraction: new Date(),
            });
        }

        // 2. Dedup extra: evita duplicar quando o CRM/API ou o bot já salvou a mesma
        // mensagem nos últimos 30s (message_create dispara também para envios via API)
        const recentSame = await Message.findOne({
            contactId: contact._id,
            content: body,
            timestamp: { $gte: new Date(Date.now() - 30000) }
        }).sort({ timestamp: -1 }).lean();

        if (recentSame) {
            console.log(`🔁 [Outgoing] Mensagem "${body.slice(0, 30)}..." já salva recentemente — ignorando duplicata.`);
            return;
        }

        // 3. Salva a mensagem como 'agent' (enviada pelo negócio) com dedup por waMessageId
        await saveMessage(cleanPhone, 'agent', body, 'text', null, activeBusinessId, 'whatsapp', null, waId, contact._id, waMessageId);

        console.log(`📤 [Outgoing] ${contact.name || cleanPhone} | msg: ${body.slice(0, 40)} | waId: ${waMessageId}`);
    } catch (error) {
        console.error('Erro handleOutgoingMessage:', error);
    }
}

export { handleIncomingMessage, processBufferedMessages, handleOutgoingMessage };
