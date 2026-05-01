import axios from 'axios';
import BusinessConfig from '../models/BusinessConfig.js';

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

        prompt += `\n--- INSTRUÇÕES DE CATÁLOGO ---\nPara dar orçamentos, SEMPRE use a ferramenta searchProducts. Se o produto retornado possuir 'visualGuideUrl', você DEVE enviar essa URL para o cliente ver e pedir para ele escolher uma opção baseada nos 'customAttributes' antes de passar o preço final. O orçamento final é a soma do preço base com o preço da opção escolhida.\n`;

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

import { searchProducts } from './aiTools.js';

async function callDeepSeek(messages, businessId, depth = 0) {
    if (depth > 5) {
        console.warn("⚠️ callDeepSeek atingiu limite de recursão (depth > 5). Abortando.");
        return "Desculpe, ocorreu um erro ao processar sua solicitação.";
    }

    try {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        const apiUrl = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions";
        const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

        let finalMessages = sanitizeContext(messages);

        const payload = {
            model: model,
            messages: finalMessages,
            max_tokens: 900,
            temperature: 0.7,
            stream: false,
            tools: [
                {
                    type: "function",
                    function: {
                        name: "searchProducts",
                        description: "Busca produtos, preços, variações (customAttributes) e guias visuais (visualGuideUrl) no banco de dados da empresa",
                        parameters: {
                            type: "object",
                            properties: {
                                keywords: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: "Lista de palavras-chave para buscar produtos"
                                }
                            },
                            required: ["keywords"]
                        }
                    }
                }
            ]
        };

        const response = await axios.post(apiUrl, payload, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 60000
        });

        const responseMessage = response.data.choices[0].message;

        // Se a IA pediu para usar ferramentas
        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            // 1. OBRIGATÓRIO: Push da resposta original do assistente EXATAMENTE como veio
            finalMessages.push(responseMessage);

            // 2. Loop sobre TODAS as ferramentas solicitadas (a IA pode pedir mais de uma simultaneamente)
            for (const toolCall of responseMessage.tool_calls) {
                let toolResultStr = "";

                try {
                    const args = JSON.parse(toolCall.function.arguments);

                    if (toolCall.function.name === 'searchProducts') {
                        // Chama a função real
                        const resultData = await searchProducts(businessId, args.keywords);
                        // O resultado DEVE ser transformado em string JSON
                        toolResultStr = JSON.stringify(resultData);
                    } else {
                        toolResultStr = JSON.stringify({ error: "Ferramenta não reconhecida" });
                    }
                } catch (err) {
                    console.error("Erro ao executar tool:", err);
                    toolResultStr = JSON.stringify({ error: "Falha ao executar ferramenta" });
                }

                // 3. OBRIGATÓRIO: Push da resposta da ferramenta com o ID e role corretos
                finalMessages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    name: toolCall.function.name, // DeepSeek/OpenAI exigem o nome da função aqui
                    content: toolResultStr // Obrigatório ser String
                });
            }

            // 4. Chama a IA novamente de forma recursiva com o contexto atualizado
            return await callDeepSeek(finalMessages, businessId, depth + 1);
        }

        return responseMessage.content;
    } catch (error) {
        console.error("❌ Erro DeepSeek API:", error.response?.data || error.message);
        throw error;
    }
}

// Mantido para compatibilidade com Campanhas
async function generateCampaignMessage(promptText, context, businessId) {
    // ... (Código original da campanha mantido igual) ...
    try {
        const systemPrompt = `SYSTEM: Write a short marketing message. Recipient: ${context.name || 'Cliente'}. No Markdown.`;
        const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: promptText }];
        const content = await callDeepSeek(messages, businessId);
        return content.trim();
    } catch (e) { return promptText; }
}

export { callDeepSeek, buildSystemPrompt, generateCampaignMessage, getFunnelStagePrompt, formatHistoryText };