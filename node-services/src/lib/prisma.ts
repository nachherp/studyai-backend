import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// 1. Usamos el driver nativo de Postgres para leer tu DATABASE_URL
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 2. Creamos el puente (adaptador) para Prisma
const adapter = new PrismaPg(pool);

// 3. Inicializamos Prisma pasándole el adaptador (La ÚNICA forma permitida en v7)
const prisma = new PrismaClient({ adapter });

export default prisma;