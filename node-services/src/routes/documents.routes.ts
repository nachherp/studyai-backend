import { Router } from 'express';
import { uploadDocument, deleteDocument, getDocumentStatus, upload } from '../controllers/documents.controllers.js'; 
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireRole } from '../middlewares/requireRole.js';

const router = Router({ mergeParams: true }); 

router.use(requireAuth);


router.post(
  '/', 
  requireRole(['OWNER', 'COLLABORATOR']), 
  upload.single('file'), 
  uploadDocument
);


router.delete(
  '/:documentId', 
  requireRole(['OWNER', 'COLLABORATOR']), 
  deleteDocument
);


router.get(
  '/:documentId', 
  requireRole(['OWNER', 'COLLABORATOR', 'READER']), 
  getDocumentStatus
);

export default router;