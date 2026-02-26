const axios = require('axios');
const BusinessConfig = require('../models/BusinessConfig');

function sanitizeContext(messages) {
    return messages.filter(msg => {
        // Remove repetições massivas de caracteres (spam da IA)
        const spamRegex = /(.)\1{5,}/;
        if (msg.role === 'assistant' && spamRegex.test(msg.content)) {
            return false;
        }
        return true;
    });
}

/**
 * Constrói o Prompt do Sistema com Identidade, Tom, Catálogo e Regras de Humanização.
 */
async function buildSystemPrompt(businessId) {
    try {
        const config = await BusinessConfig.findById(businessId);
        if (!config) return "You are a helpful assistant.";

        const botName = config.botName || "Assistente";
        const businessName = config.businessName || "Empresa";
        
        // TOM DE VOZ
        const toneInstruction = config.toneOfVoice || config.tone || "Natural, brasileiro e prestativo.";

        // IDENTIDADE MESTRA + DIRETRIZES DE HUMANIZAÇÃO (Sem usar símbolos no prompt)
        let prompt = `
--- IDENTIDADE ---
Nome: ${botName}
Empresa: ${businessName}
Tom de Voz: ${toneInstruction}

--- REGRAS ESTRITAS DE FORMATACAO (ANTI-ROBO) ---
Atencao: Voce esta operando em um chat de WhatsApp. Siga estas regras obrigatoriamente:
1. ZERO FORMATACAO: Nao utilize formatacao em negrito, italico, sublinhado ou titulos em nenhuma hipotese. Produza apenas texto puro.
2. ZERO LISTAS COM SIMBOLOS: Nao utilize asteriscos, hifens ou marcadores para criar listas. Se precisar listar, escreva em texto corrido, paragrafos fluidos ou use numeros simples.
3. NATURALIDADE: Escreva como um humano em um chat. Use quebras de linha duplas para separar ideias e facilitar a leitura.
4. CONTINUIDADE: Verifique o historico. Nao repita saudacoes (como "Ola!", "Tudo bem?") se voces ja se falaram na conversa recente.
`;

        if (config.products && config.products.length > 0) {
            prompt += `\n--- CATALOGO RAPIDO (Referencia Interna) ---\n`;
            config.products.forEach(p => {
                let itemInfo = `Item: ${p.name} | Preco: R$ ${p.price}`;
                if (p.variations && p.variations.length > 0) {
                    const variationsText = p.variations.map(v => `${v.name} (R$${v.price})`).join(', ');
                    itemInfo += ` | Opcoes: ${variationsText}`;
                }
                prompt += `${itemInfo}\n`;
            });

            prompt += `\nCATALOG RULE: If the client requests a product/service that has variations (sizes, types), you MUST list these options and ask which one they prefer before confirming the final price or booking an appointment.\n`;
        }

        // CÉREBRO (Regras do Negócio)
        prompt += `\n--- REGRAS DO NEGOCIO (CEREBRO) ---\n`;
        prompt += config.customInstructions || config.prompts?.chatSystem || "";

        return prompt;
    } catch (error) {
        console.error("Error building prompt:", error);
        return "You are a helpful assistant.";
    }
}

function getFunnelStagePrompt(funnelSteps, contactTags) {
    if (!funnelSteps || funnelSteps.length === 0 || !contactTags || contactTags.length === 0) {
        return "";
    }
    const lowerTags = contactTags.map(t => (t && t.name ? t.name : t).toString().toLowerCase().trim());

    const activeStep = funnelSteps
        .filter(step => lowerTags.includes(step.tag.toLowerCase()))
        .sort((a, b) => b.order - a.order)[0];

    if (activeStep) {
        return `
--- FASE ATUAL DO FUNIL: "${activeStep.label}" ---
O cliente está nesta etapa. Siga ESTA instrução específica:
"${activeStep.prompt || 'Siga o fluxo natural.'}"
`;
    }
    return "";
}

function formatHistoryText(historyMessages, botName) {
    if (!historyMessages || historyMessages.length === 0) return "";

    const uniqueHistory = [];
    const seenContent = new Set();

    for (const msg of historyMessages) {
        if (!msg.content || !msg.content.trim()) continue;
        // Limpeza extra para remover JSONs antigos do histórico visual
        const cleanContent = msg.content.replace(/\{"action":.*\}/g, '[AÇÃO DO SISTEMA EXECUTADA]');
        
        const key = `${msg.role}:${cleanContent.trim()}`;
        if (!seenContent.has(key)) {
            uniqueHistory.push({ ...msg, content: cleanContent });
            seenContent.add(key);
        }
    }

    const sortedHistory = uniqueHistory.reverse();

    let historyText = "\n--- HISTÓRICO RECENTE (Contexto) ---\n";
    sortedHistory.forEach((msg, index) => {
        const roleName = msg.role === 'user' ? 'Cliente' : (botName || 'Assistente');
        historyText += `${index + 1} - ${roleName}: "${msg.content.replace(/\n/g, ' ')}"\n`;
    });
    historyText += "----------------------------------------\n";

    return historyText;
}

async function callDeepSeek(messages) {
    try {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        const apiUrl = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions";
        const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

        // Limpa span/loop infinito
        let finalMessages = sanitizeContext(messages);

        const response = await axios.post(
            apiUrl,
            {
                model: model,
                messages: finalMessages,
                max_tokens: 900,
                temperature: 0.7,
                stream: false,
                response_format: { type: 'text' }
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            }
        );

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error("❌ Erro DeepSeek API:", error.response?.data || error.message);
        throw error;
    }
}

// Mantido para compatibilidade com Campanhas
async function generateCampaignMessage(promptText, context) {
    // ... (Código original da campanha mantido igual) ...
    try {
        const systemPrompt = `SYSTEM: Write a short marketing message. Recipient: ${context.name || 'Cliente'}. No Markdown.`;
        const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: promptText }];
        const content = await callDeepSeek(messages);
        return content.trim();
    } catch (e) { return promptText; }
}

module.exports = {
    callDeepSeek,
    buildSystemPrompt,
    generateCampaignMessage,
    getFunnelStagePrompt,
    formatHistoryText
};