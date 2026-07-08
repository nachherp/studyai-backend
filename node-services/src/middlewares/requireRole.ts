import { type Response, type NextFunction } from 'express';
import { type AuthRequest } from './requireAuth.js';
import prisma from '../lib/prisma.js';

export const requireRole = (allowedRoles: ('OWNER' | 'COLLABORATOR' | 'READER')[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId;
      const  roomId  = req.params.roomId as string; // Obtenemos el ID de la sala desde la URL

      if (!userId || !roomId) {
        res.status(400).json({ error: 'Faltan parámetros de autenticación o ID de sala.' });
        return;
      }

      const member = await prisma.roomMember.findFirst({
        where: {
          room_id: roomId,
          user_id: userId,
        },
      });

      if (!member || !allowedRoles.includes(member.role)) {
        res.status(403).json({ error: 'Acceso denegado. No tienes los permisos necesarios en esta sala.' });
        return;
      }

      next();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error interno al verificar los permisos del usuario.' });
    }
  };
};