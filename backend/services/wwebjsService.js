import fs from 'fs';
import pkg from 'whatsapp-web.js';
const { Client, RemoteAuth, MessageMedia } = pkg;
import mongoose from 'mongoose';
//import { MongoStore } from 'wwebjs-mongo';
import UnifiedMongoStore from './UnifiedMongoStore.js';
import { adaptWWebJSMessage } from './providerAdapter.js';
import BusinessConfig from '../models/BusinessConfig.js';

// MAPAS DE ESTADO
const sessions = new Map();
const qrCodes = new Map();
const statuses = new Map();
const timeouts = new Map();

let ioInstance;

const initializeWWebJS = async (io) => {
  ioInstance = io;
};

const startSession = async (businessIdRaw) => {
  // 0. NORMALIZAÇÃO DE ID (CRÍTICO)
  // Garante que seja sempre string para evitar duplicidade entre ObjectId vs String
  const businessId = businessIdRaw.toString();

  //cleanUpTempFolders(businessId);

  // 1. BLINDAGEM CONTRA DUPLICIDADE
  if (sessions.has(businessId)) {
    console.log(`🛡️ Sessão ${businessId} já está online. Ignorando start duplicado.`);
    return sessions.get(businessId);
  }

  // 2. BLINDAGEM CONTRA RACE CONDITION
  if (statuses.get(businessId) === 'initializing') {
    console.log(`🛡️ Sessão ${businessId} já está inicializando. Chamada duplicada ignorada.`);
    return;
  }

  // 3. A TRAVA DE SEGURANÇA
  updateStatus(businessId, 'initializing');
  console.log(`▶️ Iniciando sessão BLINDADA para: ${businessId}`);

  // --- RESTO DO CÓDIGO (SEGUE IGUAL) ---

  const authPath = './.wwebjs_auth';
  if (!fs.existsSync(authPath)) {
    try {
      fs.mkdirSync(authPath, { recursive: true });
    } catch (err) {
      console.error('❌ Falha ao criar pasta .wwebjs_auth:', err);
    }
  }

  const config = await BusinessConfig.findOne({ businessId });
  if (!config) {
    console.error(`❌ Config não encontrada para UserID: ${businessId}`);
    updateStatus(businessId, 'error');
    return;
  }

  // 4. The 'QR Timeout' Safety Valve
  if (timeouts.has(businessId)) {
    clearTimeout(timeouts.get(businessId));
    timeouts.delete(businessId);
  }

  // Set new timeout (120 seconds)
  const timeoutId = setTimeout(async () => {
    const currentStatus = statuses.get(businessId);
    console.log(`⏱️ Timeout de conexão para User ${businessId}. Status atual: ${currentStatus}`);

    if (currentStatus === 'initializing' || currentStatus === 'qrcode') {
      console.warn(`⚠️ Forçando destruição por timeout (User ${businessId})`);

      const clientToDestroy = sessions.get(businessId);
      if (clientToDestroy) {
        try {
          await clientToDestroy.destroy();
        } catch (e) {
          console.error(`Erro ao destruir por timeout: ${e.message}`);
        }
      }

      cleanupSession(businessId);

      if (ioInstance) {
        ioInstance.to(businessId).emit('connection_timeout', { message: 'Tempo limite excedido. Tente novamente.' });
        ioInstance.to(businessId).emit('wwebjs_status', 'disconnected');
      }
    }
  }, 120000); // 2 minutes

  timeouts.set(businessId, timeoutId);

  const client = new Client({
    authStrategy: new RemoteAuth({
      clientId: businessId,
      store: new UnifiedMongoStore({ mongoose: mongoose }),
      backupSyncIntervalMs: 300000,
      dataPath: './.wwebjs_auth'
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-component-extensions-with-background-pages',
        '--disable-default-apps',
        '--mute-audio',
        '--no-default-browser-check',
        '--autoplay-policy=user-gesture-required',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-notifications',
        '--disable-background-networking',
        '--disable-breakpad',
        '--disable-component-update',
        '--disable-domain-reliability',
        '--disable-sync',
        '--disable-remote-fonts',
        '--blink-settings=imagesEnabled=false',
        '--disable-software-rasterizer',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      executablePath: process.env.CHROME_BIN || undefined
    }
  });

  sessions.set(businessId, client);

  client.on('qr', (qr) => {
    qrCodes.set(businessId, qr);
    updateStatus(businessId, 'qrcode');
    if (ioInstance) ioInstance.to(businessId).emit('wwebjs_qr', qr);
  });

  client.on('ready', () => {
    if (timeouts.has(businessId)) {
      clearTimeout(timeouts.get(businessId));
      timeouts.delete(businessId);
    }
    updateStatus(businessId, 'ready');
    qrCodes.delete(businessId);
  });

  client.on('authenticated', () => {
    if (timeouts.has(businessId)) {
      clearTimeout(timeouts.get(businessId));
      timeouts.delete(businessId);
    }
    updateStatus(businessId, 'authenticated');
    qrCodes.delete(businessId);
  });

  client.on('auth_failure', () => {
    console.error(`❌ Falha de autenticação para: ${config.businessName}`);
    updateStatus(businessId, 'disconnected');
  });

  client.on('message', async (msg) => {
    // 🛡️ IRON GATE: Global Block for Non-Contact Messages
    // 1. Block Groups (@g.us)
    // 2. Block Status Updates (status@broadcast)
    // 3. Block Channels/Newsletters (@newsletter)
    const isInvalidSource =
      msg.from.includes('@g.us') ||
      msg.from === 'status@broadcast' ||
      msg.from.includes('@newsletter');

    // 4. Block Technical/Community IDs (Length Check)
    // Standard phone numbers (even international) are rarely > 15 digits.
    // Community/Technical IDs (like 120363335026718801) are usually 18+ digits.
    const numericPart = msg.from.replace(/\D/g, '');
    const isTooLong = numericPart.length > 15;

    if (isInvalidSource || isTooLong) {
      // console.log(`🚫 Iron Gate: Blocked message from ${msg.from}`);
      return; // STOP execution immediately.
    }

    if (msg.type === 'e2e_notification' || msg.type === 'notification_template') return;
    try {
      const { handleIncomingMessage } = await import('../messageHandler.js');
      const normalizedMsg = await adaptWWebJSMessage(msg);
      await handleIncomingMessage(normalizedMsg, config._id);
    } catch (error) {
      console.error(`Erro message:`, error);
    }
  });

  client.on('disconnected', async (reason) => {
    await stopSession(businessId);
  });

  try {
    await client.initialize();
  } catch (e) {
    console.error(`Erro fatal ao iniciar cliente ${businessId}:`, e.message);
    sessions.delete(businessId);
    updateStatus(businessId, 'error');
  }
};

// 2. FUNÇÃO DE PARADA BLINDADA (A Mágica acontece aqui)
const stopSession = async (businessId) => {
  const client = sessions.get(businessId.toString());

  if (client) {
    // Atualiza status para evitar que o usuário tente reconectar enquanto fecha
    updateStatus(businessId, 'disconnecting');

    try {
      // Tenta logout limpo (pode falhar no Windows por EBUSY)
      await client.logout();
    } catch (e) {
      // Ignora erros de logout, pois vamos destruir o cliente de qualquer jeito
    }

    try {
      // Força o fechamento do navegador (Libera RAM)
      await client.destroy();
    } catch (e) {
      console.warn(`⚠️ Erro ao destruir cliente (não crítico): ${e.message}`);
    }
  }

  // 3. LIMPEZA DE MEMÓRIA (Essencial para não vazar memória)
  cleanupSession(businessId);
};

const cleanupSession = (businessId) => {
  if (timeouts.has(businessId)) {
    clearTimeout(timeouts.get(businessId));
    timeouts.delete(businessId);
  }
  sessions.delete(businessId);
  qrCodes.delete(businessId);
  statuses.delete(businessId);
  updateStatus(businessId, 'disconnected');
};

const sendWWebJSMessage = async (businessId, to, message) => {
  const client = sessions.get(businessId.toString());

  if (!client) {
    console.warn(`⚠️ Envio falhou: Negócio ${businessId} não tem sessão ativa.`);
    return false;
  }

  if (!client.info) {
    console.warn(`⚠️ Envio falhou: WhatsApp do Negócio ${businessId} ainda não está pronto.`);
    return false;
  }

  try {
    let formattedNumber = to.replace(/\D/g, '');
    if (!formattedNumber.includes('@c.us')) formattedNumber = `${formattedNumber}@c.us`;

    // FIX: Pass { sendSeen: false } to prevent crash on 'markedUnread'
    await client.sendMessage(formattedNumber, message, { sendSeen: false });
    return true;
  } catch (error) {
    console.error(`💥 Erro envio WWebJS (User ${businessId}):`, error.message);
    return false;
  }
};

// 4. FUNÇÃO DE ENVIO DE IMAGEM (Novo - Changelog 4)
const sendImage = async (businessId, to, imageUrl, caption) => {
  const client = sessions.get(businessId.toString());

  if (!client || !client.info) {
    console.warn(`⚠️ Envio de imagem falhou: Sessão ${businessId} indisponível.`);
    return false;
  }

  try {
    // Formata número
    let formattedNumber = to.replace(/\D/g, '');
    if (!formattedNumber.includes('@c.us')) formattedNumber = `${formattedNumber}@c.us`;

    // Baixa e prepara a mídia
    const media = await MessageMedia.fromUrl(imageUrl);

    // Envia com legenda (se houver)
    // FIX: Pass { sendSeen: false } to prevent crash on 'markedUnread'
    await client.sendMessage(formattedNumber, media, { caption: caption || "", sendSeen: false });
    return true;

  } catch (error) {
    console.error(`💥 Erro ao enviar imagem (User ${businessId}):`, error.message);
    return false;
  }
}; // <--- AQUI É O FIM DA FUNÇÃO DE IMAGEM


// 5. FUNÇÃO DE ESTADO "DIGITANDO..." (UX / Humanização)
const sendStateTyping = async (businessId, to) => {
  const client = sessions.get(businessId.toString());

  if (!client || !client.info) {
    return false;
  }

  try {
    let formattedNumber = to.replace(/\D/g, '');
    if (!formattedNumber.includes('@c.us')) formattedNumber = `${formattedNumber}@c.us`;

    const chat = await client.getChatById(formattedNumber);
    // Dispara o status "digitando..." (o WWebJS mantém isso por alguns segundos ou até enviar mensagem)
    await chat.sendStateTyping();
    return true;
  } catch (error) {
    console.error(`💥 Erro ao enviar status 'digitando' (User ${businessId}):`, error.message);
    return false;
  }
};

// --- LABEL MANAGEMENT (Stage 1 Refactor) ---

const getLabels = async (businessId) => {
  const client = sessions.get(businessId.toString());
  if (!client || !client.info) {
    console.warn(`⚠️ getLabels falhou: Sessão ${businessId} não pronta.`);
    return [];
  }
  try {
    // Returns Promise<Label[]>
    return await client.getLabels();
  } catch (error) {
    console.error(`💥 Erro ao obter labels (User ${businessId}):`, error.message);
    return [];
  }
};

const updateLabel = async (businessId, labelId, name, hexColor) => {
  const client = sessions.get(businessId.toString());
  if (!client || !client.info) {
    throw new Error(`Sessão ${businessId} não pronta.`);
  }

  const labels = await client.getLabels();
  const label = labels.find(l => l.id === labelId);

  if (!label) {
    throw new Error(`Label ${labelId} não encontrada.`);
  }

  // Update properties
  label.name = name;
  label.hexColor = hexColor;

  // Persist changes if method exists (Standard WWebJS Label)
  if (typeof label.save === 'function') {
    await label.save();
  } else {
    console.warn(`⚠️ Label.save() não disponível para User ${businessId}. Tentando fallback de edição...`);
    // Fallback logic if needed, but assuming standard support per request
  }
  return label;
};

const deleteLabel = async (businessId, labelId) => {
  const client = sessions.get(businessId.toString());
  if (!client || !client.info) throw new Error(`Sessão ${businessId} não pronta.`);

  const labels = await client.getLabels();
  const label = labels.find(l => l.id === labelId);

  if (label && typeof label.delete === 'function') {
    await label.delete();
  } else {
    throw new Error(`Label ${labelId} não encontrada ou não deletável.`);
  }
};

const setChatLabels = async (businessId, chatId, labelIds) => {
  const client = sessions.get(businessId.toString());
  if (!client || !client.info) throw new Error(`Sessão ${businessId} não pronta.`);

  const chat = await client.getChatById(chatId);

  // Use the method confirmed to exist in Chat.js
  if (chat && typeof chat.changeLabels === 'function') {
    return await chat.changeLabels(labelIds);
  } else {
    console.warn(`⚠️ Chat ${chatId} não suporta changeLabels ou não encontrado.`);
  }
};

const getChatLabels = async (businessId, chatId) => {
  const client = sessions.get(businessId.toString());
  if (!client || !client.info) throw new Error(`Sessão ${businessId} não pronta.`);

  const chat = await client.getChatById(chatId);
  if (chat && typeof chat.getLabels === 'function') {
    return await chat.getLabels();
  } else {
    console.warn(`⚠️ Chat ${chatId} não suporta getLabels ou não encontrado.`);
    return [];
  }
};

const closeAllSessions = async () => {
  for (const [businessId, client] of sessions.entries()) {
    try {
      // No shutdown do servidor, usamos destroy() em vez de logout()
      // para não perder a conexão (QR Code) na próxima reinicialização
      await client.destroy();
    } catch (e) {
      console.error(`-> Erro ao fechar ${businessId}:`, e.message);
    }
  }
  sessions.clear();
};

const updateStatus = (businessId, status) => {
  statuses.set(businessId, status);
  if (ioInstance) {
    ioInstance.to(businessId).emit('wwebjs_status', status);
  }
};

const getSessionStatus = (businessId) => statuses.get(businessId) || 'disconnected';
const getSessionQR = (businessId) => qrCodes.get(businessId);
const getClientSession = (businessId) => sessions.get(businessId.toString());

export {
  initializeWWebJS,
  startSession,
  stopSession,
  getSessionStatus,
  getSessionQR,
  getClientSession,
  sendWWebJSMessage,
  sendImage,
  sendStateTyping,
  closeAllSessions,
  getLabels,
  updateLabel,
  deleteLabel,
  setChatLabels,
  getChatLabels
};