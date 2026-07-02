    // src/lib/supabase.ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan las variables de entorno de Supabase (URL o Anon Key).');
}

// Inicializamos el cliente de Supabase para usar Storage
export const supabase = createClient(supabaseUrl, supabaseAnonKey);