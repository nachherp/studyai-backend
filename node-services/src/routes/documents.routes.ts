// src/routes/documents.routes.ts
import { Router } from 'express';
import { uploadDocument, deleteDocument, upload } from '../controllers/documents.controllers.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireRole } from '../middlewares/requireRole.js';

const router = Router({ mergeParams: true }); // mergeParams permite leer el :roomId desde el index.ts

// Todas las rutas de documentos requieren estar logueado
router.use(requireAuth);

/**
 * 🚀 SUBIR PDF
 * Endpoint: POST /api/v1/rooms/:roomId/documents
 * Seguridad: Solo OWNER y COLLABORATOR pueden subir PDFs
 * Multer intercepta el campo 'file' antes de llegar al controlador
 */
router.post(
  '/', 
  requireRole(['OWNER', 'COLLABORATOR']), 
  upload.single('file'), 
  uploadDocument
);

/**
 * 🗑️ BORRAR DOCUMENTO
 * Endpoint: DELETE /api/v1/rooms/:roomId/documents/:documentId
 * Seguridad: Solo OWNER y COLLABORATOR pueden borrar documentos
 */
router.delete(
  '/:documentId', 
  requireRole(['OWNER', 'COLLABORATOR']), 
  deleteDocument
);

export default router;