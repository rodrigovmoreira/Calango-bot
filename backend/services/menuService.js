// services/menuService.js
import { sendUnifiedMessage } from './responseService.js';
import { saveMessage } from './message.js';
import { callDeepSeek } from './aiService.js';

// --- QUICK REPLIES ENGINE (V2) ---
const humanPauseMap = new Map();
export const HUMAN_PAUSE_TIME = 30 * 60 * 1000;

export function setHumanPause(uniqueKey, duration = HUMAN_PAUSE_TIME) {
    humanPauseMap.set(uniqueKey, Date.now() + duration);
}

export function checkHumanPause(uniqueKey) {
    const pauseUntil = humanPauseMap.get(uniqueKey);
    if (pauseUntil && Date.now() < pauseUntil) {
        return true;
    }
    return false;
}

export async function processQuickReplies({ userMessage, businessConfig, activeBusinessId, from, provider, uniqueKey, channel, cleanFromForDb, resolve }) {
    if (businessConfig.menuOptions && businessConfig.menuOptions.length > 0) {
        const lowerMsg = userMessage.toLowerCase();
        const matchedOption = businessConfig.menuOptions.find(opt => {
            const keywords = opt.keyword.split(',').map(k => k.trim().toLowerCase());
            return keywords.some(k => k && lowerMsg.includes(k));
        });

        if (matchedOption) {
            let finalResponse = matchedOption.response;

            if (matchedOption.useAI) {
                const menuPrompt = `
${businessConfig.prompts.chatSystem}
---
INSTRUÇÃO: O usuário perguntou sobre "${matchedOption.keyword}".
A informação oficial é: "${matchedOption.response}".
Responda de forma natural usando APENAS a informação oficial.
Cliente: ${userMessage}`;

                try {
                    finalResponse = await callDeepSeek([
                        { role: "user", content: menuPrompt }
                    ], activeBusinessId);
                } catch (e) { console.error("Erro IA Menu:", e); }
            }

            if (matchedOption.requiresHuman) {
                setHumanPause(uniqueKey, HUMAN_PAUSE_TIME);
            }

            if (channel === 'web' && resolve) {
                resolve({ text: finalResponse });
            } else {
                await sendUnifiedMessage(from, finalResponse, provider, businessConfig._id);
            }
            await saveMessage(cleanFromForDb, 'bot', finalResponse, 'text', null, activeBusinessId, channel, null, from);
            return true;
        }
    }
    return false;
}
