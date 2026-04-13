import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SystemUser',
    required: true,
    index: true // Melhora a busca por usuário
  },
  // Dados do Cliente (Para o bot saber quem é)
  clientName: { type: String, required: true },
  clientPhone: { type: String, required: true }, // Formato: 5511999999999

  // Dados do Evento (Padrão Google Calendar)
  title: { type: String, required: true }, // Ex: "Sessão Fechamento Braço"
  description: { type: String }, // Detalhes extras
  
  start: { type: Date, required: true }, // Data e Hora de Início
  end: { type: Date, required: true },   // Data e Hora de Fim
  
  // Categorização (Sua solicitação de etapas)
  type: { 
    type: String, 
    enum: ['orcamento', 'servico', 'retorno', 'pos_venda', 'outros'],
    default: 'servico'
  },
  
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'completed', 'no_show', 'cancelled', 'followup_pending', 'archived'],
    default: 'scheduled'
  },

  statusHistory: [{
    status: String,
    changedAt: { type: Date, default: Date.now },
    changedBy: String // 'System' ou User ID
  }],

  // Integração Futura
  googleEventId: { type: String }, // ID do evento no Google
  googleHtmlLink: { type: String }, // Link para abrir direto no Google

  // === ADICIONADO: HISTÓRICO DE NOTIFICAÇÕES (Fase 2) ===
  // Mapeia ruleId -> Data de Envio. Garante idempotência.
  notificationHistory: {
    type: Map,
    of: Date,
    default: {}
  },

  createdAt: { type: Date, default: Date.now }
});

// Optimization for Scheduler (frequent query by user, status, and date range)
appointmentSchema.index({ userId: 1, status: 1, start: 1 });

export default mongoose.model('Appointment', appointmentSchema);