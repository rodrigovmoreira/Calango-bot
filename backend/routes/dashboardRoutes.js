import express from 'express';
const router = express.Router();
import * as dashboardController from '../controllers/dashboardController.js';
import authenticateToken from '../middleware/auth.js';

router.get('/summary', authenticateToken, dashboardController.getDashboardSummary);

export default router;
