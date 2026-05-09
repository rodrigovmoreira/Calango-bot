import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  targetTags: {
    type: [String],
    default: []
  },
  type: {
    type: String,
    enum: ['recurring', 'broadcast'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  contentMode: {
    type: String,
    enum: ['static', 'ai_prompt'],
    default: 'static'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'paused', 'processing'],
    default: 'scheduled'
  },
  nextRun: {
    type: Date
  },
  processing: {
    type: Boolean,
    default: false
  },
  // Trigger Configuration
  triggerType: {
    type: String,
    enum: ['time', 'event'],
    default: 'time'
  },
  eventOffset: {
    type: Number, // In minutes
    default: 0
  },
  eventTargetStatus: {
    type: [String],
    default: ['scheduled', 'confirmed']
  },
  schedule: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'once', 'minutes_1', 'minutes_30', 'hours_1', 'hours_6', 'hours_12']
    },
    time: {
      type: String, // 'HH:mm'
      // Not required if triggerType is 'event', handled in validation
    },
    days: {
      type: [Number], // 0-6 (Sunday-Saturday)
      default: []
    }
  },
  // Human-Like Delay
  delayRange: {
    min: { type: Number, default: 0 },
    max: { type: Number, default: 0 }
  },
  stats: {
    sentCount: { type: Number, default: 0 },
    lastRun: { type: Date }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { optimisticConcurrency: true });

export default mongoose.model('Campaign', campaignSchema);
