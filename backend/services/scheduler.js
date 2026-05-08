import cron from 'node-cron';
import BusinessConfig from '../models/BusinessConfig.js';
import Contact from '../models/Contact.js';
import Appointment from '../models/Appointment.js';
import { saveMessage, getLastMessages } from './message.js';
import { sendUnifiedMessage } from './responseService.js';
import { callDeepSeek } from './aiService.js';

// === HELPER: Calcular Data Alvo ===
function calculateTriggerTime(appointment, rule) {
    const baseTime = rule.triggerDirection === 'before' ? new Date(appointment.start) : new Date(appointment.end);
    const offset = rule.triggerOffset;

    // Clona a data base para não mutar o objeto original
    const target = new Date(baseTime);

    if (rule.triggerDirection === 'before') {
        // Subtrai tempo
        if (rule.triggerUnit === 'minutes') target.setMinutes(target.getMinutes() - offset);
        if (rule.triggerUnit === 'hours') target.setHours(target.getHours() - offset);
        if (rule.triggerUnit === 'days') target.setDate(target.getDate() - offset);
    } else {
        // Adiciona tempo (after)
        if (rule.triggerUnit === 'minutes') target.setMinutes(target.getMinutes() + offset);
        if (rule.triggerUnit === 'hours') target.setHours(target.getHours() + offset);
        if (rule.triggerUnit === 'days') target.setDate(target.getDate() + offset);
    }

    return target;
}

// === HELPER: Formatar Mensagem ===
function formatMessage(template, appointment, timezone = 'America/Sao_Paulo') {
    let msg = template;
    const dateStr = new Date(appointment.start).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: timezone
    });

    msg = msg.replace(/{clientName}/g, appointment.clientName || 'Cliente');
    msg = msg.replace(/{appointmentTime}/g, dateStr);
    msg = msg.replace(/{serviceName}/g, appointment.title || 'Agendamento');

    return msg;
}

// === LÓGICA DE PROCESSAMENTO EM LOTE (BATTERY OPTIMIZED) ===
async function processConfigBatch(configs) {
    if (!configs || configs.length === 0) return;

    // 1. Coleta IDs para buscar tudo em 2 queries (vs N queries)
    const businessIds = [];

    // Mapas para acesso rápido O(1)
    const configByBusinessId = new Map();

    for (const config of configs) {
        if (config._id) {
            businessIds.push(config._id);
            configByBusinessId.set(config._id.toString(), config);
        }
        businessIds.push(config._id);
        configByBusinessId.set(config._id.toString(), config);
    }

    // 2. Busca Agendamentos em Lote (Otimização A)
    const recentStart = new Date();
    recentStart.setDate(recentStart.getDate() - 30); // 30 dias atrás

    // Query unificada
    const allAppointments = await Appointment.find({
        businessId: { $in: businessIds },
        status: { $in: ['scheduled', 'confirmed', 'completed', 'followup_pending'] },
        start: { $gte: recentStart }
    });

    // Agrupa por userId
    const appointmentsByBusinessId = new Map();
    for (const appt of allAppointments) {
        const bid = appt.businessId.toString();
        if (!appointmentsByBusinessId.has(bid)) appointmentsByBusinessId.set(bid, []);
        appointmentsByBusinessId.get(bid).push(appt);
    }

    // 3. Busca Contatos em Lote (Otimização B)
    // Query unificada
    const allContacts = await Contact.find({
        businessId: { $in: businessIds },
        followUpActive: true,
        lastResponseTime: { $exists: true }
    });

    // Agrupa por businessId
    const contactsByBusinessId = new Map();
    for (const contact of allContacts) {
        const bid = contact.businessId.toString();
        if (!contactsByBusinessId.has(bid)) contactsByBusinessId.set(bid, []);
        contactsByBusinessId.get(bid).push(contact);
    }

    // 4. Itera sobre os Configs e processa usando os dados em memória
    for (const config of configs) {
        if (!config._id) continue;

        // --- A. NOTIFICAÇÕES (APPOINTMENTS) ---
        if (config.notificationRules && config.notificationRules.length > 0) {
            const appointments = appointmentsByBusinessId.get(config._id.toString()) || [];

            for (const appt of appointments) {
                for (const rule of config.notificationRules) {
                    if (!rule.isActive) continue;

                    // Verifica se já enviou esta regra
                    if (appt.notificationHistory && appt.notificationHistory.get(rule.id)) {
                        continue;
                    }

                    const triggerTime = calculateTriggerTime(appt, rule);
                    const now = new Date();

                    if (now >= triggerTime) {
                        const diffHours = (now - triggerTime) / 1000 / 60 / 60;
                        if (diffHours > 24) continue; // Ignora muito antigos

                        const tz = config.operatingHours?.timezone || 'America/Sao_Paulo';
                        const message = formatMessage(rule.messageTemplate, appt, tz);

                        await sendUnifiedMessage(
                            appt.clientPhone,
                            message,
                            config.whatsappProvider,
                            config._id
                        );

                        if (!appt.notificationHistory) appt.notificationHistory = new Map();
                        appt.notificationHistory.set(rule.id, now);
                        await appt.save();

                        await saveMessage(appt.clientPhone, 'bot', message, 'text', null, config._id);
                    }
                }
            }
        }

        // --- B. FOLLOW-UP (CONTACTS) ---
        if (config.followUpSteps && config.followUpSteps.length > 0) {
            const pendingContacts = contactsByBusinessId.get(config._id.toString()) || [];

            for (const contact of pendingContacts) {
                const now = new Date();
                const lastMsgTime = new Date(contact.lastResponseTime);
                const minutesSinceLastMsg = (now - lastMsgTime) / 1000 / 60;

                const nextStepIndex = contact.followUpStage ? contact.followUpStage : 0;
                const nextStep = config.followUpSteps[nextStepIndex];

                if (!nextStep) {
                    contact.followUpActive = false;
                    await contact.save();
                    continue;
                }

                if (minutesSinceLastMsg >= nextStep.delayMinutes) {

                    let messageToSend = nextStep.message;

                    // 🧠 SE O USUÁRIO MARCOU "USAR IA" NA TELA DE INTELIGÊNCIA:
                    if (nextStep.useAI) {
                        try {
                            // 1. Busca as últimas 6 mensagens para a IA saber em que pé parou a conversa
                            const history = await getLastMessages(contact.phone, 6, config._id, contact.channel || 'whatsapp');
                            let historyText = "";
                            if (history && history.length > 0) {
                                history.reverse().forEach(msg => {
                                    const roleName = msg.role === 'user' ? 'Cliente' : 'Assistente';
                                    historyText += `${roleName}: "${msg.content.replace(/\n/g, ' ')}"\n`;
                                });
                            }

                            // 2. Monta a ordem para a IA
                            const prompt = `
Você é o assistente virtual da empresa. O cliente parou de responder há algum tempo.
HISTÓRICO RECENTE DA CONVERSA:
${historyText || "(Sem histórico recente)"}

INSTRUÇÃO PARA RECUPERAR O CLIENTE:
"${nextStep.message}"

SUA TAREFA:
Baseado no histórico, escreva UMA ÚNICA MENSAGEM curta e natural para enviar ao cliente agora, seguindo a instrução acima. 
Seja humano, evite parecer um robô. NÃO USE ASTERISCOS (**) NEM MARKDOWN.
`;
                            // 3. Chama o DeepSeek
                            const aiResponse = await callDeepSeek([{ role: "system", content: prompt }], contact.businessId);

                            // Limpeza simples de tags HTML/Markdown caso a IA viaje
                            let cleanResponse = aiResponse.replace(/<[^>]*>?/gm, '').replace(/\*\*/g, '').trim();

                            if (cleanResponse) {
                                messageToSend = cleanResponse;
                            }
                        } catch (aiError) {
                            console.error(`💥 Erro na IA do Follow-up (Contact ${contact.phone}):`, aiError.message);
                            // Se a IA cair, ele não envia a instrução crua, envia uma genérica de fallback
                            messageToSend = "Olá! Tudo bem? Passando para saber se ainda tem interesse ou se posso te ajudar com mais alguma dúvida.";
                        }
                    }

                    // 🚀 DISPARO DA MENSAGEM
                    await sendUnifiedMessage(
                        contact.phone,
                        messageToSend, // Mensagem Gerada ou Fixa
                        config.whatsappProvider,
                        config._id
                    );

                    await saveMessage(contact.phone, 'bot', messageToSend, 'text', null, config._id);

                    contact.followUpStage = nextStepIndex + 1;
                    contact.lastResponseTime = now;

                    await contact.save();
                }
            }
        }
    }
}

async function processSchedulerTick() {
    try {
        const configs = await BusinessConfig.find({
            businessId: { $exists: true },
            $or: [
                { notificationRules: { $exists: true, $not: { $size: 0 } } },
                { followUpSteps: { $exists: true, $not: { $size: 0 } } }
            ]
        });

        // Batch Processing: Process 50 businesses at a time to prevent massive memory spikes
        // while solving N+1 query problem.
        const BATCH_SIZE = 50;
        for (let i = 0; i < configs.length; i += BATCH_SIZE) {
            const batch = configs.slice(i, i + BATCH_SIZE);
            await processConfigBatch(batch);
        }

    } catch (error) {
        console.error('💥 Erro no Scheduler:', error);
    }
}

function startScheduler() {
    // Roda a cada minuto
    cron.schedule('* * * * *', () => {
        processSchedulerTick();
    });
}

export { startScheduler, processSchedulerTick };
