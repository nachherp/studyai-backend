import { Router } from 'express';
import { getDashboardMetrics } from '../controllers/dashboard.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const router = Router();

// Protegemos la ruta: solo usuarios logueados pueden ver su dashboard
router.use(requireAuth);

// Endpoint #15: GET /api/v1/dashboard/metrics
router.get('/metrics', getDashboardMetrics);

export default router;