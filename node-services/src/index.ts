import express, { type Request, type Response } from 'express';
import cors from 'cors';
import 'dotenv/config';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// IMPORTAR RUTAS
import authRoutes from './routes/auth.routes.js'; 
import roomRoutes from './routes/room.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import documentsRoutes from './routes/documents.routes.js';
const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 🛡️ CAPA DE SEGURIDAD GLOBAL (MIDDLEWARES)
// ==========================================

// 1. Helmet: Oculta que usamos Express y bloquea ataques XSS/Clickjacking
app.use(helmet());

// 2. CORS: Permite peticiones cruzadas (necesario para cuando conectes el frontend)
app.use(cors());

// 3. Body Parser: Permite leer JSON en las peticiones
app.use(express.json());

// ==========================================
// 🚧 CAPA DE SEGURIDAD ESPECÍFICA (RATE LIMIT)
// ==========================================

// Creamos un límite estricto para las rutas de autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos de bloqueo
  max: 10, // Máximo 10 intentos por IP en ese tiempo
  message: { 
    error: 'Detectamos demasiados intentos desde tu red. Por seguridad, intenta de nuevo en 15 minutos.' 
  },
  standardHeaders: true, // Retorna la info del límite en los headers `RateLimit-*`
  legacyHeaders: false, // Deshabilita los headers antiguos `X-RateLimit-*`
});

// ==========================================
// 🚀 RUTAS DE LA APLICACIÓN
// ==========================================

// Inyectamos el limitador SOLO en las rutas de login/registro
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/rooms', roomRoutes);
// Acoplamos las rutas de documentos anidadas dentro de las salas de estudio
app.use('/api/v1/rooms/:roomId/documents', documentsRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.get('/api/v1/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'API Gateway funcionando y blindado' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo de forma segura en http://localhost:${PORT}`);
});