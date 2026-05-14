import BusinessConfig from '../models/BusinessConfig.js';
import Tag from '../models/Tag.js';
import Contact from '../models/Contact.js';
import * as wwebjsService from './wwebjsService.js';

// Helper to escape Regex characters
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Migrates legacy tags from BusinessConfig.availableTags to the Tag collection.
 * Helper for syncWithWhatsapp.
 * @param {string} businessId
 */
const migrateLegacyTags = async (businessId) => {
    try {
        const config = await BusinessConfig.findById(businessId);
        if (!config || !config.availableTags || config.availableTags.length === 0) {
            return { migrated: 0 };
        }

        let migratedCount = 0;
        for (const tagName of config.availableTags) {
            if (!tagName || typeof tagName !== 'string') continue;

            const escapedName = escapeRegExp(tagName);
            const existing = await Tag.findOne({
                businessId,
                name: { $regex: new RegExp(`^${escapedName}$`, 'i') }
            });

            if (!existing) {
                // Determine if this should be synced to WA?
                // For now just create in DB, syncWithWhatsapp will handle WA linking if it exists there.
                await Tag.create({
                    businessId,
                    name: tagName,
                    color: '#CBD5E0'
                });
                migratedCount++;
            }
        }
        return { migrated: migratedCount };
    } catch (error) {
        console.error(`Error migrating legacy tags for business ${businessId}:`, error);
        throw error;
    }
};

/**
 * Syncs tags from WhatsApp to the Tag collection.
 * @param {string} businessId
 */
const syncWithWhatsapp = async (businessId) => {
    try {
        if (!businessId) {
            throw new Error('Business ID is required for tag sync.');
        }

        // 1. Get userId to call WWebJS
        const config = await BusinessConfig.findById(businessId);
        if (!config || !config._id) {
            throw new Error(`Business Config or UserID not found for ${businessId}`);
        }

        // 2. Fetch Labels from WhatsApp (Safe Fail)
        let waLabels = [];
        try {
            waLabels = await wwebjsService.getLabels(businessId);
        } catch (e) {
            console.warn("WA Labels unavailable, skipping fetch.");
            return { warning: "WhatsApp offline", synced: 0 };
        }

        if (!waLabels) waLabels = [];

        // 3. MERGE STRATEGY (Update/Create only)
        for (const label of waLabels) {
            try {
                // Check if label.hexColor exists, if not use label.color, if not default
                const finalColor = label.hexColor || label.color || '#A0AEC0';

                // Upsert: Update if exists, Create if new
                await Tag.findOneAndUpdate(
                    { businessId, whatsappId: label.id }, // Try matching by ID first
                    {
                        name: label.name,
                        color: finalColor,
                        whatsappId: label.id
                    },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
            } catch (err) {
                if (err.code === 11000) {
                    console.warn(`⚠️ Duplicate Key Error (11000) for label ${label.name} (waId: ${label.id}) in business ${businessId}. Skipping...`);
                    continue;
                }
                throw err; // Re-throw other errors
            }
        }

        // 4. NAME MATCHING (Link Legacy Tags)
        // If we have a local tag named "Lead" and WA has "Lead", link them.
        for (const label of waLabels) {
            try {
                 const finalColor = label.hexColor || label.color || '#A0AEC0';
                 await Tag.findOneAndUpdate(
                    { businessId, name: label.name, whatsappId: null },
                    { whatsappId: label.id, color: finalColor }
                 );
            } catch (err) {
                if (err.code === 11000) {
                    console.warn(`⚠️ Duplicate Key Error (11000) during Name Matching for label ${label.name} (waId: ${label.id}) in business ${businessId}. Skipping...`);
                    continue;
                }
                throw err; // Re-throw other errors
            }
        }

        // 🛡️ CRITICAL: We DO NOT run deleteMany().
        // Local tags used in Funnels are preserved even if they don't exist on WA.

        return { synced: waLabels.length };

    } catch (error) {
        console.error('Error syncing tags with WhatsApp:', error);
        throw error; // Controller should handle this
    }
};

const createTag = async (businessId, tagData) => {
    try {
        const { name, color } = tagData;

        // 1. Create on WhatsApp (Safe Fail)
        const config = await BusinessConfig.findById(businessId);
        if (!config || !config._id) throw new Error('Business Config not found');

        let waLabel = null;
        let whatsappId = null;
        let finalColor = color || '#A0AEC0';

        try {
            // Check if service function exists
            if (typeof wwebjsService.createLabel === 'function') {
                waLabel = await wwebjsService.createLabel(config._id, name);
            } else {
                 // Fallback if service wrapper is missing method (e.g. mock or old version)
                const client = wwebjsService.getClientSession(config._id);
                if (client && typeof client.createLabel === 'function') {
                     waLabel = await client.createLabel(name);
                }
            }

            if (waLabel && waLabel.id) {
                whatsappId = waLabel.id;
                // Update color on WA if needed
                if (color && waLabel.hexColor !== color) {
                     try {
                        if (typeof wwebjsService.updateLabel === 'function') {
                             const updated = await wwebjsService.updateLabel(config._id, whatsappId, name, color);
                             if(updated) finalColor = updated.hexColor || color;
                        }
                     } catch (e) { console.warn('Failed to update color on WA:', e.message); }
                } else if (waLabel.hexColor) {
                    finalColor = waLabel.hexColor;
                }
            }
        } catch (error) {
             console.warn(`⚠️ WA Label creation skipped: ${error.message}. Creating in CRM only.`);
        }

        // 2. Create in Mongo (Always proceed)
        const escapedName = escapeRegExp(name);
        let tag = await Tag.findOne({ businessId, name: { $regex: new RegExp(`^${escapedName}$`, 'i') } });

        if (tag) {
            if (whatsappId) tag.whatsappId = whatsappId;
            tag.color = finalColor;
            await tag.save();
        } else {
            tag = await Tag.create({
                businessId,
                name: waLabel ? waLabel.name : name, // Use WA name if available, else requested name
                whatsappId,
                color: finalColor
            });
        }

        return tag;
    } catch (error) {
        console.error('Error in createTag service:', error);
        throw error;
    }
};

const updateTag = async (businessId, tagId, updateData) => {
    try {
        const { name, color, __v } = updateData;

        const query = { _id: tagId, businessId };
        if (__v !== undefined) {
            query.__v = __v;
        }

        // First find it to check if it has a whatsappId, avoiding multiple findOneAndUpdate calls if we fail WA update
        const tag = await Tag.findOne({ _id: tagId, businessId });
        if (!tag) throw new Error('Tag not found');

        // 1. Update WhatsApp
        if (tag.whatsappId) {
            const config = await BusinessConfig.findById(businessId);
            if (config && config._id) {
                await wwebjsService.updateLabel(config._id, tag.whatsappId, name, color);
            }
        }

        // 2. Update Mongo
        const updatedTag = await Tag.findOneAndUpdate(
            query,
            { $set: { name, color }, $inc: { __v: 1 } },
            { new: true }
        );

        if (!updatedTag) {
            const existing = await Tag.findOne({ _id: tagId, businessId });
            if (existing) {
                throw new Error('Conflict');
            }
            throw new Error('Tag not found');
        }

        return updatedTag;
    } catch (error) {
         console.error('Error in updateTag service:', error);
         throw error;
    }
};

const deleteTag = async (businessId, tagId) => {
    try {
        const tag = await Tag.findOne({ _id: tagId, businessId });
        if (!tag) throw new Error('Tag not found');

        // 1. Delete from WhatsApp
        if (tag.whatsappId) {
             const config = await BusinessConfig.findById(businessId);
             if (config && config._id) {
                 try {
                    await wwebjsService.deleteLabel(config._id, tag.whatsappId);
                 } catch (e) {
                     console.warn(`Failed to delete label on WA: ${e.message}`);
                 }
             }
        }

        // 2. Delete from Mongo
        await Tag.deleteOne({ _id: tagId });
        return { message: 'Tag deleted' };

    } catch (error) {
         console.error('Error in deleteTag service:', error);
         throw error;
    }
};

// Main export to replace syncTags but kept name if needed,
// though refactor plan says 'syncWithWhatsapp'.
const syncTags = syncWithWhatsapp;

const runGlobalTagSync = async () => {
    console.log('🔄 Starting Global Tag Sync...');
    try {
        const configs = await BusinessConfig.find({});
        for (const config of configs) {
            try {
                await syncWithWhatsapp(config._id);
            } catch (e) {
                console.error(`Failed to sync business ${config.businessName}: ${e.message}`);
            }
        }
        console.log('✅ Global Tag Sync Completed.');
    } catch (error) {
        console.error('❌ Global Tag Sync Failed:', error);
    }
};

export { syncWithWhatsapp, syncTags, createTag, updateTag, deleteTag, runGlobalTagSync };
