import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string({ message: 'El nombre es obligatorio' })
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre es demasiado largo'),
  
  email: z.string({ message: 'El correo electrónico es obligatorio' })
    .email('El formato del correo electrónico no es válido')
    .max(255, 'El correo es demasiado largo'),
  
  password: z.string({ message: 'La contraseña es obligatoria' })
    .min(6, 'La contraseña debe tener al menos 6 caracteres por seguridad')
    .max(100, 'La contraseña es demasiado larga'),
});

export const loginSchema = z.object({
  email: z.string({ message: 'El correo electrónico es obligatorio' })
    .email('El formato del correo electrónico no es válido'),
  
  password: z.string({ message: 'La contraseña es obligatoria' }),
});