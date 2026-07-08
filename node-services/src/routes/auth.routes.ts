// src/routes/auth.routes.ts
import { Router } from 'express';
import { register, login } from '../controllers/auth.controller.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { registerSchema, loginSchema } from '../schemas/auth.schemas.js';

const router = Router();

router.post('/register', validateBody(registerSchema), register);
router.post('/login', validateBody(loginSchema), login);

export default router;