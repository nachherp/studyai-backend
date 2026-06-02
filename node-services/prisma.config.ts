import 'dotenv/config';

export default {
  // Le decimos explícitamente a Prisma dónde está tu esquema
  schema: 'prisma/schema.prisma',
  
  // Aquí es donde Prisma 7 espera encontrar la URL para las migraciones
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
};