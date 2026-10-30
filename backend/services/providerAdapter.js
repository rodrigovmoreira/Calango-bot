import { normalizePhone, canonicalWhatsAppId } from '../utils/phoneUtils.js';

// --- TRADUTOR DO TWILIO (Mantido para compatibilidade) ---
const adaptTwilioMessage = (twilioBody) => {
    const { Body, From, ProfileName, NumMedia, MediaUrl0, MediaContentType0 } = twilioBody;
    let type = 'text';
    if (parseInt(NumMedia) > 0) {
        if (MediaContentType0 && MediaContentType0.startsWith('image/')) type = 'image';
        else if (MediaContentType0 && MediaContentType0.startsWith('audio/')) type = 'audio';
    }
    return {
        from: normalizePhone(From),
        body: Body || '',
        name: ProfileName || 'Cliente',
        type: type,
        mediaData: MediaUrl0 || null,
        provider: 'twilio',
        originalEvent: twilioBody
    };
};

// --- TRADUTOR DO WHATSAPP-WEB.JS (VERSÃO BLINDADA) ---
const adaptWWebJSMessage = async (msg) => {
    let name = 'Cliente';
    let realPhone = msg.from; // Fallback inicial (pode ser o @lid ou @c.us)

    try {
        const contact = await msg.getContact();
        name = contact.pushname || contact.name || 'Cliente';
        
        // 🔧 FIX: `contact.number` é um ALIAS FALSO em contas Business.
        // A fonte da verdade é `contact.id._serialized` (ex.: 5511989207636@c.us).
        if (contact.id && contact.id._serialized) {
            realPhone = contact.id._serialized;
        } else if (contact.number) {
            realPhone = contact.number;
        }
    } catch (e) { 
        console.warn('⚠️ Erro ao buscar detalhes do contato WWebJS, usando ID da mensagem.'); 
    }
    
    // LOG DE DIAGNÓSTICO
    console.log(`🔍 [ADAPTER] Processando Msg de: ${realPhone} | Tipo: ${msg.type}`);

    let type = 'text';
    let mediaData = null;

    // Verificação de Mídia
    const isMedia = msg.hasMedia || msg.type === 'image' || msg.type === 'ptt' || msg.type === 'audio';

    if (isMedia) {
        try {
            const media = await msg.downloadMedia();
            if (media) {
                if (media.mimetype.startsWith('image/')) type = 'image';
                if (media.mimetype.startsWith('audio/')) type = 'audio';
                
                mediaData = {
                    mimetype: media.mimetype,
                    data: media.data,
                    filename: media.filename
                };
            }
        } catch (error) {
            console.error('❌ Erro ao baixar mídia:', error.message);
        }
    }

    // Segurança: Se falhou o download, volta para texto
    if (type === 'image' && !mediaData) {
        type = 'text';
        msg.body = `${msg.body || ''} [Erro ao processar imagem]`;
    }

    return {
        from: normalizePhone(realPhone), // Normalizado para queries no banco
        rawFrom: msg.from,              // ✅ ORIGINAL (ex: 5511989207636@c.us) — fonte da verdade
        body: msg.body || '',
        name: name,
        type: type,
        mediaData: mediaData,
        provider: 'wwebjs',
        msgInstance: msg,
        originalEvent: msg
    };
};

// --- TRADUTOR DO SQUAMATA-WHATSAPP (serviço Go) ---
// Recebe o envelope do webhook (PLANEJAMENTO.md §3.2) e entrega o mesmo formato
// que o messageHandler já entende, para a lógica de negócio não mudar.
const adaptSquamataMessage = (payload) => {
    const media = payload.media || null;
    const mediaData = media?.base64
        ? {
            mimetype: media.mime || 'application/octet-stream',
            data: media.base64,
            filename: media.filename || null,
        }
        : null;

    return {
        from: normalizePhone(payload.from),
        // Formato canônico (D15): @s.whatsapp.net. O valor bruto do serviço
        // continua em originalEvent.rawFrom, para diagnóstico.
        rawFrom: canonicalWhatsAppId(payload.rawFrom || payload.from),
        body: payload.text || '',
        name: payload.pushName || 'Cliente',
        type: payload.type || 'text',
        mediaData,
        provider: 'squamata',
        messageId: payload.messageId,
        // Timestamp original do WhatsApp: sem ele, mensagem reenviada pelo
        // outbox apareceria no fim da conversa (D8).
        timestamp: payload.timestamp ? new Date(payload.timestamp) : null,
        originalEvent: payload,
    };
};

export { normalizePhone, adaptTwilioMessage, adaptWWebJSMessage, adaptSquamataMessage };