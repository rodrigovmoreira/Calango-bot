import { saveMessage, getLastMessages } from './services/message.js';
import { parseMediaToText } from './services/mediaProcessorService.js';
import { sendUnifiedMessage } from './services/responseService.js';
import * as wwebjsService from './services/wwebjsService.js';
import BusinessConfig from './models/BusinessConfig.js';
import Contact from './models/Contact.js';
import { processConversation } from './services/aiService.js';
import { evaluateMessageFilters, handleBlockedMessage } from './services/messageFilterService.js';
import { processQuickReplies, checkHumanPause } from './services/menuService.js';

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

    const { messages, from, name, activeBusinessId, provider, channel, resolve } = bufferData;

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
            cleanFromForDb = from.split('@')[0].replace(/\D/g, '');
            contactQuery.phone = cleanFromForDb;
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
                await saveMessage(cleanFromForDb, 'bot', awayMsg, 'text', null, activeBusinessId, channel, null, from);
                if (resolve) {
                    resolve({ text: awayMsg });
                } else {
                    await sendUnifiedMessage(from, awayMsg, provider, businessConfig._id);
                }
            }
            return;
        }

        const userMessage = await parseMediaToText(messages, shouldProcessMedia, businessConfig);
        await saveMessage(cleanFromForDb, 'user', userMessage, 'text', null, activeBusinessId, channel, name, from);

        const isMenuHandled = await processQuickReplies({
            userMessage,
            businessConfig,
            activeBusinessId,
            from,
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

        await saveMessage(cleanFromForDb, 'bot', finalResponseText, 'text', null, activeBusinessId, channel, null, from);

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
    const { from, body, name, type, mediaData, provider, channel = 'whatsapp' } = normalizedMsg;

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

export { handleIncomingMessage, processBufferedMessages };
