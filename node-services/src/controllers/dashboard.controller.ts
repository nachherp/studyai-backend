import { type Request, type Response } from 'express';
import prisma from '../lib/prisma.js';



export const getDashboardMetrics = async (req: Request, res: Response) => {
    try {
        // Obtenemos el ID del usuario inyectado por tu middleware requireAuth
        // @ts-ignore
        const userId = req.user.id; 

        // 1. Contar cuántas salas ha creado usando "studyRoom" (Prisma genera la propiedad en camelCase)
        const roomsOwned = await prisma.studyRoom.count({
            where: { owner_id: userId }
        });

        // 2. Contar a cuántas salas pertenece como invitado
        const roomsJoined = await prisma.roomMember.count({
            where: {
                user_id: userId,
                role: { in: ['COLLABORATOR', 'READER'] } 
            }
        });

        // 3. Contar cuántos documentos ha subido el usuario en total en la plataforma
        const totalDocuments = await prisma.document.count({
            where: {
                uploader_id: userId
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
                }
            }
        });
    } catch (error) {
        console.error('❌ Error al obtener métricas del dashboard:', error);
        res.status(500).json({ error: 'Error interno al procesar las métricas' });
    }
};