import express, { type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
const { PrismaClient } = require('@prisma/client');

// Cargar variables de entorno
dotenv.config();

// Inicializar Express y Prisma
const app = express();
const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors()); // Permite peticiones del frontend 
app.use(express.json()); // Permite recibir payloads en formato JSON

// Health Check Endpoint
app.get('/api/v1/health', (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'API Gateway Node.js funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Arrancar el servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor de Auth/Progress corriendo en http://localhost:${PORT}`);
});