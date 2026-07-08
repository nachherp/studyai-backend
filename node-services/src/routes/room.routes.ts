import { Router } from 'express';
import { createRoom, getMyRooms, getRoomDetails, addRoomMember } from '../controllers/rooms.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireRole } from '../middlewares/requireRole.js';

const router = Router();

router.use(requireAuth);

// Endpoint: GET /api/v1/rooms -> Obtener todas mis salas
router.get('/', getMyRooms);
router.post('/', createRoom);
router.get('/:roomId', requireRole(['OWNER', 'COLLABORATOR', 'READER']), getRoomDetails);

// Endpoint: POST /api/v1/rooms/:roomId/members -> Invitar miembro (Solo el OWNER puede invitar)
router.post('/:roomId/members', requireRole(['OWNER']), addRoomMember);

export default router;