import mongoose from 'mongoose';

const tagSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  whatsappId: {
    type: String, // ID from WhatsApp
  },
  color: {
    type: String, // Hex color
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { optimisticConcurrency: true });

// Ensure unique tag names per business
tagSchema.index({ businessId: 1, name: 1 }, { unique: true });

// Ensure unique WhatsApp IDs per business (allows multiple nulls for local tags)
tagSchema.index({ businessId: 1, whatsappId: 1 }, { unique: true, sparse: true });

export default mongoose.model('Tag', tagSchema);
