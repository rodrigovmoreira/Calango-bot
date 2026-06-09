import axios from 'axios';
import BusinessConfig from '../models/BusinessConfig.js';
import { executeAITool, searchProducts } from './aiTools.js';
import { getTagNames } from './tagService.js';
import { getLastMessages } from './message.js';

// === TEXT STRIPPING ===

const stripThinking = (text) => {
    if (!text) return "";
    let clean = text;

    // 1. Remove Markdown de código (```json, ```)
    clean = clean.replace(/```json/g, '').replace(/```/g, '');

    // 2. Remove blocos <thinking> completos
    clean = clean.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

    // 3. SEGURANÇA CRÍTICA: Se a IA cortou o texto e deixou um <thinking> aberto,
    // nós cortamos tudo dali para frente para não vazar o pensamento incompleto.
    if (clean.includes('<thinking>')) {
        clean = clean.split('<thinking>')[0];
    }

    // 4. Remove tags de fechamento órfãs
    clean = clean.replace(/<\/thinking>/gi, '');

    return clean.trim();
};

const stripJsonBlocks = (text) => {
    if (!text) return "";
    let clean = text.replace(/```json[\s\S]*?```/gi, ''); // Tira blocos markdown
    clean = clean.replace(/\{[\s\S]*?"action"[\s\S]*?\}/gi, ''); // Tira o JSON solto
    return clean.trim();
};

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

//Constrói o Prompt do Sistema com Identidade, Tom, Catálogo e Regras de Humanização.
async function buildSystemPrompt(businessId) {
    try {
        const config = await BusinessConfig.findById(businessId);
        if (!config) return "You are a helpful assistant.";

        const botName = config.botName || "Assistente";
        const businessName = config.businessName || "Empresa";
        const businessType = config.businessType || "Comércio/Serviço";
        
        // TOM DE VOZ
        const toneInstruction = config.toneOfVoice && config.toneOfVoice.trim() !== "" 
            ? config.toneOfVoice 
            : "Profissional, educado, natural e em português do Brasil.";

        // IDENTIDADE MESTRA + DIRETRIZES DE HUMANIZAÇÃO (Sem usar símbolos no prompt)
        let prompt = `
--- IDENTIDADE DO FUNCIONÁRIO DIGITAL ---
Nome: ${botName}
Empresa: ${businessName}
Setor: ${businessType}
Tom de Voz: ${toneInstruction}

--- REGRAS ESTRITAS DE FORMATACAO (ANTI-ROBO) ---
Atencao: Voce esta operando em um chat de WhatsApp. Siga estas regras obrigatoriamente:
1. ZERO FORMATACAO: Nao utilize formatacao em negrito, italico, sublinhado ou titulos em nenhuma hipotese. Produza apenas texto puro.
2. ZERO LISTAS COM SIMBOLOS: Nao utilize asteriscos, hifens ou marcadores para criar listas. Se precisar listar, escreva em texto corrido, paragrafos fluidos ou use numeros simples.
3. NATURALIDADE: Escreva como um humano em um chat. Use quebras de linha duplas para separar ideias e facilitar a leitura.
4. CONTINUIDADE: Verifique o historico. Nao repita saudacoes (como "Ola!", "Tudo bem?") se voces ja se falaram na conversa recente.
`;

        prompt += `\n--- INSTRUÇÕES DE CATÁLOGO ---\nPara dar orçamentos, SEMPRE use a ferramenta searchProducts. Se o produto retornado possuir visualGuideUrls (um array de imagens guia), você DEVE usar a ação 'send_visual_guide' passando a PRIMEIRA URL (índice 0) para o cliente ver e pedir para ele escolher uma opção baseada nos 'customAttributes' antes de passar o preço final. Se o cliente pedir para ver MAIS imagens do guia visual, utilize a ação 'send_more_visual_guides' passando as imagens restantes do produto. O orçamento final é a soma do preço base com o preço da opção escolhida.\n`;

        prompt += `\nREGRAS DE INTERAÇÃO: Se o cliente disser apenas 'Oi', 'Olá', 'Tudo bem' ou enviar uma saudação, APENAS responda de forma educada e pergunte como pode ajudar. NÃO utilize a ferramenta searchProducts nestes casos.\n`;

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

// === ORCHESTRATION ===

async function buildAIContext(contextData) {
    const {
        businessConfig,
        activeBusinessId,
        contact,
        currentName,
        isNewContact,
        isUnknownName,
        channel,
        cleanFromForDb
    } = contextData;

    let welcomeContext = "";
    if (isNewContact) {
        welcomeContext = `
--- CONTEXTO: PRIMEIRO CONTATO ---
Este é um cliente NOVO.
1. Apresente-se brevemente de forma humana e amigável.
2. Pergunte qual o nome do cliente para que você possa anotá-lo.
`;
    } else if (isUnknownName && (!contact || contact.totalMessages < 5)) {
        welcomeContext = `
--- CONTEXTO: IDENTIFICAÇÃO ---
Ainda não sabemos o nome deste cliente.
Em um momento oportuno, pergunte o nome dele(a).
`;
    } else {
        welcomeContext = `
--- CONTEXTO: CLIENTE CONHECIDO ---
Nome do Cliente: ${currentName}.
Você pode chamá-lo(a) pelo nome esporadicamente para gerar conexão.
`;
    }

    const timeZone = businessConfig.timezone || businessConfig.operatingHours?.timezone || 'America/Sao_Paulo';
    contextData.timeZone = timeZone;
    const now = new Date();
    const formattedDateTime = new Intl.DateTimeFormat('pt-BR', {
        timeZone,
        weekday: 'long',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(now);
    const contextDateTime = `${formattedDateTime} (${timeZone})`;

    let catalogContext = "";
    if (businessConfig.products?.length > 0) {
        const allTags = new Set();
        businessConfig.products.forEach(p => {
            if (p.tags && Array.isArray(p.tags)) {
                p.tags.forEach(t => allTags.add(t));
            }
        });
        const uniqueTags = Array.from(allTags).join(', ');

        if (uniqueTags) {
            catalogContext = `CONTEXT: You have a database of products/services related to: [${uniqueTags}]. DO NOT guess prices or durations. If the user asks about a service, you MUST use the search_catalog tool to find its exact price and duration.`;
        }
    }

    const { instagram, website } = businessConfig.socialMedia || {};
    const basePrompt = await buildSystemPrompt(activeBusinessId);

    const contactTags = getTagNames(contact ? contact.tags : []);
    const funnelSteps = businessConfig.funnelSteps || [];
    const stageContext = getFunnelStagePrompt(funnelSteps, contactTags);
    const tagsContext = contactTags.length > 0 ? `--- TAGS DO CLIENTE (CRM) ---\n[${contactTags.join(', ')}]\n` : "";

    const rawDbHistory = await getLastMessages(cleanFromForDb, 15, activeBusinessId, channel);
    const historyText = formatHistoryText(rawDbHistory, businessConfig.botName);

    const toolsInstruction = `
--- FERRAMENTAS DISPONÍVEIS (Responda APENAS JSON) ---
Se precisar usar uma ferramenta, envie SOMENTE o bloco JSON correspondente.
1. Escolha APENAS UMA ferramenta por vez. NUNCA envie dois blocos JSON.
2. Se decidir usar uma ferramenta, envie SOMENTE o JSON puro. NUNCA misture texto humano com JSON na mesma resposta.
3. Se não for usar ferramenta, responda apenas com texto normal.

1. **SALVAR NOME DO CLIENTE**
   - Use ASSIM QUE o cliente disser o nome dele.
   - JSON: {"action": "update_name", "name": "Nome Identificado"}

2. **VERIFICAR AGENDA**
   - Calcule o "end" somando a duração do serviço (durationMinutes) ao "start".
   - JSON: {"action": "check", "start": "YYYY-MM-DD HH:mm", "end": "YYYY-MM-DD HH:mm"}

3. **AGENDAR (Apenas com confirmação)**
   - O campo "end" DEVE respeitar a duração exata do serviço.
   - JSON: {"action": "book", "clientName": "${currentName}", "start": "YYYY-MM-DD HH:mm", "end": "YYYY-MM-DD HH:mm", "title": "Nome do Serviço"}

4. **CATÁLOGO**
   - JSON: {"action": "search_catalog", "keywords": ["termo1"]}

5. **ENVIAR GUIA VISUAL**
   - Use SOMENTE APÓS pesquisar no catálogo e identificar que o produto tem visualGuideUrls. Você deve enviar a PRIMEIRA URL (índice 0) deste array. Opcionalmente adicione tags para registrar a escolha do cliente.
   - JSON: {"action": "send_visual_guide", "url": "url_da_primeira_imagem", "message": "Mensagem para o cliente"}

6. **ENVIAR MAIS GUIAS VISUAIS**
   - Use APENAS se o cliente pedir para ver MAIS imagens de guia visual de um produto que você já encontrou no catálogo e que possua mais de uma imagem em visualGuideUrls. Envie o array contendo as imagens restantes.
   - JSON: {"action": "send_more_visual_guides", "urls": ["url2", "url3"], "message": "Mensagem para o cliente"}

7. **ADICIONAR TAG (CRM)**
   - Use para marcar uma escolha, preferência ou variação selecionada pelo cliente.
   - JSON: {"action": "add_tag", "tag": "Nome da Tag"}

Se for apenas conversar, responda texto normal.
`;

    const systemInstruction = `
${basePrompt}
${welcomeContext}
${tagsContext}
${stageContext}
${toolsInstruction}
${historyText}

--- CONTEXTO TÉCNICO ---
Data/Hora: ${contextDateTime}
${catalogContext}
Links: Insta=${instagram || 'N/A'}, Site=${website || 'N/A'}

--- PROTOCOLO DE RACIOCÍNIO ---
1. **ANALISE:** Veja o histórico. Se já saudou, NÃO repita a saudação.
2. **PENSE:** Use <thinking>...</thinking> para planejar a resposta.
3. **RESPONDA:** A resposta final para o cliente deve vir DEPOIS da tag </thinking>.

--- FORMATO DE SAÍDA ---
- Texto normal: Apenas a resposta.
- Ações: Use JSON puro ({"action": "..."}).
`;

    return systemInstruction;
}


async function processConversation(contextData) {
    const systemInstruction = await buildAIContext(contextData);

    const aiMessages = [
        { role: "system", content: systemInstruction },
        { role: "user", content: contextData.userMessage }
    ];

    let finalResponseText = "";

    try {
        const rawResponseText = await callDeepSeek(aiMessages, contextData.activeBusinessId);

        const thoughtMatch = rawResponseText.match(/<thinking>([\s\S]*?)<\/thinking>/i);
        if (thoughtMatch) console.log(`🧠 [IA PENSOU]: ${thoughtMatch[1].substring(0, 100)}...`);

        let cleanResponse = stripThinking(rawResponseText);

        if (!cleanResponse || cleanResponse.trim() === "") {
            console.warn("⚠️ IA gerou resposta vazia após limpeza. Usando Fallback.");
            cleanResponse = "Entendi. Poderia me dar mais detalhes?";
        }

        const jsonText = cleanResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            try {
                const command = JSON.parse(jsonMatch[0]);

                const toolResult = await executeAITool(command, contextData);

                // --- RECURSIVIDADE ---
                aiMessages.push({ role: "assistant", content: rawResponseText });
                aiMessages.push({ role: "user", content: `[SISTEMA]: Resultado da ação: ${toolResult}. Agora responda ao cliente.` });

                const rawFinalResponse = await callDeepSeek(aiMessages, contextData.activeBusinessId);

                finalResponseText = stripThinking(rawFinalResponse);

                if (!finalResponseText || finalResponseText.trim() === "") {
                    finalResponseText = "Certo, verifiquei aqui.";
                }

            } catch (jsonErr) {
                console.error("Erro JSON IA:", jsonErr);
                finalResponseText = cleanResponse;
            }
        } else {
            finalResponseText = cleanResponse;
        }

    } catch (aiErr) {
        console.error("Erro Geração IA:", aiErr);
        throw new Error('AI Error');
    }

    finalResponseText = stripJsonBlocks(finalResponseText);

    if (!finalResponseText || finalResponseText.trim() === "") {
        throw new Error("Mensagem final vazia detectada.");
    }

    return finalResponseText;
}


async function callDeepSeek(messages, businessId, depth = 0) {
    if (depth > 5) {
        console.warn(`⚠️ Limite de recursão (depth > 5) atingido para businessId: ${businessId}. Forçando fallback humano.`);

        // Em vez de abortar quebrando o fluxo, forçamos a IA a dar uma resposta final
        // sem permissão para usar ferramentas.
        const fallbackMessages = [
            ...messages,
            {
                role: "system",
                content: "SISTEMA CRÍTICO: Você atingiu o limite de tentativas de busca. VOCÊ ESTÁ PROIBIDO DE USAR FERRAMENTAS AGORA. Responda imediatamente ao usuário pedindo desculpas pela confusão, dizendo que não conseguiu encontrar a informação exata, e peça para ele reformular a pergunta ou descrever melhor o que deseja."
            }
        ];

        // Faz a chamada final sem passar as "tools" no payload
        try {
            const finalResponse = await axios.post('https://api.deepseek.com/chat/completions', {
                model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
                messages: fallbackMessages,
                temperature: 0.7,
                max_tokens: 500
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            return finalResponse.data.choices[0].message.content;
        } catch (e) {
            // Falha catastrófica total
            return "Puxa, fiquei um pouco confuso agora. Você poderia me dar mais detalhes sobre o serviço que está procurando?";
        }
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
                        description: "Use esta ferramenta APENAS quando o cliente solicitar explicitamente preços, orçamentos, ou informações sobre um serviço específico. NUNCA use esta ferramenta para responder perguntas genéricas.",
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

            console.log('🛠️ IA ACIONOU TOOL:', JSON.stringify(responseMessage.tool_calls.map(t => ({ name: t.function.name, args: t.function.arguments }))));

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

export { callDeepSeek, buildSystemPrompt, generateCampaignMessage, getFunnelStagePrompt, formatHistoryText, processConversation, buildAIContext };
