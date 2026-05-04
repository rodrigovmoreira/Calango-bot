import Appointment from '../models/Appointment.js';
import BusinessConfig from '../models/BusinessConfig.js';
import { toZonedTime } from 'date-fns-tz';

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

        const config = await BusinessConfig.findOne({ userId });

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
        const config = await BusinessConfig.findOne({ userId });
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

export { checkAvailability, createAppointmentByAI, getFreeSlots, searchProducts };