import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },

  // Normalized Identifier (Phone or SessionId)
  phone: { type: String }, // Optional now
  sessionId: { type: String }, // For Web

  channel: {
    type: String,
    enum: ['whatsapp', 'web'],
    default: 'whatsapp'
  },

  role: { type: String, enum: ['user', 'bot', 'agent'], required: true },
  content: { type: String, required: true },

  messageType: {
    type: String,
    enum: ['text', 'image', 'audio', 'document', 'video'],
    default: 'text'
  },

  aiAnalysis: {
    isAnalyzed: { type: Boolean, default: false },
    description: { type: String },
    detectedIntent: { type: String },
    confidenceScore: { type: Number },
    modelUsed: { type: String }
  },

  timestamp: { type: Date, default: Date.now }
});

// Optimization: Index for frequent history lookups (AI Context) and Chat UI (Chronological)
messageSchema.index({ contactId: 1, timestamp: -1 });

// Use 'ChatMessage' to maintain backward compatibility with existing collection
const Message = mongoose.models.ChatMessage || mongoose.model('ChatMessage', messageSchema);

export default Message;
