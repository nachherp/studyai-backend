import { type Response } from 'express';
import { type AuthRequest } from '../middlewares/requireAuth.js';
import prisma from '../lib/prisma.js';

export const createRoom = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;
    const userId = req.userId; 

    if (!userId) {
      res.status(401).json({ error: 'Usuario no autenticado' });
      return;
    }

    const newRoom = await prisma.$transaction(async (tx) => {
      const room = await tx.studyRoom.create({
        data: {
          name,
          description,
          owner_id: userId,
        },
      });

      await tx.roomMember.create({
        data: {
          room_id: room.id,
          user_id: userId,
          role: 'OWNER',
        },
      });

      return room;
    });

    res.status(201).json({ 
      message: 'Sala creada con éxito', 
      room: newRoom 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno al crear la sala de estudio' });
  }
};

export const getMyRooms = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Usuario no autenticado' });
      return;
    }

    const memberships = await prisma.roomMember.findMany({
      where: { user_id: userId },
      include: {
        room: true, 
      },
    });

    const rooms = memberships.map((m) => ({
      id: m.room.id,
      name: m.room.name,
      description: m.room.description,
      role: m.role, 
      createdAt: m.room.created_at,
    }));

    res.status(200).json({ rooms });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener tus salas de estudio.' });
  }
};

export const getRoomDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const roomId = req.params.roomId as string;

    const room = await prisma.studyRoom.findUnique({
      where: { id: roomId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true }, 
            },
          },
        },
      },
    });

    if (!room) {
      res.status(404).json({ error: 'La sala de estudio no existe.' });
      return;
    }

    res.status(200).json({ room });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los detalles de la sala.' });
  }
};

export const addRoomMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const roomId = req.params.roomId as string;
    const { email, role } = req.body; 

    if (!['COLLABORATOR', 'READER'].includes(role)) {
      res.status(400).json({ error: 'Rol inválido. Debe ser COLLABORATOR o READER.' });
      return;
    }

    const userToInvite = await prisma.user.findUnique({ where: { email } });
    if (!userToInvite) {
      res.status(404).json({ error: 'El estudiante con ese correo no está registrado en StudyAI.' });
      return;
    }

    const isAlreadyMember = await prisma.roomMember.findFirst({
      where: { room_id: roomId, user_id: userToInvite.id },
    });

    if (isAlreadyMember) {
      res.status(400).json({ error: 'El usuario ya es miembro de esta sala de estudio.' });
      return;
    }

    const newMember = await prisma.roomMember.create({
      data: {
        room_id: roomId,
        user_id: userToInvite.id,
        role: role as 'COLLABORATOR' | 'READER',
      },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    res.status(201).json({
      message: 'Miembro agregado exitosamente a la sala.',
      member: newMember,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno al intentar agregar al miembro.' });
  }
};