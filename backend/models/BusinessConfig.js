const mongoose = require('mongoose');

const businessConfigSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SystemUser',
    required: true,
    index: true
  },

  businessName: { type: String, default: 'Estúdio Tattoo' },

  // === IDENTITY ===
  botName: { type: String, default: 'Assistente' }, // <--- NOVO
  tone: { type: String, enum: ['formal', 'friendly', 'slang', 'excited'], default: 'friendly' }, // Legacy support
  toneOfVoice: { type: String, default: 'friendly' }, // <--- NOVO (Requested)
  customInstructions: { type: String, default: '' }, // <--- NOVO (Requested)

  aiGlobalDisabled: { type: Boolean, default: false }, // <--- NOVO: MODO OBSERVADOR (Se true, apenas ouve e não responde)

  // === REGRAS DE ENGAJAMENTO (Fase 2) ===
  aiResponseMode: {
    type: String,
    enum: ['all', 'new_contacts', 'whitelist', 'blacklist'],
    default: 'all'
  },
  aiWhitelistTags: { type: [String], default: [] },
  aiBlacklistTags: { type: [String], default: [] },

  avatarUrl: { type: String }, // <--- ADICIONADO: URL do avatar/logo do negócio
  businessType: { type: String }, // <--- ADICIONADO: Identifica o nicho (ex: Barber, Tattoo)
  whatsappProvider: { type: String, enum: ['twilio', 'wwebjs'], default: 'wwebjs' },
  phoneNumber: { type: String, unique: true, sparse: true }, // <--- ADICIONADO: Número do WhatsApp para roteamento de Webhook

  timezone: { type: String, default: 'America/Sao_Paulo' }, // <--- NOVO: Timezone do Negócio
  minSchedulingNoticeMinutes: { type: Number, default: 60 }, // <--- NOVO: Antecedência mínima para agendamento

  // === NOVO: CENTRAL DE PROMPTS (O CÉREBRO) ===
  prompts: {
    // 1. Personalidade do Chat (DeepSeek)
    chatSystem: {
      type: String,
      default: `Você é um assistente virtual buscando ajudar as pessoas e conversar de forma amigável.`
    },

    // 2. Olhos do Robô (Gemini)
    visionSystem: {
      type: String,
      default: `Você é um assistente virtual que pode ver imagens enviadas pelos usuários. Descreva as imagens de forma clara e objetiva.`
    }
  },

  // === ADICIONADO: TAGS DISPONÍVEIS (Fase 2.5) ===
  availableTags: {
    type: [String],
    default: ['Cliente', 'Lead', 'Pós-Venda']
  },

  // === ADICIONADO: MENU DE RESPOSTAS RÁPIDAS ===
  menuOptions: [
    {
      keyword: { type: String, required: true }, // ex: "pix"
      description: { type: String },             // ex: "Chave Pix" (interno)
      response: { type: String, required: true },// ex: "Nossa chave é..."
      requiresHuman: { type: Boolean, default: false },
      useAI: { type: Boolean, default: false }
    }
  ],

  // === ADICIONADO: CATÁLOGO DE PRODUTOS ===
  products: [
    {
      name: { type: String, required: true },
      price: { type: Number, required: true },
      durationMinutes: { type: Number, default: 60 },
      description: { type: String },
      imageUrls: { type: [String], default: [] },
      tags: { type: [String], default: [] },
      // NEW STRUCTURE: Variations/Sub-services
      variations: [{
        name: { type: String, required: true },
        price: { type: Number, required: true },
        durationMinutes: { type: Number, default: 60 }
      }]
    }
  ],

  socialMedia: {
    instagram: { type: String },
    website: { type: String },
    portfolio: { type: String }
  },

  followUpSteps: [
    {
      stage: { type: Number },
      delayMinutes: { type: Number },
      message: { type: String },
      useAI: { type: Boolean, default: false }
    }
  ],

  // === ADICIONADO: FUNIL DE VENDAS (Fase 3) ===
  funnelSteps: [{
    tag: { type: String, required: true },
    label: { type: String, required: true },
    order: { type: Number, required: true },
    color: { type: String },
    prompt: { type: String } // <--- ADICIONADO: Instruções de IA para esta etapa
  }],

  // === ADICIONADO: ENGINE DE NOTIFICAÇÕES (Fase 2) ===
  notificationRules: [{
    id: { type: String, required: true }, // UUID
    name: { type: String, required: true }, // ex: 'Lembrete 24h'
    triggerOffset: { type: Number, required: true }, // ex: 24
    triggerUnit: { type: String, enum: ['minutes', 'hours', 'days'], required: true },
    triggerDirection: { type: String, enum: ['before', 'after'], required: true }, // 'before' (antes do start), 'after' (depois do end)
    messageTemplate: { type: String, required: true }, // Variáveis: {clientName}, {appointmentTime}, {serviceName}
    isActive: { type: Boolean, default: true }
  }],

  // (Mantivemos os outros campos para compatibilidade)
  operatingHours: {
    active: { type: Boolean, default: true },
    opening: { type: String, default: '00:01' },
    closing: { type: String, default: '23:59' },
    timezone: { type: String, default: 'America/Sao_Paulo' }
  },

  awayMessage: { type: String, default: 'Estamos fechados agora! Já já respondemos.' },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BusinessConfig', businessConfigSchema);
