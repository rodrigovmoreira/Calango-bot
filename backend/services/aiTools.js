import Appointment from '../models/Appointment.js';
import BusinessConfig from '../models/BusinessConfig.js';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import * as wwebjsService from './wwebjsService.js';
import { sendUnifiedMessage } from './responseService.js';
import Contact from '../models/Contact.js';

// Helper para converter "HH:mm" em minutos totais (ex: "09:30" -> 570)
const getMinutes = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + (m || 0);
};

// 1. FERRAMENTA: Verificar Disponibilidade
const checkAvailability = async (userId, start, end) => {
    try {
        const startTime = new Date(start);
        const endTime = new Date(end);
        const now = new Date();

        // Validação básica de datas inválidas
        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
             return { available: false, reason: "Data inválida." };
        }

        const config = await BusinessConfig.findOne({ _id: userId });

        // 0. Verifica Antecedência Mínima (Buffer)
        if (config) {
            const bufferMinutes = config.minSchedulingNoticeMinutes || 60;
            const minStart = new Date(now.getTime() + bufferMinutes * 60000);

            if (startTime < minStart) {
                return {
                    available: false,
                    reason: `Necessário agendar com no mínimo ${bufferMinutes} minutos de antecedência.`
                };
            }
        }

        // 1. Verifica horário de funcionamento (COM MINUTOS E TIMEZONE)
        if (config && config.operatingHours && config.operatingHours.active) {
            const timeZone = config.timezone || config.operatingHours.timezone || 'America/Sao_Paulo';
            
            // Converte para o horário local da empresa
            const zonedStart = toZonedTime(startTime, timeZone);
            const zonedEnd = toZonedTime(endTime, timeZone);

            const startMinutes = zonedStart.getHours() * 60 + zonedStart.getMinutes();
            const endMinutes = zonedEnd.getHours() * 60 + zonedEnd.getMinutes(); // Aproximado para checagem simples do dia

            const openMinutes = getMinutes(config.operatingHours.opening);
            const closeMinutes = getMinutes(config.operatingHours.closing);

            // Verifica se está fora do horário (considerando apenas o horário de início por enquanto)
            if (startMinutes < openMinutes || startMinutes >= closeMinutes) {
                return { available: false, reason: `Fechado. Horário: ${config.operatingHours.opening} às ${config.operatingHours.closing}.` };
            }
        }

        // 2. Verifica conflitos na agenda (LÓGICA BLINDADA)
        // Conflito existe se: (StartA < EndB) E (EndA > StartB)
        const conflito = await Appointment.findOne({
            userId,
            status: { $in: ['scheduled', 'confirmed'] },
            start: { $lt: endTime },
            end: { $gt: startTime }
        });

        if (conflito) {
            return { available: false, reason: "Horário já ocupado." };
        }

        return { available: true };

    } catch (error) {
        console.error("Erro ao checar disponibilidade:", error);
        return { available: false, reason: "Erro interno no calendário." };
    }
};

// 2. FERRAMENTA: Criar Agendamento (Usado pela IA)
const createAppointmentByAI = async (userId, data) => {
    try {
        const check = await checkAvailability(userId, data.start, data.end);
        if (!check.available) return { success: false, error: check.reason };

        // Cria o agendamento
        const newAppt = await Appointment.create({
            userId,
            clientName: data.clientName,
            clientPhone: data.clientPhone,
            start: new Date(data.start),
            end: new Date(data.end),
            title: data.title || "Agendamento via IA",
            type: 'servico',
            status: 'scheduled'
        });

        return { success: true, data: newAppt };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

// 3. FERRAMENTA: Listar Horários Livres (Dinâmico)
const getFreeSlots = async (userId, dateStr) => {
    try {
        const config = await BusinessConfig.findOne({ _id: userId });
        if (!config || !config.operatingHours) return [];

        const slots = [];
        const baseDate = new Date(dateStr);
        const timeZone = config.timezone || 'America/Sao_Paulo';

        const openMinutes = getMinutes(config.operatingHours.opening);
        const closeMinutes = getMinutes(config.operatingHours.closing);
        
        // Intervalo de 60 min (pode ser parametrizável depois)
        const duration = 60; 

        // Itera minuto a minuto (pulo de hora em hora)
        for (let time = openMinutes; time < closeMinutes; time += duration) {
            const hour = Math.floor(time / 60);
            const minute = time % 60;

            const slotStart = new Date(baseDate);
            slotStart.setHours(hour, minute, 0, 0);

            const slotEnd = new Date(slotStart.getTime() + duration * 60000);

            const check = await checkAvailability(userId, slotStart, slotEnd);
            
            if (check.available) {
                // Formata HH:mm
                const hh = hour.toString().padStart(2, '0');
                const mm = minute.toString().padStart(2, '0');
                slots.push(`${hh}:${mm}`);
            }
        }
        return slots;

    } catch (error) {
        console.error("Erro getFreeSlots:", error);
        return [];
    }
};

// Helper de normalização (remove acentos e converte para minúsculas)
const normalizeText = (text) => {
    if (!text) return "";
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
};

// 4. FERRAMENTA: Buscar Produtos (Function Calling Atualizado)
const searchProducts = async (businessId, keywords = []) => {
    try {
        const config = await BusinessConfig.findById(businessId);
        if (!config || !config.products || config.products.length === 0) {
            return { error: "Nenhum produto cadastrado.", message: "Informe ao usuário que o catálogo de produtos/serviços está vazio no momento." };
        }

        const searchTerms = keywords.map(normalizeText).filter(k => k.length > 0);
        if (searchTerms.length === 0) {
            return { error: "Palavras-chave vazias.", message: "Peça ao usuário para fornecer o nome do produto/serviço que está procurando." };
        }

        const results = config.products.filter(p => {
            const productName = normalizeText(p.name);
            const productTags = (p.tags || []).map(normalizeText);
            return searchTerms.some(term => productName.includes(term) || productTags.some(tag => tag.includes(term)));
        });

        if (results.length === 0) {
            const availableProducts = config.products.map(p => p.name).slice(0, 5).join(", ");
            return {
                error: "Produto não encontrado.",
                message: `Diga ao usuário que não temos o produto buscado. Sugira as seguintes opções que temos disponíveis: ${availableProducts}`
            };
        }

        return results.map(p => ({
            name: p.name,
            type: p.type,
            price: p.price,
            durationMinutes: p.durationMinutes || 60,
            description: p.description,
            imageUrls: p.imageUrls || [],
            visualGuideUrls: p.visualGuideUrls || [],
            customAttributes: p.customAttributes || []
        }));
    } catch (error) {
        console.error("Erro searchProducts:", error);
        return { error: "Falha na busca.", message: "Ocorreu um erro interno ao buscar produtos. Diga ao usuário que você está com problemas técnicos para consultar o catálogo." };
    }
};

export const executeAITool = async (command, contextData) => {
    const {
        businessConfig,
        activeBusinessId,
        from,
        channel,
        provider,
        contactQuery,
        currentName,
        timeZone
    } = contextData;

    let toolResult = "";

    try {
        if (command.action === 'update_name') {
            if (command.name) {
                // Atualização BLINDADA (usa upsert para não dar erro se o contato não existir no banco ainda)
                await Contact.findOneAndUpdate(
                    contactQuery,
                    { $set: { name: command.name } },
                    { upsert: true }
                );
                toolResult = `SUCESSO: Nome salvo como "${command.name}". Responda chamando a pessoa pelo nome recém descoberto.`;
                console.log(`👤 Nome atualizado via IA para: ${command.name}`);
            } else {
                toolResult = "Erro ao salvar nome.";
            }
        } else if (command.action === 'check') {
            const startZoned = fromZonedTime(command.start, timeZone);
            let endZoned = command.end ? fromZonedTime(command.end, timeZone) : new Date(startZoned.getTime() + 60 * 60000);
            const check = await checkAvailability(activeBusinessId, startZoned, endZoned);
            toolResult = check.available ? "O horário está LIVRE. Pode oferecer." : `O horário está INDISPONÍVEL. Motivo: ${check.reason}.`;
        } else if (command.action === 'book') {
            const startZoned = fromZonedTime(command.start, timeZone);
            let endZoned = command.end ? fromZonedTime(command.end, timeZone) : new Date(startZoned.getTime() + 60 * 60000);
            const booking = await createAppointmentByAI(activeBusinessId, {
                clientName: command.clientName || currentName || "Cliente",
                clientPhone: from,
                title: command.title || "Agendamento via IA",
                start: startZoned,
                end: endZoned
            });
            toolResult = booking.success
                ? `SUCESSO: Agendamento salvo (ID: ${booking.data._id}). Pode confirmar.`
                : `ERRO CRÍTICO: Falhou. Motivo: ${booking.error}. Peça desculpas.`;
        } else if (command.action === 'search_catalog') {
            const products = await searchProducts(activeBusinessId, command.keywords);
            if (products.length > 0) {
                let count = 0;
                let sentProductsData = [];
                for (const p of products) {
                    if (count >= 5) break;
                    const caption = `${p.name} - R$ ${p.price}\n${p.description || ''}`;
                    if (p.imageUrls && p.imageUrls.length > 0) {
                        if (channel === 'web') { /* Logica web */ }
                        else {
                            await wwebjsService.sendImage(businessConfig._id, from, p.imageUrls[0], caption);
                            for (let i = 1; i < p.imageUrls.length; i++) {
                                await wwebjsService.sendImage(businessConfig._id, from, p.imageUrls[i], "");
                            }
                        }
                        count++;
                    } else {
                        if (channel !== 'web') await sendUnifiedMessage(from, caption, provider, businessConfig._id);
                    }
                    sentProductsData.push(p);
                }
                // Convertendo para string segura para evitar estourar max context ou json malformado, vamos injetar apenas metadata essencial
                toolResult = `Encontrei ${products.length} produtos e já enviei ${count} com fotos. Dados (Apenas para seu conhecimento interno): ${JSON.stringify(sentProductsData.map(p => ({name: p.name, visualGuideUrls: p.visualGuideUrls, customAttributes: p.customAttributes})))}`;
            } else {
                toolResult = "Nenhum produto encontrado.";
            }
        } else if (command.action === 'send_visual_guide') {
            if (command.url) {
                if (channel !== 'web') {
                    await wwebjsService.sendImage(businessConfig._id, from, command.url, command.message || "Aqui está o guia visual principal.");
                }
                toolResult = "SUCESSO: Primeira imagem do guia visual enviada. Aguarde o cliente escolher a opção ou pedir mais imagens se houver.";
            } else {
                toolResult = "Erro: url não fornecida.";
            }
        } else if (command.action === 'send_more_visual_guides') {
            if (command.urls && Array.isArray(command.urls) && command.urls.length > 0) {
                if (channel !== 'web') {
                    const urlsToSend = command.urls.slice(0, 5); // Limita a 5 imagens
                    if (command.message) {
                        await sendUnifiedMessage(from, command.message, provider, businessConfig._id);
                    }
                    for (let url of urlsToSend) {
                        await wwebjsService.sendImage(businessConfig._id, from, url, "");
                    }
                }
                toolResult = `SUCESSO: ${Math.min(command.urls.length, 5)} imagens adicionais do guia visual enviadas.`;
            } else {
                toolResult = "Erro: urls não fornecidas ou array vazio.";
            }
        } else if (command.action === 'add_tag') {
            if (command.tag) {
                // Encontrar a Tag ou criar
                let tagDoc = await import('../models/Tag.js').then(m => m.default).then(Tag => Tag.findOne({ businessId: businessConfig._id, name: command.tag }));
                if (!tagDoc) {
                    const Tag = (await import('../models/Tag.js')).default;
                    tagDoc = await Tag.create({ businessId: businessConfig._id, name: command.tag, color: '#A0AEC0' });
                }
                // Adicionar ao contato
                await Contact.updateOne(
                    contactQuery,
                    { $addToSet: { tags: tagDoc._id } }
                );
                toolResult = `SUCESSO: Tag "${command.tag}" adicionada ao contato.`;
            } else {
                toolResult = "Erro: tag não fornecida.";
            }
        } else {
            toolResult = `Erro: comando ${command.action} não reconhecido.`;
        }
    } catch (e) {
        console.error("Erro ao executar tool via executeAITool:", e);
        toolResult = "Falha ao executar ferramenta.";
    }

    return toolResult;
};

export { checkAvailability, createAppointmentByAI, getFreeSlots, searchProducts };
