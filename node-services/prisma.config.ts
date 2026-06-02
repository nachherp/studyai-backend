import dotenv from 'dotenv';

// Asegura que las variables de entorno se carguen al usar el CLI de Prisma
dotenv.config();

export default {
  migrate: {
    url: process.env.DATABASE_URL,
  },
};