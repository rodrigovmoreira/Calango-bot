import express from 'express';
const router = express.Router();
import Campaign from '../models/Campaign.js';
import CampaignLog from '../models/CampaignLog.js';
import Contact from '../models/Contact.js';
import BusinessConfig from '../models/BusinessConfig.js';
import authenticateToken from '../middleware/auth.js';

// List all campaigns for the logged-in user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const campaigns = await Campaign.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ message: 'Error fetching campaigns' });
  }
});

// Get Campaign Audience
router.get('/:id/audience', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findOne({ _id: id, userId: req.user.userId });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // 1. Get Logged (Sent) Contacts
    // We need to fetch details, so populate or fetch by IDs
    const logs = await CampaignLog.find({ campaignId: id }).select('contactId status sentAt');
    const sentContactIds = logs.map(l => l.contactId);

    // Fetch details for sent contacts
    const sentContacts = await Contact.find({ _id: { $in: sentContactIds } })
      .select('name phone lastInteraction');

    // Map logs to contacts to show status?
    // The requirement says "List of contacts who already got it".
    // We can just return the contacts found.

    // 2. Get Pending (Target) Contacts
    // Only if campaign is still relevant? Or just theoretical audience based on tags.
    // Logic: Matching tags AND NOT in sentContactIds.

    // We need businessId to query contacts.
    // Assuming user -> business relation.
    // We can get businessId from one of the contacts or from BusinessConfig
    const config = await BusinessConfig.findOne({ userId: req.user.userId });

    if (!config) {
        return res.status(400).json({ message: 'Business config not found' });
    }

    // If campaign has no tags, it targets ALL? Or NONE?
    // Usually empty tags = All contacts, or validation prevents it.
    // Campaign model default is [].
    // Let's assume empty = no target or all?
    // In scheduler: tags: { $in: campaign.targetTags }. If targetTags is empty, $in [] matches nothing.
    // So if empty tags, pending is empty.

    let pendingContacts = [];
    if (campaign.targetTags && campaign.targetTags.length > 0) {
        pendingContacts = await Contact.find({
            businessId: config._id,
            tags: { $in: campaign.targetTags },
            phone: { $exists: true, $ne: null }, // Valid targets only
            _id: { $nin: sentContactIds }
        }).select('name phone lastInteraction');
    }

    res.json({
        sent: sentContacts,
        pending: pendingContacts,
        totalPending: pendingContacts.length,
        totalSent: sentContacts.length
    });

  } catch (error) {
    console.error('Error fetching campaign audience:', error);
    res.status(500).json({ message: 'Error fetching audience' });
  }
});

// Create a new campaign
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      name, targetTags, type, message, isActive, schedule, delayRange,
      triggerType, eventOffset, eventTargetStatus
    } = req.body;

    // Basic validation
    if (!name || !type || !message) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate schedule if triggerType is time (or undefined, defaulting to time)
    if ((!triggerType || triggerType === 'time') && (!schedule || !schedule.time)) {
      return res.status(400).json({ message: 'Missing schedule time for time-based campaign' });
    }

    const campaign = new Campaign({
      userId: req.user.userId,
      name,
      targetTags,
      type,
      message,
      isActive,
      schedule,
      delayRange,
      triggerType,
      eventOffset,
      eventTargetStatus
    });

    const savedCampaign = await campaign.save();
    res.status(201).json(savedCampaign);
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ message: 'Error creating campaign' });
  }
});

// Update a campaign
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Prevent updating userId
    delete updates.userId;

    // Validate schedule if triggerType is time (or undefined, defaulting to time)
    // Note: In PUT, we need to check if triggerType is being updated or if it exists in DB.
    // However, simplest check is: if the update contains schedule data or triggerType changes to time, validate.
    // Ideally we should fetch, merge, and validate, but strict validation might break partial updates if not careful.
    // Given the frontend sends the whole object, we can validate the incoming payload if it looks like a full update.

    // For now, let's allow the update but we should ensure data integrity if possible.
    // The user requested: "Ensure the POST / and PUT /:id validators accept these new fields".
    // Since we use { ...updates }, the new fields are automatically accepted by Mongoose if they are in the Schema.
    // But we should add the same validation logic if triggerType/schedule are involved.

    if (updates.triggerType === 'time' && (!updates.schedule || !updates.schedule.time)) {
        // If switching to time, ensure time is present.
         return res.status(400).json({ message: 'Missing schedule time for time-based campaign' });
    }

    const query = { _id: id, userId: req.user.userId };
    if (updates.__v !== undefined) {
      query.__v = updates.__v;
      delete updates.__v; // Remove from updates payload so we can $inc it manually
    }

    const campaign = await Campaign.findOneAndUpdate(
      query,
      { $set: updates, $inc: { __v: 1 } },
      { new: true }
    );

    if (!campaign) {
      const existing = await Campaign.findOne({ _id: id, userId: req.user.userId });
      if (existing) {
        return res.status(409).json({ message: 'Conflict: This campaign was modified by another process. Please reload.' });
      }
      return res.status(404).json({ message: 'Campaign not found' });
    }

    res.json(campaign);
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ message: 'Error updating campaign' });
  }
});

// Delete a campaign
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findOneAndDelete({ _id: id, userId: req.user.userId });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ message: 'Error deleting campaign' });
  }
});

export default router;
