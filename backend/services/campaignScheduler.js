import cron from 'node-cron';
import mongoose from 'mongoose';
import Campaign from '../models/Campaign.js';
import CampaignLog from '../models/CampaignLog.js';
import Contact from '../models/Contact.js';
import Appointment from '../models/Appointment.js';
import BusinessConfig from '../models/BusinessConfig.js';
import { callDeepSeek } from './aiService.js';
import { sendUnifiedMessage } from './responseService.js';
import { sendImage } from './wwebjsService.js';
import { getLastMessages } from './message.js';

// Runs every minute to check for triggers
const CRON_EXPRESSION = '* * * * *';

// === HELPER: CLEAN AI THOUGHTS (Consolidated Logic) ===
const stripThinking = (text) => {
  if (!text) return "";
  let clean = text;
  clean = clean.replace(/```json/g, '').replace(/```/g, '');
  clean = clean.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  if (clean.includes('<thinking>')) clean = clean.split('<thinking>')[0];
  clean = clean.replace(/<\/thinking>/gi, '');
  return clean.trim();
};

async function processCampaigns() {
  try {
    console.log('⏳ [Scheduler] Verificando campanhas automáticas...');
    // Prevent re-entrancy race conditions
    const campaigns = await Campaign.find({
      isActive: true,
      processing: { $ne: true }
    });

    for (const campaign of campaigns) {
      try {
        if (campaign.triggerType === 'time') {
          await processTimeCampaign(campaign);
        } else if (campaign.triggerType === 'event') {
          await processEventCampaign(campaign);
        }
      } catch (err) {
        console.error(`❌ Error processing campaign ${campaign._id}:`, err);
        // Unlock on error so it can be picked up again or fixed
        await Campaign.updateOne({ _id: campaign._id }, { processing: false });
      }
    }
  } catch (error) {
    console.error('❌ Error in CampaignScheduler:', error);
  }
}

async function processTimeCampaign(campaign) {
  // CORREÇÃO: Usar findById com o businessId
  const config = await BusinessConfig.findById(campaign.businessId);
  if (!config) {
      console.log(`⚠️ [Scheduler] Empresa não encontrada para a campanha: ${campaign.name}`);
      return;
  }

  const timeZone = config.operatingHours?.timezone || 'America/Sao_Paulo';
  const now = new Date();
  let shouldTrigger = false;

  const frequency = campaign.schedule?.frequency;

  if (['minutes_1', 'minutes_30', 'hours_1', 'hours_6', 'hours_12'].includes(frequency)) {
    // INTERVAL LOGIC
    const lastRun = campaign.stats?.lastRun ? new Date(campaign.stats.lastRun) : null;
    let intervalMs = 0;

    switch (frequency) {
      case 'minutes_1': intervalMs = 60 * 1000; break;
      case 'minutes_30': intervalMs = 30 * 60 * 1000; break;
      case 'hours_1': intervalMs = 60 * 60 * 1000; break;
      case 'hours_6': intervalMs = 6 * 60 * 60 * 1000; break;
      case 'hours_12': intervalMs = 12 * 60 * 60 * 1000; break;
    }

    if (!lastRun || (now.getTime() - lastRun.getTime()) >= intervalMs) {
      shouldTrigger = true;
      await Campaign.updateOne({ _id: campaign._id }, { processing: true });
      campaign.tempNextRun = new Date(now.getTime() + intervalMs);
    }
  } else {
    // CLOCK TIME LOGIC
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone, hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false
    });

    const parts = formatter.formatToParts(now);
    const hour = parts.find(p => p.type === 'hour').value;
    const minute = parts.find(p => p.type === 'minute').value;
    const weekdayStr = parts.find(p => p.type === 'weekday').value;
    const currentHM = `${hour}:${minute}`;

    const daysMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    const currentDay = daysMap[weekdayStr];

    if (campaign.schedule.days.length > 0 && !campaign.schedule.days.includes(currentDay)) return;

    if (campaign.schedule.time === currentHM) {
      shouldTrigger = true;
      await Campaign.updateOne({ _id: campaign._id }, { processing: true });
    }
  }

  if (!shouldTrigger) return;

  console.log(`🎯 Triggering TIME campaign: ${campaign.name}`);

  // 1. Exclusion Logic (Batch optimization)
  let excludedContactIds = [];

  if (campaign.type === 'broadcast') {
    excludedContactIds = await CampaignLog.find({ campaignId: campaign._id }).distinct('contactId');
  } else if (campaign.type === 'recurring') {
    const intradayFreqs = ['minutes_1', 'minutes_30', 'hours_1', 'hours_6', 'hours_12'];
    if (!intradayFreqs.includes(campaign.schedule?.frequency)) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      excludedContactIds = await CampaignLog.find({
        campaignId: campaign._id,
        sentAt: { $gte: today }
      }).distinct('contactId');
    }
  }

  // 2. Find Targets (Exclude "Não Perturbe" / "Nao Perturbe")
  const contacts = await Contact.find({
    businessId: config._id,
    tags: {
      $in: campaign.targetTags,
      $nin: [/n[ãa]o perturbe/i] // Regra de exclusão opt-out
    },
    isHandover: false,
    phone: { $exists: true, $ne: null },
    _id: { $nin: excludedContactIds }
  });

  console.log(`👥 Found ${contacts.length} targets for ${campaign.name}`);

  // 3. Process Batch
  const BATCH_SIZE = 50;
  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE);

    // Process each contact in batch
    // We do sequential dispatch per batch to not overload, but parallel inside batch could be an option.
    // Sticking to sequential for safety with AI rate limits.
    for (const contact of batch) {
      await dispatchCampaign(campaign, contact, null, config);
    }
  }

  // 4. Update Campaign Status
  const updateData = { 'stats.lastRun': now, processing: false };
  if (campaign.schedule?.frequency === 'once') {
    updateData.status = 'completed';
    updateData.isActive = false;
  } else {
    updateData.status = 'active';
    if (campaign.tempNextRun) updateData.nextRun = campaign.tempNextRun;
  }
  await Campaign.updateOne({ _id: campaign._id }, updateData);
}

async function processEventCampaign(campaign) {
  // CORREÇÃO 1: Usar findById para a configuração
  const config = await BusinessConfig.findById(campaign.businessId);
  if (!config) {
      console.log(`⚠️ [Scheduler] Empresa não encontrada para a campanha: ${campaign.name}`);
      return;
  }

  const now = new Date();
  const offsetMinutes = campaign.eventOffset || 0;
  const startRange = new Date(now.getTime() + offsetMinutes * 60000);
  const endRange = new Date(startRange.getTime() + 60000);

  // CORREÇÃO 2: Buscar a agenda por businessId e não userId
  const appointments = await Appointment.find({
    businessId: campaign.businessId, 
    status: { $in: campaign.eventTargetStatus },
    start: { $gte: startRange, $lt: endRange }
  });

  if (appointments.length === 0) return;

  console.log(`📅 Found ${appointments.length} appointments for EVENT campaign: ${campaign.name}`);

  for (const appt of appointments) {
    // Find or create temp contact wrapper
    let contact = await Contact.findOne({ businessId: config._id, phone: appt.clientPhone });

    if (contact && contact.isHandover) continue;

    // Check if already sent for this specific appointment ID
    const alreadySent = await CampaignLog.exists({
      campaignId: campaign._id,
      relatedId: appt._id.toString()
    });

    if (alreadySent) continue;

    const targetContact = contact || {
      _id: null,
      phone: appt.clientPhone,
      name: appt.clientName,
      businessId: config._id
    };

    await dispatchCampaign(campaign, targetContact, appt, config);
  }
}

async function dispatchCampaign(campaign, contact, appointment, config) {
  // --- AI GENERATION WITH HISTORY CONTEXT ---
  let messageToSend = campaign.message;

  if (campaign.contentMode === 'ai_prompt') {
    try {
      // 1. Fetch History (Last 10 messages)
      // We use the phone number or contact ID to fetch history
      const identifier = contact.phone || contact._id;
      const rawHistory = await getLastMessages(identifier, 10, config._id, 'whatsapp');

      // Format history for the prompt
      const historyText = rawHistory.reverse().map(m =>
        `${m.role === 'bot' || m.role === 'assistant' ? 'Assistant' : 'User'}: "${m.content}"`
      ).join('\n');

      // 2. Build Smart Prompt
      const prompt = [
        {
          role: 'system',
          content: `
You are a marketing assistant for ${config.businessName || 'a business'}.
CONTEXT: You are sending a campaign message to ${contact.name || 'a client'}.

CAMPAIGN GOAL: "${campaign.message}"

--- CONVERSATION HISTORY ---
${historyText || "No previous history."}

--- RULES ---
1. **CHECK HISTORY:** Look at what was last sent. If we already offered this, do NOT repeat the same phrase. Change the angle.
2. **NO ROBOTS:** Write natural, short, engaging copy.
3. **ANTI-REPETITION:** If the history shows the user already rejected this offer, do not offer again. Just check in on them.
4. **THINKING:** Use <thinking>...</thinking> to plan, but it will be hidden.
`
        },
        {
          role: 'user',
          content: "Generate the campaign message now."
        }
      ];

      // 3. Call AI
      const rawResponse = await callDeepSeek(prompt, appointment.userId || contact.businessId);

      // 4. Strip Thoughts
      messageToSend = stripThinking(rawResponse);

      // Safety Fallback
      if (!messageToSend) messageToSend = campaign.message; // Fallback to raw prompt if AI fails

    } catch (e) {
      console.error('⚠️ Campaign AI failed, using static fallback:', e.message);
      messageToSend = campaign.message;
    }
  } else {
    // Static Replacements
    const contactName = contact.name || '';
    if (appointment) {
      messageToSend = messageToSend
        .replace(/\{\{name\}\}/gi, appointment.clientName || contactName)
        .replace(/\{nome\}/gi, appointment.clientName || contactName)
        .replace(/\{\{time\}\}/gi, new Date(appointment.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } else {
      messageToSend = messageToSend
        .replace(/\{\{name\}\}/gi, contactName)
        .replace(/\{nome\}/gi, contactName);
    }
  }

  // --- DISPATCH ---
  // Jitter (Delay randômico anti-ban): entre 3s e 8s a menos que campaign.delayRange mude isso especificamente
  const minDelay = (campaign.delayRange?.min !== undefined ? campaign.delayRange.min : 3) * 1000;
  const maxDelay = (campaign.delayRange?.max !== undefined ? campaign.delayRange.max : 8) * 1000;
  let delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

  if (process.env.NODE_ENV === 'test') delay = 0;

  // Helper to wait
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  console.log(`⏳ Sending to ${contact.phone} in ${delay}ms`);

  setTimeout(async () => {
    try {
      let sent = false;
      const mediaUrls = campaign.mediaUrls || [];
      const mediaOrder = campaign.mediaOrder || 'image_with_caption';
      let textAlreadySent = false;

      const sendImages = async (urls, withCaptionOnFirst = false) => {
        for (let i = 0; i < urls.length; i++) {
          if (i > 0) await wait(Math.floor(Math.random() * 2000) + 2000); // 2-4s delay between multiple images
          const caption = (withCaptionOnFirst && i === 0) ? messageToSend : undefined;
          try {
            const imageSent = await sendImage(campaign.businessId, contact.phone, urls[i], caption);
            if (!imageSent) throw new Error("sendImage returned false");
            if (caption) textAlreadySent = true;
          } catch (imageErr) {
            console.error(`⚠️ Erro ao enviar imagem ${urls[i]} para ${contact.phone}:`, imageErr);
          }
        }
      };

      if (mediaUrls.length > 0) {
        if (mediaOrder === 'image_with_caption') {
          await sendImages(mediaUrls, true);
          if (!textAlreadySent && messageToSend) {
            // Fallback if image fails but we need to send text
            await wait(1000);
            sent = await sendUnifiedMessage(contact.phone, messageToSend, 'wwebjs', campaign.businessId);
          } else {
            sent = true;
          }
        } else if (mediaOrder === 'image_first') {
          await sendImages(mediaUrls, false);
          if (messageToSend) {
            await wait(Math.floor(Math.random() * 2000) + 2000);
            sent = await sendUnifiedMessage(contact.phone, messageToSend, 'wwebjs', campaign.businessId);
          } else {
            sent = true;
          }
        } else if (mediaOrder === 'text_first') {
          if (messageToSend) {
            sent = await sendUnifiedMessage(contact.phone, messageToSend, 'wwebjs', campaign.businessId);
            textAlreadySent = true;
            await wait(Math.floor(Math.random() * 2000) + 2000);
          }
          await sendImages(mediaUrls, false);
          sent = true;
        } else if (mediaOrder === 'only_image') {
          await sendImages(mediaUrls, false);
          sent = true;
        }
      } else {
        // No media, just send text
        if (messageToSend) {
          sent = await sendUnifiedMessage(contact.phone, messageToSend, 'wwebjs', campaign.businessId);
        } else {
          sent = true; // Nothing to send
        }
      }

      const status = sent ? 'sent' : 'failed';

      await CampaignLog.create({
        campaignId: campaign._id,
        contactId: contact._id || new mongoose.Types.ObjectId(),
        relatedId: appointment ? appointment._id.toString() : null,
        messageContent: messageToSend || "[Midia]",
        status: status,
        sentAt: new Date()
      });
    } catch (err) {
      console.error(`💥 Campaign send error for ${contact.phone}:`, err);

      // Ultimate Fallback: Try to send text if everything exploded
      if (messageToSend && err.message !== "Ultimate fallback attempt") {
        try {
          await sendUnifiedMessage(contact.phone, messageToSend, 'wwebjs', campaign.businessId);
        } catch (e) {
          console.error("Ultimate text fallback failed:", e);
        }
      }

      await CampaignLog.create({
        campaignId: campaign._id,
        contactId: contact._id || new mongoose.Types.ObjectId(),
        status: 'failed',
        error: err.message
      });
    }
  }, delay);
}

function initScheduler() {
  cron.schedule(CRON_EXPRESSION, processCampaigns);
  console.log('🚀 Campaign Scheduler initialized.');
}

export { initScheduler, processCampaigns, dispatchCampaign};