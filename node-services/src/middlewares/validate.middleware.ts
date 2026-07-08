import { type Request, type Response, type NextFunction } from 'express';
import { type ZodSchema, ZodError } from 'zod';

export const validateBody = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.issues.map((err: any) => ({
          campo: err.path.join('.'),
          mensaje: err.message,
        }));
        
        res.status(400).json({
          error: 'Error de validación en los datos de entrada',
          detalles: errorMessages,
        });
        return;
      }
      res.status(500).json({ error: 'Error interno durante la validación' });
    }
  };
};