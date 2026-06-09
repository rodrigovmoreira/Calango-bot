import { analyzeImage } from './visionService.js';
import { transcribeAudio } from './transcriptionService.js';

/**
 * Parses buffered media messages into combined text, performing AI vision
 * or transcription if media processing is enabled.
 *
 * PURE FUNCTION conceptually (it isolates external side-effects like Vision/Transcription API calls).
 *
 * @param {Array} messages - Array of message objects from the buffer.
 * @param {boolean} shouldProcessMedia - Whether AI media processing is allowed (false if blocked).
 * @param {Object} businessConfig - The configuration containing prompts.
 * @returns {Promise<string>} The combined transcribed/parsed message text.
 */
export async function parseMediaToText(messages, shouldProcessMedia, businessConfig) {
    const finalMessages = [];

    for (const msg of messages) {
        let content = msg.body;

        if (msg.type === 'image' && msg.mediaData) {
            if (shouldProcessMedia) {
                const visionPrompt = businessConfig.prompts?.visionSystem || "Descreva esta imagem.";
                try {
                    const desc = await analyzeImage(msg.mediaData, visionPrompt);
                    const caption = desc ? `[VISÃO]: ${desc}` : "[Imagem]";
                    content = content ? `${content}\n${caption}` : caption;
                } catch (e) {
                    console.error("Erro Visão:", e);
                    content = content ? `${content}\n[Erro na análise de imagem]` : "[Erro na análise de imagem]";
                }
            } else {
                content = content ? `${content} [Imagem recebida]` : "[Imagem recebida]";
            }
        } else if (msg.type === 'audio' && msg.mediaData) {
            if (shouldProcessMedia) {
                try {
                    const trans = await transcribeAudio(msg.mediaData);
                    const caption = trans ? `[Áudio]: "${trans}"` : "[Áudio]";
                    content = content ? `${content}\n${caption}` : caption;
                } catch (e) {
                    console.error("Erro Transcrição:", e);
                    content = "[Erro ao processar áudio]";
                }
            } else {
                content = "[Áudio recebido]";
            }
        } else if (msg.type !== 'text') {
            // Outros tipos de mídia
            const mediaDesc = `[Mídia: ${msg.type}]`;
            content = content ? `${content}\n${mediaDesc}` : mediaDesc;
        }

        if (content) finalMessages.push(content);
    }

    return finalMessages.join('\n');
}
