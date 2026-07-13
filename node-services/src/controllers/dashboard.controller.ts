import { type Request, type Response } from 'express';
import prisma from '../lib/prisma.js';



import { type AuthRequest } from '../middlewares/requireAuth.js';

export const getDashboardMetrics = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId; 
        if (!userId) {
            return res.status(401).json({ error: 'No autorizado' });
        }

        // 1. Contar cuántas salas ha creado usando "studyRoom" (Prisma genera la propiedad en camelCase)
        const roomsOwned = await prisma.studyRoom.count({
            where: { owner_id: userId }
        });

        const roomsJoined = await prisma.roomMember.count({
            where: {
                user_id: userId,
                role: { in: ['COLLABORATOR', 'READER'] } 
            }
        });

        const totalDocuments = await prisma.document.count({
            where: {
                uploader_id: userId
            }
        });

        const recentDocuments = await prisma.document.findMany({
            where: {
                uploader_id: userId
            },
            orderBy: {
                created_at: 'desc'
            },
            take: 5,
            select: {
                id: true,
                filename: true,
                created_at: true,
                room: {
                    select: {
                        name: true
                    }
                }
            }
        });

        // Retornamos la respuesta estructurada limpia
        res.status(200).json({
            status: 'success',
            data: {
                metrics: {
                    roomsOwned,
                    roomsJoined,
                    totalDocuments,
                    totalEngagement: roomsOwned + roomsJoined + totalDocuments
                },
                recentDocuments
            }
        });
    } catch (error) {
        console.error('❌ Error al obtener métricas del dashboard:', error);
        res.status(500).json({ error: 'Error interno al procesar las métricas' });
    }
};