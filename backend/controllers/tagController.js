import Tag from '../models/Tag.js';
import BusinessConfig from '../models/BusinessConfig.js';
import Contact from '../models/Contact.js';
import * as tagService from '../services/tagService.js';


// 1. Sync Logic (Refactored to be thin)
const syncTags = async (req, res) => {
    try {
        let businessId;
        if (req && req.businessId) {
            businessId = req.businessId;
        } else if (req && req.user) {
            businessId = req.user.activeBusinessId;
        }

        if (!businessId) {
            return res ? res.status(404).json({ message: 'Business not found' }) : null;
        }

        // Call service method
        const stats = await tagService.syncWithWhatsapp(businessId);

        if (res) {
            res.json({ message: 'Sync completed', ...stats });
        }
        return stats;

    } catch (error) {
        console.error('Error syncing tags:', error);
        if (res) res.status(500).json({ message: 'Error syncing tags', error: error.message });
    }
};

const runGlobalTagSync = tagService.runGlobalTagSync;

// 2. Get Tags (Remains mostly same, read-only)
const getTags = async (req, res) => {
    try {
        const businessId = req.user.activeBusinessId;
        if (!businessId) return res.status(404).json({ message: 'Business not found' });

        const tags = await Tag.find({ businessId }).sort({ name: 1 });
        res.json(tags);
    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({ message: 'Error fetching tags' });
    }
};

// 3. Create Tag (Delegated)
const createTag = async (req, res) => {
    try {
        const { name, color } = req.body;
        if (!name) return res.status(400).json({ message: 'Tag name is required' });

        const businessId = req.user.activeBusinessId;
        if (!businessId) return res.status(404).json({ message: 'Business not found' });

        const newTag = await tagService.createTag(businessId, { name, color });

        res.status(201).json(newTag);
    } catch (error) {
        console.error('Error creating tag:', error);
        res.status(500).json({ message: 'Error creating tag', error: error.message });
    }
};

// 4. Update Tag (New/Delegated)
const updateTag = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, color, __v } = req.body;

        const businessId = req.user.activeBusinessId;
        if (!businessId) return res.status(404).json({ message: 'Business not found' });

        const updatedTag = await tagService.updateTag(businessId, id, { name, color, __v });
        res.json(updatedTag);
    } catch (error) {
        console.error('Error updating tag:', error);
        if (error.message === 'Conflict') {
            return res.status(409).json({ message: 'Conflito de versão. Esta tag foi modificada por outro processo.' });
        }
        res.status(500).json({ message: 'Error updating tag', error: error.message });
    }
};

// 5. Delete Tag (With Protection)
const deleteTag = async (req, res) => {
    try {
        const { id } = req.params;


        const config = await BusinessConfig.findById(req.user.activeBusinessId);
        if (!config) return res.status(404).json({ message: 'Business not found' });

        // 1. Check if Tag Exists
        const tag = await Tag.findOne({ _id: id, businessId: config._id });
        if (!tag) return res.status(404).json({ message: 'Tag não encontrada.' });

        // 2. PROTECTION: Check if it's a Funnel Step
        const isFunnelStep = config.funnelSteps.some(step => step.tag === tag.name);
        if (isFunnelStep) {
            return res.status(400).json({
                message: '⛔ PROIBIDO: Esta tag é uma etapa ativa do Funil de Vendas. Remova-a do funil antes de excluir.'
            });
        }

        // 3. PROTECTION: Check Contact Usage
        // We look for contacts that have this tag name in their tags array
        const contactCount = await Contact.countDocuments({
            businessId: config._id,
            tags: tag.name
        });

        if (contactCount > 0) {
            return res.status(400).json({
                message: `⛔ PROIBIDO: Existem ${contactCount} contatos com esta tag. Remova a tag dos contatos primeiro.`
            });
        }

        // 4. Safe to Delete
        await tagService.deleteTag(config._id, id);
        res.json({ message: 'Tag excluída com sucesso.' });

    } catch (error) {
        console.error('Error deleting tag:', error);
        res.status(500).json({ message: 'Erro interno ao excluir tag.', error: error.message });
    }
};

export {
    syncTags,
    runGlobalTagSync,
    getTags,
    createTag,
    updateTag,
    deleteTag
};
