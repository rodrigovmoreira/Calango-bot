import mongoose from 'mongoose';

const customPromptSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'BusinessConfig',
    required: true 
  },
  name: { type: String, required: true }, // Ex: "Meu Tatuador Agressivo"

  // Identidade
  botName: { type: String },
  toneOfVoice: { type: String },
  customInstructions: { type: String },

  // Audience
  aiResponseMode: { type: String, default: 'all' },
  aiWhitelistTags: { type: [String], default: [] },
  aiBlacklistTags: { type: [String], default: [] },

  prompts: {
    chatSystem: { type: String, default: '' },
    visionSystem: { type: String, default: '' }
  },
  followUpSteps: [{
    delayMinutes: { type: Number },
    message: { type: String },
    stage: { type: Number },
    useAI: { type: Boolean, default: false }
  }],
  createdAt: { type: Date, default: Date.now }
});

// Garante que o nome seja único por usuário (opcional, mas bom pra organização)
customPromptSchema.index({ businessId: 1, name: 1 }, { unique: true });

export default mongoose.model('CustomPrompt', customPromptSchema);