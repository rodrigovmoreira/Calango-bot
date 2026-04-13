import mongoose from 'mongoose';

const campaignLogSchema = new mongoose.Schema({
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true,
    index: true
  },
  contactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact', // Optional, as we might send to a number not in contacts? No, prompt says "Find contacts".
    required: true,
    index: true
  },
  // For 'event' campaigns, we need to know WHICH appointment triggered it to avoid duplicates for the same event
  relatedId: {
    type: String, // Can be Appointment ID
    index: true
  },
  messageContent: {
    type: String
  },
  status: {
    type: String,
    enum: ['sent', 'failed'],
    default: 'sent'
  },
  error: {
    type: String
  },
  sentAt: {
    type: Date,
    default: Date.now,
    index: true // Useful for "sent today" check
  }
});

// Compound index for efficient duplication checks
campaignLogSchema.index({ campaignId: 1, contactId: 1, sentAt: -1 });
campaignLogSchema.index({ campaignId: 1, contactId: 1, relatedId: 1 });

export default mongoose.model('CampaignLog', campaignLogSchema);
