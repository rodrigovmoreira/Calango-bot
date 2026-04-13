const mongoose = require('mongoose');

// Define o Schema da sessão
const sessionSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  state: { type: String, default: null },
  updatedAt: { type: Date, default: Date.now }
});

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
