import { normalizePhone } from '../utils/phoneUtils.js';

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
        
        // ✨ TENTATIVA DE DESMASCARAR: 
        // Se o contato tiver a propriedade 'number', pegamos o telefone real (ex: 5511962903775)
        // Isso resolve o problema visual no Chat ao Vivo.
        if (contact.number) {
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

export { normalizePhone, adaptTwilioMessage, adaptWWebJSMessage };