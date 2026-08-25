// services/database.js
import 'dotenv/config';
import mongoose from 'mongoose';
import dns from 'dns';
import { promisify } from 'util';

const dnsResolveSrv = promisify(dns.resolveSrv);

// Cache de reconexão para evitar loops infinitos
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 5000; // 5 segundos

async function resolveSrvToMongoUri(srvUri) {
  // Extrai hostname da URI mongodb+srv://
  const match = srvUri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^\/]+)\/(.+)/);
  if (!match) return null;
  
  const [, user, pass, hostname, rest] = match;
  
  try {
    console.log(`🔍 Tentando resolver DNS SRV para: ${hostname}`);
    const records = await dnsResolveSrv(`_mongodb._tcp.${hostname}`);
    
    if (records && records.length > 0) {
      const hosts = records.map(r => `${r.name}:${r.port}`).join(',');
      const uri = `mongodb://${user}:${pass}@${hosts}/${rest}&tls=true&authSource=admin`;
      console.log(`✅ DNS SRV resolvido: ${records.length} host(s) encontrado(s)`);
      return uri;
    }
  } catch (err) {
    console.warn(`⚠️ Falha ao resolver DNS SRV para ${hostname}: ${err.code || err.message}`);
    console.warn('💡 Sua rede pode estar bloqueando consultas DNS SRV. Tentando conexão direta...');
  }
  
  // Fallback: tenta conexão direta (sem SRV) — comum em redes corporativas
  const fallbackUri = `mongodb://${user}:${pass}@${hostname}/${rest}&tls=true&authSource=admin`;
  console.log(`🔄 Usando conexão direta (sem SRV): mongodb://***:***@${hostname}/...`);
  return fallbackUri;
}

async function connectWithUri(mongoUri) {
  console.log('📡 URI do MongoDB:', mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'));
  
  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000, // 10 segundos para selecionar servidor
      connectTimeoutMS: 10000,
    });
    console.log('✅ MongoDB conectado com sucesso');
    reconnectAttempts = 0;
    return true;
  } catch (err) {
    console.error('💥 ERRO ao conectar MongoDB:', err.message);
    return false;
  }
}

export default async () => {
  console.log('🔄 Conectando ao MongoDB...');
  
  let mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/chatbot-platform';
  
  // Se for mongodb+srv://, tenta resolver SRV primeiro
  if (mongoUri.startsWith('mongodb+srv://')) {
    const resolvedUri = await resolveSrvToMongoUri(mongoUri);
    if (resolvedUri) {
      mongoUri = resolvedUri;
    }
    // Se resolveSrvToMongoUri falhar, mantém a URI original como último fallback
  }
  
  const connected = await connectWithUri(mongoUri);
  if (!connected) {
    scheduleReconnect(mongoUri);
  }

  // Eventos de conexão
  mongoose.connection.on('disconnected', () => {
    console.log('⚠️  MongoDB desconectado');
    scheduleReconnect(mongoUri);
  });

  mongoose.connection.on('error', (err) => {
    console.error('💥 Erro na conexão MongoDB:', err.message);
  });

  mongoose.connection.on('connected', () => {
    console.log('✅ MongoDB conectado');
    reconnectAttempts = 0;
  });
};

function scheduleReconnect(mongoUri) {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(`❌ Esgotadas ${MAX_RECONNECT_ATTEMPTS} tentativas de reconexão. Desistindo.`);
    return;
  }
  
  const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts), 60000);
  reconnectAttempts++;
  
  console.log(`🔄 Tentativa ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} de reconexão em ${delay / 1000}s...`);
  
  setTimeout(async () => {
    if (mongoose.connection.readyState !== 1) {
      try {
        await mongoose.connect(mongoUri, {
          serverSelectionTimeoutMS: 10000,
          connectTimeoutMS: 10000,
        });
      } catch (err) {
        console.error(`💥 Falha na reconexão ${reconnectAttempts}:`, err.message);
        scheduleReconnect(mongoUri);
      }
    }
  }, delay);
}