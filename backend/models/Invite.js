import mongoose from 'mongoose';

const inviteSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'operator'],
    required: true,
    default: 'operator'
  },
  status: {
    type: String,
    enum: ['pending', 'used', 'expired'],
    default: 'pending'
  },
  expiresAt: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { optimisticConcurrency: true });

export default mongoose.model('Invite', inviteSchema);