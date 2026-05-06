const mongoose = require('mongoose');

// Define o Schema da sessão
const sessionSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    index: true
  },
  name: { type: String }, // Ex: "Tatuador A", "Suporte"
  phone: { type: String, required: true },
  status: {
    type: String,
    enum: ['connected', 'disconnected', 'connecting', 'error', 'unauthenticated'],
    default: 'disconnected'
  },
  state: { type: String, default: null },
  updatedAt: { type: Date, default: Date.now }
}, { optimisticConcurrency: true });

// Índice composto para evitar números duplicados na mesma empresa
sessionSchema.index({ businessId: 1, phone: 1 }, { unique: true });

// Cria o Model baseado no Schema
const Session = mongoose.model('Session', sessionSchema);

// Função para pegar ou criar sessão
async function getOrCreateSession(phone) {
  let session = await Session.findOne({ phone });
  if (!session) {
    session = await Session.create({ phone, state: null });
  }
  return session;
}

// Função para atualizar estado da sessão
async function setSessionState(phone, state) {
  await Session.findOneAndUpdate(
    { phone },
    { state, updatedAt: new Date() },
    { upsert: true }
  );
}

export { getOrCreateSession, setSessionState };
