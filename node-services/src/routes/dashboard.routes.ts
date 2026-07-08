import { Router } from 'express';
import { getDashboardMetrics } from '../controllers/dashboard.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const router = Router();

router.use(requireAuth);

router.get('/metrics', getDashboardMetrics);

export default router;