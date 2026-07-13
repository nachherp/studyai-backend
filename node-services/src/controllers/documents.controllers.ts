import { type Response } from 'express';
import { type AuthRequest } from '../middlewares/requireAuth.js';
import prisma from '../lib/prisma.js';
import { supabase } from '../lib/supabase.js';
import multer from 'multer';

const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, 
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Formato inválido. Solo se permiten archivos PDF.'));
    }
  },
});


export const uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { roomId } = req.params as { roomId: string };
    const userId = req.userId;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'No se adjuntó ningún archivo PDF.' });
      return;
    }

    if (!roomId || roomId === 'PEGA_AQUI_EL_ROOM_ID') {
      res.status(400).json({ error: 'El ID de la sala es inválido. Revisa tu URL en Postman.' });
      return;
    }

    const utf8OriginalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const safeFileName = utf8OriginalName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9.-]/g, '_');

    const uniqueFileName = `${roomId}/${Date.now()}-${safeFileName}`;

    const { data: storageData, error: storageError } = await supabase.storage
      .from('documents')
      .upload(uniqueFileName, file.buffer, {
        contentType: 'application/pdf',
      });

    if (storageError) {
      throw new Error(`Error en Supabase Storage: ${storageError.message}`);
    }

    // 3. Guardar el registro en la base de datos usando los nombres correctos de tu Schema
    const newDocument = await prisma.document.create({
      data: {
        room_id: roomId,
        uploader_id: userId!,
        filename: file.originalname,      
        file_type: file.mimetype,         
        storage_path: storageData.path,   
      },
    });

    try {
      const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000';
      
      fetch(`${fastApiUrl}/api/v1/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: newDocument.id,
          roomId: roomId,
          filePath: storageData.path 
        }),
      }).catch(err => console.error('Error enviando a FastAPI:', err));
      
    } catch (apiError) {
      console.error('El servicio de FastAPI no respondió.');
    }

    res.status(201).json({
      message: 'Documento subido y en proceso de vectorización.',
      document: newDocument,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno al procesar el documento.' });
  }
};

export const deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { roomId, documentId } = req.params as { roomId: string; documentId: string };

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document || document.room_id !== roomId) {
      res.status(404).json({ error: 'Documento no encontrado en esta sala.' });
      return;
    }

    const { error: deleteStorageError } = await supabase.storage
      .from('documents')
      .remove([document.storage_path]); 

    if (deleteStorageError) {
      console.error('Advertencia: No se pudo borrar el archivo de Supabase', deleteStorageError);
    }

    await prisma.document.delete({
      where: { id: documentId },
    });

    // 4. DISPARO AL MOTOR RAG (FastAPI)
    try {
      const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000';
      
      fetch(`${fastApiUrl}/api/v1/documents/${documentId}`, {
        method: 'DELETE',
      }).catch(err => console.error('Error mandando orden de borrado a FastAPI:', err));

    } catch (apiError) {
      console.error('El servicio de FastAPI no respondió al borrado.');
    }

    res.status(200).json({ message: 'Documento, archivo físico y vectores eliminados correctamente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno al eliminar el documento.' });
  }
};

export const getDocumentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { roomId, documentId } = req.params as { roomId: string; documentId: string };

    const doc = await prisma.document.findFirst({
      where: {
        id: documentId,
        room_id: roomId
      }
    });

    if (!doc) {
      res.status(404).json({ error: 'Documento no encontrado en esta sala.' });
      return;
    }

    
    res.status(200).json({
      document: {
        id: doc.id,
        title: doc.filename,
        status: doc.status.toLowerCase(),
        created_at: doc.created_at,
        storage_path: doc.storage_path
      }
    });
  } catch (error) {
    console.error(' Error al consultar estado del documento:', error);
    res.status(500).json({ error: 'Error interno al consultar el estado del documento.' });
  }
};