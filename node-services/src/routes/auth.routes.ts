import { Router } from 'express';
import { register, login } from '../controllers/auth.controller.js';

const router = Router();

// Endpoint: POST /api/v1/auth/register
router.post('/register', register);

// Endpoint: POST /api/v1/auth/login
router.post('/login', login);

export default router;