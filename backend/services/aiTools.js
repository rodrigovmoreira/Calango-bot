const Appointment = require('../models/Appointment');
const BusinessConfig = require('../models/BusinessConfig');
const { toZonedTime } = require('date-fns-tz');

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

// 4. FERRAMENTA: Buscar Produtos (Mantido igual, funciona bem)
const searchProducts = async (userId, keywords = []) => {
    try {
        const config = await BusinessConfig.findOne({ userId });
        if (!config || !config.products) return [];

        const searchTerms = keywords.map(k => k.trim().toLowerCase()).filter(k => k.length > 0);
        if (searchTerms.length === 0) return [];

        const results = config.products.filter(p => {
            const productName = p.name.trim().toLowerCase();
            const productTags = (p.tags || []).map(t => t.trim().toLowerCase());
            return searchTerms.some(term => productName.includes(term) || productTags.some(tag => tag.includes(term)));
        });

        return results.map(p => ({
            name: p.name,
            price: p.price,
            durationMinutes: p.durationMinutes || 60,
            description: p.description,
            imageUrls: p.imageUrls || [],
            variations: p.variations || []
        }));
    } catch (error) {
        console.error("Erro searchProducts:", error);
        return [];
    }
};

module.exports = {
    checkAvailability,
    createAppointmentByAI,
    getFreeSlots,
    searchProducts
};