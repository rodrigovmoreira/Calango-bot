import express from 'express';
const router = express.Router();
import * as tagController from '../controllers/tagController.js';
import authenticateToken from '../middleware/auth.js';

// Apply authentication to all tag routes
router.use(authenticateToken);

// GET /api/tags - Get all tags
router.get('/', tagController.getTags);

// POST /api/tags - Create a new tag
router.post('/', tagController.createTag);

// POST /api/tags/sync - Sync tags from Contacts to Tags collection
router.post('/sync', tagController.syncTags);

// PUT /api/tags/:id - Update tag (name/color)
router.put('/:id', tagController.updateTag);

// DELETE /api/tags/:id - Delete tag
router.delete('/:id', tagController.deleteTag);

export default router;
