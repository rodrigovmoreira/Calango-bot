import fs from 'fs';
import { execSync } from 'child_process';
import pkg from 'whatsapp-web.js';
const { Client, RemoteAuth, MessageMedia } = pkg;
import mongoose from 'mongoose';
import axios from 'axios';
//import { MongoStore } from 'wwebjs-mongo';
import UnifiedMongoStore from './UnifiedMongoStore.js';
import { adaptWWebJSMessage } from './providerAdapter.js';
import BusinessConfig from '../models/BusinessConfig.js';

// MAPAS DE ESTADO
const sessions = new Map();
const qrCodes = new Map();
const statuses = new Map();
const timeouts = new Map();
const healthIntervals = new Map(); // Intervalos de health check por businessId

let ioInstance;
let globalHealthCheckInterval = null;

const initializeWWebJS = async (io) => {
  ioInstance = io;
};

// --- UTILITÁRIO: Mata processos Chrome órfãos (Windows + Linux) ---
const killOrphanedBrowser = (businessId) => {
  const bId = businessId.toString();
  const userDataDir = `RemoteAuth-${bId}`;
  
  try {
    if (process.platform === 'win32') {
      // Windows: usa taskkill para matar processos Chrome que estejam usando o userDataDir
      // Busca o PID via wmic e mata
      try {
        const cmd = `wmic process where "commandline like '%${userDataDir}%' and name='chrome.exe'" get processid /value`;
        const output = execSync(cmd, { timeout: 5000, encoding: 'utf8' });
        const pids = output.match(/ProcessId=(\d+)/g);
        if (pids) {
          pids.forEach(match => {
            const pid = match.split('=')[1];
            try {
              execSync(`taskkill /F /PID ${pid}`, { timeout: 3000 });
              console.log(`   -> 💀 Chrome órfão (PID ${pid}) morto no Windows.`);
            } catch (e) { /* processo já morto ou sem permissão */ }
          });
        }
      } catch (e) { /* wmic pode não estar disponível */ }
      
      // Fallback: taskkill por nome de janela (menos preciso, mas funciona)
      try {
        execSync(`taskkill /F /FI "WINDOWTITLE eq *${userDataDir}*" /IM chrome.exe 2>nul`, { timeout: 3000 });
      } catch (e) { /* ignora */ }
    } else {
      // Linux/Mac: usa pkill
      try {
        execSync(`pkill -f "${userDataDir}"`, { timeout: 3000 });
        console.log(`   -> 💀 Chrome órfão morto no Linux.`);
      } catch (e) { /* processo já morto */ }
    }
  } catch (e) { /* ignora */ }
};

// --- UTILITÁRIO: Limpeza de pastas temporárias (com retry para Windows) ---
const cleanupTempFolders = (businessId) => {
  const bId = businessId.toString();
  
  // PRIMEIRO: mata qualquer Chrome órfão que esteja segurando os arquivos
  killOrphanedBrowser(bId);
  
  // Aguarda 1s para o SO liberar os handles
  const waitAndClean = () => {
    const foldersToClean = [
      `./.wwebjs_auth/RemoteAuth-${bId}`,
      `./.wwebjs_cache/RemoteAuth-${bId}`,
    ];
  
    for (const folder of foldersToClean) {
      try {
        if (fs.existsSync(folder)) {
          fs.rmSync(folder, { recursive: true, force: true });
          console.log(`   -> 🗑️ Pasta ${folder} deletada.`);
        }
      } catch (e) {
        console.warn(`   ⚠️ Erro ao limpar ${folder}: ${e.message}`);
      }
    }
  
    // Também limpa o ZIP na raiz (fallback do RemoteAuth)
    try {
      const zipFile = `./${bId}.zip`;
      if (fs.existsSync(zipFile)) {
        fs.unlinkSync(zipFile);
      }
    } catch (e) { /* ignora */ }
  };
  
  // Tenta imediatamente
  waitAndClean();
  
  // Se ainda existir após 2s, tenta de novo (Windows pode demorar para liberar)
  setTimeout(() => {
    const stillExists = fs.existsSync(`./.wwebjs_auth/RemoteAuth-${bId}`);
    if (stillExists) {
      console.log(`   -> 🔄 Retentativa de limpeza da pasta (Windows EPERM)...`);
      killOrphanedBrowser(bId);
      setTimeout(waitAndClean, 1000);
    }
  }, 2000);
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

  // 🔧 PRE-START CHECK: Mata qualquer Chrome órfão que possa estar segurando o userDataDir
  // Isso evita o erro "The browser is already running" no Windows
  killOrphanedBrowser(businessId);

  // --- RESTO DO CÓDIGO (SEGUE IGUAL) ---

  const authPath = './.wwebjs_auth';
  if (!fs.existsSync(authPath)) {
    try {
      fs.mkdirSync(authPath, { recursive: true });
    } catch (err) {
      console.error('❌ Falha ao criar pasta .wwebjs_auth:', err);
    }
  }

  const config = await BusinessConfig.findById(businessId);
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
      protocolTimeout: 300000, // AUMENTO DE TIMEOUT PARA IMAGENS (5 minutos)
      //dumpio: true, // Ativa logs detalhados do Puppeteer (útil para debugging)
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        // '--disable-accelerated-2d-canvas', // 🚨 REMOVIDO: O WWebJS precisa do canvas para renderizar a miniatura (thumbnail) de imagens antes do envio. Desativar isso causa crash (Execution context was destroyed).
        '--no-first-run',
        //'--no-zygote',
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
        // '--blink-settings=imagesEnabled=false', // 🚨 REMOVIDO: Impede o carregamento da tag <img> no DOM do WhatsApp Web. Sem isso, mídias (fotos/vídeos) não podem ser enviadas e dão Timeout.
        // '--disable-software-rasterizer', // 🚨 REMOVIDO: Em conjunto com o bloqueio de GPU, desligar o rasterizer cega totalmente a capacidade gráfica do Chrome, causando falha letal no processamento de imagens.
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
    
    // 🔧 CORREÇÃO: Health check em SEGUNDO PLANO (não bloqueia o ready)
    // O WhatsApp Web pode ainda estar carregando recursos após o evento ready,
    // então verificamos após um delay e NÃO destruímos a sessão se falhar —
    // deixamos o health check periódico (60s) cuidar disso.
    setTimeout(async () => {
      console.log(`🔍 [User ${businessId}] Verificando saúde da sessão (pós-ready)...`);
      const isHealthy = await verifySessionHealth(client, businessId, 3000); // timeout reduzido: 3s
      
      if (!isHealthy) {
        console.warn(`⚠️ [User ${businessId}] Health check inicial falhou, mas sessão NÃO será destruída.`);
        console.warn(`   O health check periódico (60s) monitorará e destruirá se necessário.`);
      } else {
        console.log(`✅ [User ${businessId}] Sessão saudável.`);
      }
    }, 5000); // Aguarda 5s após o ready antes de verificar
    
    // Inicia health check periódico imediatamente (primeira execução em 60s)
    startSessionHealthCheck(businessId);
  });

  client.on('authenticated', () => {
    if (timeouts.has(businessId)) {
      clearTimeout(timeouts.get(businessId));
      timeouts.delete(businessId);
    }
    updateStatus(businessId, 'authenticated');
    qrCodes.delete(businessId);
  });

  client.on('auth_failure', async () => {
    console.error(`❌ Falha de autenticação para: ${config.businessName}. Celular pode ter sido desconectado.`);
    updateStatus(businessId, 'disconnected');
    // 🔧 CORREÇÃO: Limpa a sessão completamente (GridFS, pastas, etc.)
    // para evitar que ela seja restaurada como zumbi na próxima reinicialização
    await stopSession(businessId);
    if (ioInstance) {
      ioInstance.to(businessId).emit('session_error', { 
        message: 'Falha de autenticação. O WhatsApp foi desconectado do celular. Escaneie o QR code novamente.' 
      });
    }
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

  // 🔧 message_create: captura TODAS as mensagens criadas, incluindo as ENVIADAS
  // pelo WhatsApp conectado (fromMe). Sem isso, mensagens enviadas direto pelo
  // telefone/celular nunca aparecem no CRM.
  client.on('message_create', async (msg) => {
    // Só processa mensagens ENVIADAS pelo WhatsApp conectado (fromMe)
    if (!msg.fromMe) return;

    const targetId = msg.to; // O contato destino (ex: 5511970162004@c.us ou @lid)
    if (!targetId) return;

    // 🛡️ IRON GATE: apenas contatos pessoais
    if (targetId.includes('@g.us') || targetId.includes('@broadcast') || targetId.includes('@newsletter')) return;
    const targetNumeric = targetId.replace(/\D/g, '');
    if (targetNumeric.length > 15) return;
    if (msg.type === 'e2e_notification' || msg.type === 'notification_template') return;

    try {
      const { handleOutgoingMessage } = await import('../messageHandler.js');
      await handleOutgoingMessage(msg, targetId, config._id);
    } catch (error) {
      console.error(`Erro message_create:`, error);
    }
  });

  client.on('disconnected', async (reason) => {
    console.warn(`🔌 [User ${businessId}] WhatsApp Web desconectado. Motivo: ${reason || 'não especificado'}`);
    await stopSession(businessId);
  });

  try {
    await client.initialize();
  } catch (e) {
    console.error(`Erro fatal ao iniciar cliente ${businessId}:`, e.message);
    
    // 🔧 CORREÇÃO: Se falhou por "browser is already running", mata o processo órfão
    if (e.message?.includes('already running') || e.message?.includes('Execution context was destroyed')) {
      console.log(`   -> 🔄 Detectado Chrome órfão. Matando processo...`);
      killOrphanedBrowser(businessId);
      // Aguarda o SO liberar os arquivos
      await new Promise(r => setTimeout(r, 2000));
    }
    
    sessions.delete(businessId);
    updateStatus(businessId, 'error');
    
    // Emite erro para o frontend
    if (ioInstance) {
      ioInstance.to(businessId).emit('session_error', {
        message: 'Falha ao iniciar WhatsApp. Tente novamente.'
      });
    }
  }
};

// 2. FUNÇÃO DE PARADA BLINDADA (A Mágica acontece aqui)
const stopSession = async (businessId) => {
  const bId = businessId.toString();
  console.log(`🛑 [User ${bId}] Iniciando processo de desconexão segura...`);
  const client = sessions.get(bId);

  if (client) {
    updateStatus(bId, 'disconnecting');

    // 1. Logout Educado (Se autenticado)
    if (client.info) {
      try {
        console.log(`   -> Tentando logout limpo na API do WhatsApp...`);
        await withTimeout(client.logout(), 3000);
      } catch (e) {
        console.warn(`   ⚠️ [User ${bId}] Timeout/Erro no logout (ignorando).`);
      }
    }

    // 2. HARD KILL (Tiro de Misericórdia no Processo do Chrome)
    // 🔧 CORREÇÃO: SIGKILL não funciona no Windows. Usa taskkill (Win) ou SIGKILL (Linux).
    try {
      if (client.pupBrowser) {
        try {
          const proc = client.pupBrowser.process();
          if (proc && !proc.killed) {
            const pid = proc.pid;
            console.log(`   -> 💀 Matando processo Chrome (PID: ${pid})...`);
            if (process.platform === 'win32') {
              // Windows: taskkill
              try {
                execSync(`taskkill /F /PID ${pid} /T`, { timeout: 5000 });
              } catch (e) { /* processo já pode estar morto */ }
            } else {
              // Linux/Mac
              proc.kill('SIGKILL');
            }
          }
        } catch (e) {
          // Se não conseguir acessar o processo, tenta matar pelo userDataDir
          console.warn(`   ⚠️ Acesso ao processo falhou, tentando matar por userDataDir...`);
          killOrphanedBrowser(bId);
        }
      }
    } catch (e) {
      console.warn(`   ⚠️ Erro ao forçar kill do Chrome: ${e.message}`);
    }

    // 3. Destroy do WWebJS (Agora não vai travar pois o processo já está morto)
    try {
      console.log(`   -> Limpando instâncias do client...`);
      await withTimeout(client.destroy(), 3000);
    } catch (e) {
      console.warn(`   ⚠️ [User ${bId}] Timeout/Erro no destroy (ignorando).`);
    }
  } else {
    console.log(`   -> Nenhuma sessão ativa na memória para fechar.`);
  }

  // 4. Limpeza de Banco de Dados e Memória OBRIGATÓRIA (Força Bruta)
  try {
    console.log(`   -> 🧹 Limpando resquícios de autenticação no disco e MongoDB...`);

    // PASSO 1: Limpeza das pastas locais (.wwebjs_auth E .wwebjs_cache)
    cleanupTempFolders(bId);

    // PASSO 2: Força bruta no GridFS do MongoDB (Buscando por filename)
    if (mongoose.connection && mongoose.connection.db) {
      const filesCollection = mongoose.connection.db.collection('wwebsessions.files');
      const chunksCollection = mongoose.connection.db.collection('wwebsessions.chunks');

      // Busca o arquivo de sessão pelo nome (e não pelo ObjectId)
      const filesToDelete = await filesCollection.find({ filename: { $regex: bId } }).toArray();

      if (filesToDelete.length > 0) {
        for (const file of filesToDelete) {
          // Apaga os pedaços binários do ZIP (para não estourar o limite do seu servidor)
          await chunksCollection.deleteMany({ files_id: file._id });
          // Apaga o cabeçalho do arquivo
          await filesCollection.deleteOne({ _id: file._id });
        }
        console.log(`   -> ✅ Backup do RemoteAuth removido do GridFS (files e chunks).`);
      } else {
        console.log(`   -> ℹ️ Nenhum backup do RemoteAuth encontrado no banco para este usuário.`);
      }
    }
  } catch (e) {
    console.warn(`   ⚠️ Erro durante a limpeza profunda: ${e.message}`);
  }

  cleanupSession(bId);
  console.log(`✅ [User ${bId}] Desconexão finalizada com sucesso!`);
};

const cleanupSession = (businessId) => {
  // Limpa o timeout de QR
  if (timeouts.has(businessId)) {
    clearTimeout(timeouts.get(businessId));
    timeouts.delete(businessId);
  }
  // Limpa o health check interval
  if (healthIntervals.has(businessId)) {
    clearInterval(healthIntervals.get(businessId));
    healthIntervals.delete(businessId);
  }
  sessions.delete(businessId);
  qrCodes.delete(businessId);
  statuses.delete(businessId);
  updateStatus(businessId, 'disconnected');
};

// ==========================================
// 🔍 HEALTH CHECK: Verificação de sessões zumbis
// ==========================================

/**
 * Verifica se uma sessão do WhatsApp Web está realmente saudável.
 * 
 * Checa:
 * 1. Se o processo Chrome ainda está rodando
 * 2. Se a página do Puppeteer não foi fechada
 * 3. Se o WhatsApp Web está respondendo (tenta operação leve)
 * 
 * @param {Client} client - Instância do cliente WWebJS
 * @param {string} businessId - ID do negócio (para logs)
 * @returns {Promise<boolean>} - true se saudável, false se zumbi
 */
const verifySessionHealth = async (client, businessId, timeoutMs = 3000) => {
  try {
    // 1. Verifica se o client existe
    if (!client) {
      console.warn(`⚠️ [HealthCheck ${businessId}] Client é null/undefined.`);
      return false;
    }
    
    // 2. Verifica se o Chrome ainda está rodando
    if (!client.pupBrowser) {
      console.warn(`⚠️ [HealthCheck ${businessId}] pupBrowser é null — Chrome provavelmente morreu.`);
      return false;
    }
    
    try {
      const process = client.pupBrowser.process();
      if (!process || process.killed) {
        console.warn(`⚠️ [HealthCheck ${businessId}] Processo Chrome está morto (killed).`);
        return false;
      }
    } catch (e) {
      console.warn(`⚠️ [HealthCheck ${businessId}] Não foi possível acessar o processo Chrome: ${e.message}`);
      return false;
    }
    
    // 3. Verifica se a página está fechada
    if (!client.pupPage || client.pupPage.isClosed()) {
      console.warn(`⚠️ [HealthCheck ${businessId}] pupPage está fechada.`);
      return false;
    }
    
    // 4. Verifica se o client tem info (autenticado)
    if (!client.info) {
      console.warn(`⚠️ [HealthCheck ${businessId}] Client sem info — não está autenticado.`);
      return false;
    }
    
    // 5. Tenta uma operação leve para verificar se o WA Web responde
    try {
      await Promise.race([
        client.pupPage.evaluate(() => document.readyState),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
      ]);
    } catch (e) {
      console.warn(`⚠️ [HealthCheck ${businessId}] WA Web não está responsivo: ${e.message}`);
      return false;
    }
    
    return true;
  } catch (e) {
    console.warn(`⚠️ [HealthCheck ${businessId}] Erro na verificação: ${e.message}`);
    return false;
  }
};

/**
 * Inicia um health check periódico para uma sessão específica.
 * Se a sessão falhar, ela é automaticamente destruída.
 */
const startSessionHealthCheck = (businessId) => {
  const bId = businessId.toString();
  
  // Remove intervalo antigo se existir
  if (healthIntervals.has(bId)) {
    clearInterval(healthIntervals.get(bId));
  }
  
  const interval = setInterval(async () => {
    const client = sessions.get(bId);
    const status = statuses.get(bId);
    
    // Só verifica sessões que estão "ready"
    if (status !== 'ready') return;
    
    if (!client) {
      console.warn(`⚠️ [HealthCheck ${bId}] Sessão no mapa mas client é null — limpando.`);
      cleanupSession(bId);
      return;
    }
    
    const isHealthy = await verifySessionHealth(client, bId);
    
    if (!isHealthy) {
      console.error(`💀 [HealthCheck ${bId}] Sessão ZUMBI detectada! Estado: ${status}. Auto-destruindo...`);
      
      // Emite alerta para o frontend
      if (ioInstance) {
        ioInstance.to(bId).emit('session_zombie_detected', {
          message: 'Sessão do WhatsApp foi detectada como inativa. Por favor, reconecte.',
          businessId: bId
        });
        ioInstance.to(bId).emit('wwebjs_status', 'disconnected');
      }
      
      // Destrói a sessão zumbi (sem logout — o processo já pode estar morto)
      try {
        if (client.pupBrowser) {
          try {
            const proc = client.pupBrowser.process();
            if (proc && !proc.killed) {
              if (process.platform === 'win32') {
                execSync(`taskkill /F /PID ${proc.pid} /T`, { timeout: 3000 });
              } else {
                proc.kill('SIGKILL');
              }
            }
          } catch (e) { /* ignora */ }
        }
      } catch (e) { /* ignora */ }
      
      try {
        await Promise.race([
          client.destroy(),
          new Promise(r => setTimeout(r, 2000))
        ]);
      } catch (e) { /* ignora */ }
      
      cleanupSession(bId);
    }
  }, 60000); // Verifica a cada 60 segundos
  
  healthIntervals.set(bId, interval);
  console.log(`🩺 [HealthCheck ${bId}] Monitoramento de saúde iniciado (intervalo: 60s).`);
};

/**
 * Inicia o health check GLOBAL que monitora TODAS as sessões.
 * Complementa os health checks individuais como rede de segurança.
 */
const startGlobalHealthCheck = () => {
  if (globalHealthCheckInterval) {
    clearInterval(globalHealthCheckInterval);
  }
  
  globalHealthCheckInterval = setInterval(async () => {
    const entries = Array.from(sessions.entries());
    
    for (const [bId, client] of entries) {
      const status = statuses.get(bId);
      
      // Só verifica sessões marcadas como "ready"
      if (status !== 'ready') continue;
      
      // Pula se já tem health check individual (evita duplicação)
      if (healthIntervals.has(bId)) continue;
      
      try {
        // Verifica se o processo Chrome ainda está rodando (checagem rápida)
        if (!client || !client.pupBrowser) {
          console.warn(`⚠️ [GlobalHealthCheck ${bId}] Sessão órfã detectada — client sem pupBrowser.`);
          cleanupSession(bId);
          continue;
        }
        
        let processAlive = false;
        try {
          const proc = client.pupBrowser.process();
          processAlive = proc && !proc.killed;
        } catch (e) { /* processo inacessível */ }
        
        if (!processAlive) {
          console.warn(`💀 [GlobalHealthCheck ${bId}] Processo Chrome morto detectado globalmente.`);
          if (ioInstance) {
            ioInstance.to(bId).emit('wwebjs_status', 'disconnected');
          }
          cleanupSession(bId);
        }
      } catch (e) {
        console.warn(`⚠️ [GlobalHealthCheck ${bId}] Erro: ${e.message}`);
      }
    }
  }, 90000); // Verificação global a cada 90 segundos
  
  console.log('🩺 [GlobalHealthCheck] Monitoramento global de sessões iniciado (intervalo: 90s).');
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
    let formattedNumber = to.trim();
    
    // Se já está no formato WhatsApp ID (@c.us), usa como está
    if (!formattedNumber.includes('@c.us')) {
      // Número nacional (ex: 11999999999) → adiciona código do país (55) + @c.us
      const digits = formattedNumber.replace(/\D/g, '');
      if (digits.length <= 12) {
        // Número nacional (sem código de país) → adiciona 55 (Brasil)
        formattedNumber = `55${digits}@c.us`;
      } else {
        // Já tem código de país → só adiciona @c.us
        formattedNumber = `${digits}@c.us`;
      }
    }

    // FIX: Pass { sendSeen: false } to prevent crash on 'markedUnread'
    await client.sendMessage(formattedNumber, message, { sendSeen: false });
    return true;
  } catch (error) {
    console.error(`💥 Erro envio WWebJS (User ${businessId}):`, error.message);
    return false;
  }
};

// 4. FUNÇÃO DE ENVIO DE IMAGEM (Memória direta - Sem corrupção)
const sendImage = async (businessId, to, imageUrl, caption) => {
  const client = sessions.get(businessId.toString());

  if (!client || !client.info) {
    console.warn(`⚠️ Envio de imagem falhou: Sessão ${businessId} indisponível.`);
    return false;
  }

  try {
    // Formata o número: suporta tanto formato nacional (11999999999) quanto internacional (5511999999999@c.us)
    let formattedNumber = to.trim();
    if (!formattedNumber.includes('@c.us')) {
      const digits = formattedNumber.replace(/\D/g, '');
      if (digits.length <= 12) {
        formattedNumber = `55${digits}@c.us`;
      } else {
        formattedNumber = `${digits}@c.us`;
      }
    }

    console.log(`⬇️ [WWebJS] Baixando imagem da URL...`);

    // 1. Faz o download nativo via axios
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });

    // 2. CORREÇÃO CRÍTICA: Não usar 'binary'! O response.data já é um Buffer perfeito.
    const imageBuffer = Buffer.from(response.data);
    const base64Image = imageBuffer.toString('base64'); // Converte limpo para Base64

    // 3. Verifica o formato da imagem (MimeType) para o WhatsApp não rejeitar
    let mimeType = response.headers['content-type'];
    if (!mimeType || mimeType.includes('octet-stream')) {
      // Fallback caso o Firebase oculte o tipo do arquivo
      mimeType = imageUrl.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
    }

    // 4. Cria o objeto de mídia oficial do WWebJS
    const filename = mimeType.includes('png') ? 'imagem_campanha.png' : 'imagem_campanha.jpg';
    const media = new MessageMedia(mimeType, base64Image, filename);

    console.log(`🚀 [WWebJS] Enviando imagem de ${imageBuffer.length} bytes para ${formattedNumber}...`);

    // 5. Dispara a mensagem anexando a legenda (caption)
    const options = caption ? { caption: caption } : {};
    await client.sendMessage(formattedNumber, media, options);

    return true;

  } catch (error) {
    console.error(`💥 Erro ao baixar/enviar imagem (User ${businessId}):`, error.message);
    return false;
  }
};


// 5. FUNÇÃO DE ESTADO "DIGITANDO..." (UX / Humanização)
const sendPresenceAvailable = async (businessId) => {
  const client = getClientSession(businessId);

  if (!client || !client.info) {
    return;
  }

  try {
    await client.sendPresenceAvailable();
  } catch (error) {
    // Ignora erros silenciosamente
  }
};

const sendStateTyping = async (businessId, to) => {
  // Pega a sessão usando a função auxiliar (apenas uma vez)
  const client = getClientSession(businessId);

  // 🛡️ TRAVA MÁGICA: Se não tem WhatsApp conectado, sai em silêncio
  if (!client || !client.info) {
    return false;
  }

  try {
    // Suporta tanto formato nacional (11999999999) quanto internacional (5511999999999@c.us)
    let formattedNumber = to.trim();
    if (!formattedNumber.includes('@c.us')) {
      const digits = formattedNumber.replace(/\D/g, '');
      if (digits.length <= 12) {
        formattedNumber = `55${digits}@c.us`;
      } else {
        formattedNumber = `${digits}@c.us`;
      }
    }

    const chat = await client.getChatById(formattedNumber);

    // 🛡️ Garante que o chat foi encontrado antes de enviar o status
    if (chat) {
      // Dispara o status "digitando..." (o WWebJS mantém isso por alguns segundos ou até enviar mensagem)
      await chat.sendStateTyping();
    }

    return true;
  } catch (error) {
    // Ignora erros visuais para não derrubar o servidor
    // console.error(`💥 Erro ao enviar status 'digitando' (Business ${businessId}):`, error.message);
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
  // Limpa o health check global
  if (globalHealthCheckInterval) {
    clearInterval(globalHealthCheckInterval);
    globalHealthCheckInterval = null;
  }
  
  console.log(`🛑 Encerrando ${sessions.size} sessão(ões) ativa(s)...`);
  
  for (const [businessId] of sessions.entries()) {
    try {
      // 🔧 CORREÇÃO: Usa stopSession para limpeza COMPLETA (logout + kill + GridFS + pastas)
      await stopSession(businessId);
    } catch (e) {
      console.error(`   -> Erro ao encerrar sessão ${businessId}:`, e.message);
    }
  }
  
  // Garante que todos os maps estejam limpos (stopSession já faz cleanupSession, mas é seguro)
  sessions.clear();
  qrCodes.clear();
  statuses.clear();
  timeouts.clear();
  healthIntervals.clear();
  
  console.log('✅ Todas as sessões encerradas e limpas.');
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
  initializeWWebJS, startSession, stopSession, getSessionStatus, getSessionQR, getClientSession, sendWWebJSMessage,
  sendImage, sendStateTyping, closeAllSessions, getLabels, updateLabel, deleteLabel, setChatLabels, getChatLabels,
  verifySessionHealth, startGlobalHealthCheck, cleanupTempFolders
};