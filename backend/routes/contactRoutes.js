import express from 'express';
const router = express.Router();
import * as contactController from '../controllers/contactController.js';
import authenticateToken from '../middleware/auth.js';
import BusinessConfig from '../models/BusinessConfig.js';
import Tag from '../models/Tag.js';
import multer from 'multer';

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// --- CONTACT ROUTES ---

// List all contacts
router.get('/', authenticateToken, contactController.getContacts);

// Get tags (Deprecated but kept for backward compatibility)
// Note: This logic was inline before. We can keep it inline or move to controller if we want purely thin routes.
// The previous logic was: fetch unique tags from Contact model.
// However, with Stage 1 refactor, we should prefer querying Tag model directly.
// The inline logic in `contactRoutes.js` previously did:
/*
    const Tag = require('../models/Tag');
    const tags = await Tag.find({ businessId }).sort({ name: 1 });
    res.json(tags.map(t => t.name));
*/
// I'll keep this specific endpoint inline here or move to controller?
// The prompt focused on `contactController` for "Contact Management".
// Tag management is `tagController`.
// The deprecated `/contacts/tags` endpoint is kind of an orphan.
// I will keep it inline here to minimize disruption, as it wasn't explicitly asked to be moved.
// Wait, I should import `getBusinessId` logic or just replicate it?
// The previous code had a helper `getBusinessId`.
// I'll re-implement the helper or import it? Easier to just query BusinessConfig inline for this small deprecated route.

router.get('/tags', authenticateToken, async (req, res) => {
    try {
        const config = await BusinessConfig.findOne({ userId: req.user.userId });
        const businessId = config ? config._id : null;

        if (!businessId) {
            return res.status(404).json({ message: 'Business configuration not found' });
        }

        const tags = await Tag.find({ businessId }).sort({ name: 1 });
        res.json(tags.map(t => t.name));
    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({ message: 'Error fetching tags' });
    }
});

// Sync Contacts from WhatsApp (New Feature - Stage 2)
router.post('/sync', authenticateToken, contactController.syncContacts);

// Import Contacts from CSV/XLSX
router.post('/import', authenticateToken, upload.single('file'), contactController.importContacts);

// Get single contact
router.get('/:id', authenticateToken, contactController.getContact);

// Update contact
router.put('/:id', authenticateToken, contactController.updateContact);

export default router;
