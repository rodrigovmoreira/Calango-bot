import BusinessConfig from '../../models/BusinessConfig.js';

/**
 * Cliente do squamata-whatsapp (serviço Go).
 *
 * É a única porta de saída do Calango-bot para o WhatsApp: o resto do backend
 * chama estas funções e nunca fala HTTP com o serviço diretamente.
 * Contrato: PLANEJAMENTO.md §4 (repo Squamata-whatsapp).
 */

// Lidos a cada chamada (não no import): permite teste com env controlado e
// evita depender da ordem de carregamento dos módulos.
function baseUrl() {
    return (process.env.SQUAMATA_WHATSAPP_URL || '').replace(/\/+$/, '');
}

function internalToken() {
    return process.env.SQUAMATA_INTERNAL_TOKEN || '';
}

const DEFAULT_TIMEOUT_MS = 30000;

function timeoutMs() {
    return Number(process.env.SQUAMATA_WHATSAPP_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
}

/** O serviço está configurado? Sem URL e token, nada é enviado. */
function isEnabled() {
    return Boolean(baseUrl() && internalToken());
}

async function request(method, path, body, customTimeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), customTimeoutMs || timeoutMs());

    try {
        const response = await fetch(`${baseUrl()}/api/v1${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${internalToken()}`,
                ...(body ? { 'Content-Type': 'application/json' } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });

        const text = await response.text();
        const payload = text ? JSON.parse(text) : null;

        if (!response.ok) {
            const code = payload?.error?.code || `HTTP_${response.status}`;
            const error = new Error(payload?.error?.message || `squamata-whatsapp respondeu ${response.status}`);
            error.code = code;
            error.status = response.status;
            throw error;
        }
        return payload;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Resolve (e cria, se preciso) a sessão do serviço para a empresa — decisão D13.
 * O `sessionId` devolvido é opaco: o bot guarda e nunca interpreta.
 */
async function ensureSession(businessId) {
    const config = await BusinessConfig.findById(businessId).select('whatsappSessionId businessName name');
    if (!config) throw new Error(`BusinessConfig ${businessId} não encontrada.`);

    if (config.whatsappSessionId) return config.whatsappSessionId;

    const created = await request(
        'POST',
        `/tenants/${businessId}/sessions`,
        { name: (config.businessName || config.name || 'WhatsApp').slice(0, 80) },
        10000
    );
    await BusinessConfig.updateOne({ _id: businessId }, { $set: { whatsappSessionId: created.id } });
    console.log(`🆕 [squamata] sessão criada para a empresa ${businessId}: ${created.id}`);
    return created.id;
}

/** Devolve o sessionId já existente, sem criar. `null` se ainda não foi conectado. */
async function existingSession(businessId) {
    const config = await BusinessConfig.findById(businessId).select('whatsappSessionId');
    return config?.whatsappSessionId || null;
}

async function connect(businessId) {
    const sessionId = await ensureSession(businessId);
    return request('POST', `/tenants/${businessId}/sessions/${sessionId}/connect`);
}

async function disconnect(businessId) {
    const sessionId = await existingSession(businessId);
    if (!sessionId) return { status: 'disconnected' };
    return request('POST', `/tenants/${businessId}/sessions/${sessionId}/disconnect`);
}

async function removeSession(businessId) {
    const sessionId = await existingSession(businessId);
    if (!sessionId) return;
    await request('DELETE', `/tenants/${businessId}/sessions/${sessionId}`);
    await BusinessConfig.updateOne({ _id: businessId }, { $set: { whatsappSessionId: null } });
}

/**
 * Estado atual para o painel. Degrada em vez de estourar (requisito 5 da
 * §11.1): serviço fora do ar aparece como desconectado, não como erro 500.
 */
async function getStatus(businessId) {
    if (!isEnabled()) {
        return { status: 'disconnected', isConnected: false, mode: 'Serviço de WhatsApp não configurado' };
    }

    try {
        const sessionId = await existingSession(businessId);
        if (!sessionId) return { status: 'disconnected', isConnected: false, mode: 'Desconectado' };

        const session = await request('GET', `/tenants/${businessId}/sessions/${sessionId}`, null, 5000);
        return {
            status: session.status,
            isConnected: session.status === 'ready' || session.status === 'authenticated',
            mode: session.status,
            phone: session.phone || null,
        };
    } catch (error) {
        console.warn(`⚠️ [squamata] status indisponível (${error.code || error.message})`);
        return { status: 'disconnected', isConnected: false, mode: 'Serviço indisponível' };
    }
}

/** QR atual, ou `null` quando ainda não há um válido. */
async function getQr(businessId) {
    if (!isEnabled()) return null;
    try {
        const sessionId = await existingSession(businessId);
        if (!sessionId) return null;
        const qr = await request('GET', `/tenants/${businessId}/sessions/${sessionId}/qr`, null, 5000);
        return qr.qr;
    } catch (error) {
        // 409 = ainda não gerado; qualquer outro erro também não deve quebrar o painel.
        return null;
    }
}

/**
 * Envio de texto. Não faz retry: a operação não é idempotente e repetir
 * duplicaria a mensagem (requisito 7 da §11.1).
 * Mantém o contrato booleano que os consumidores já usavam.
 */
async function sendText(businessId, to, text) {
    if (!isEnabled()) {
        console.warn('⚠️ [squamata] envio ignorado: SQUAMATA_WHATSAPP_URL/TOKEN não configurados.');
        return false;
    }
    try {
        const sessionId = await ensureSession(businessId);
        await request('POST', `/tenants/${businessId}/sessions/${sessionId}/messages`, { to, text });
        return true;
    } catch (error) {
        console.error(`💥 [squamata] falha ao enviar texto para ${to}: ${error.code || error.message}`);
        return false;
    }
}

async function sendMedia(businessId, to, mediaUrl, caption = '', mime = '') {
    if (!isEnabled()) {
        console.warn('⚠️ [squamata] envio de mídia ignorado: serviço não configurado.');
        return false;
    }
    try {
        const sessionId = await ensureSession(businessId);
        await request(
            'POST',
            `/tenants/${businessId}/sessions/${sessionId}/messages/media`,
            { to, mediaUrl, mime, caption },
            90000
        );
        return true;
    } catch (error) {
        console.error(`💥 [squamata] falha ao enviar mídia para ${to}: ${error.code || error.message}`);
        return false;
    }
}

async function sendPresence(businessId, to, type = 'typing') {
    if (!isEnabled()) return false;
    try {
        const sessionId = await existingSession(businessId);
        if (!sessionId) return false;
        await request('POST', `/tenants/${businessId}/sessions/${sessionId}/presence`, { to, type }, 5000);
        return true;
    } catch {
        // Presença é cosmética: nunca interrompe o fluxo da conversa.
        return false;
    }
}

// --- F5: contatos ---------------------------------------------------------

/**
 * Lista os contatos conhecidos pelo WhatsApp (substitui o scraping de pupPage).
 * Devolve `{ contacts: [{ jid, phone, name, pushName }], truncated }`.
 */
async function syncContacts(businessId) {
    const sessionId = await existingSession(businessId);
    if (!sessionId) {
        const error = new Error('Sessão de WhatsApp ainda não criada.');
        error.code = 'SESSION_NOT_FOUND';
        throw error;
    }
    return request('POST', `/tenants/${businessId}/sessions/${sessionId}/contacts/sync`, null, 60000);
}

// --- F6: etiquetas --------------------------------------------------------
// O serviço devolve `{ labelId, name, color }`; aqui expomos `{ id, name, colorIndex }`
// para o restante do bot. A cor do WhatsApp é um índice com paleta própria —
// não é o hex do painel, por isso não é convertida (Tag.color é da UI).

function toLabel(raw) {
    return { id: raw.labelId, name: raw.name, colorIndex: raw.color };
}

async function listLabels(businessId) {
    if (!isEnabled()) return [];
    const sessionId = await existingSession(businessId);
    if (!sessionId) return [];
    const labels = await request('GET', `/tenants/${businessId}/sessions/${sessionId}/labels`, null, 15000);
    return (labels || []).map(toLabel);
}

async function createLabel(businessId, name) {
    const sessionId = await ensureSession(businessId);
    const created = await request('POST', `/tenants/${businessId}/sessions/${sessionId}/labels`, { name }, 15000);
    return toLabel(created);
}

async function updateLabel(businessId, labelId, name) {
    const sessionId = await existingSession(businessId);
    if (!sessionId) throw new Error('Sessão de WhatsApp não criada.');
    const updated = await request(
        'PATCH',
        `/tenants/${businessId}/sessions/${sessionId}/labels/${labelId}`,
        { name },
        15000
    );
    return toLabel(updated);
}

async function deleteLabel(businessId, labelId) {
    const sessionId = await existingSession(businessId);
    if (!sessionId) return;
    await request('DELETE', `/tenants/${businessId}/sessions/${sessionId}/labels/${labelId}`, null, 15000);
}

async function labelChats(businessId, labelId) {
    const sessionId = await existingSession(businessId);
    if (!sessionId) return [];
    const result = await request(
        'GET',
        `/tenants/${businessId}/sessions/${sessionId}/labels/${labelId}/chats`,
        null,
        20000
    );
    return result?.chats || [];
}

async function setChatLabels(businessId, chatId, labelIds) {
    const sessionId = await existingSession(businessId);
    if (!sessionId) return false;
    await request(
        'PUT',
        `/tenants/${businessId}/sessions/${sessionId}/chats/${encodeURIComponent(chatId)}/labels`,
        { labelIds },
        20000
    );
    return true;
}

export {
    isEnabled,
    ensureSession,
    existingSession,
    connect,
    disconnect,
    removeSession,
    getStatus,
    getQr,
    sendText,
    sendMedia,
    sendPresence,
    syncContacts,
    listLabels,
    createLabel,
    updateLabel,
    deleteLabel,
    labelChats,
    setChatLabels,
};
