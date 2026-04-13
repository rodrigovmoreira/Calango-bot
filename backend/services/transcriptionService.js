import axios from 'axios';
import FormData from 'form-data';

async function transcribeAudio(mediaData) {
    if (!mediaData || !mediaData.data) {
        console.error("❌ Erro Transcrição: Dados de mídia ausentes.");
        return null;
    }

    try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.error("❌ Erro Transcrição: OPENAI_API_KEY não configurada.");
            return null;
        }

        const buffer = Buffer.from(mediaData.data, 'base64');

        // OpenAI Whisper requires a filename with extension
        const formData = new FormData();
        // Usamos audio.ogg como padrão, mas o mimetype pode ajudar a definir
        formData.append('file', buffer, {
            filename: 'audio.ogg',
            contentType: mediaData.mimetype || 'audio/ogg'
        });
        formData.append('model', 'whisper-1');

        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${apiKey}`
            }
        });

        return response.data.text;
    } catch (error) {
        console.error("❌ Erro Transcrição API:", error.response?.data || error.message);
        return null;
    }
}

export { transcribeAudio };
