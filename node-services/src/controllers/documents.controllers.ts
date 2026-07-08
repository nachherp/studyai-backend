// src/controllers/documents.controller.ts
import { type Response } from 'express';
import { type AuthRequest } from '../middlewares/requireAuth.js';
import prisma from '../lib/prisma.js';
import { supabase } from '../lib/supabase.js';
import multer from 'multer';

// ==========================================
// 📁 CONFIGURACIÓN DE MULTER (En Memoria)
// ==========================================
const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Límite de 10MB por PDF
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Formato inválido. Solo se permiten archivos PDF.'));
    }
  },
});

// ==========================================
// 🚀 CONTROLADORES DE DOCUMENTOS
// ==========================================

// 1. SUBIR DOCUMENTO (Node -> Supabase -> Prisma -> FastAPI)
export const uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { roomId } = req.params as { roomId: string };
    const userId = req.userId;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'No se adjuntó ningún archivo PDF.' });
      return;
    }

    // 1. Validar ID y limpiar el nombre del archivo para Supabase (Sin acentos ni caracteres raros)
    if (!roomId || roomId === 'PEGA_AQUI_EL_ROOM_ID') {
      res.status(400).json({ error: 'El ID de la sala es inválido. Revisa tu URL en Postman.' });
      return;
    }

    const safeFileName = file.originalname
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9.-]/g, '_');

    const uniqueFileName = `${roomId}/${Date.now()}-${safeFileName}`;

    // 2. Subir el archivo físico a Supabase Storage
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
        filename: file.originalname,      // CORRECCIÓN: name -> filename
        file_type: file.mimetype,         // Agregado por si tu schema lo requiere
        storage_path: storageData.path,   // CORRECCIÓN: file_path -> storage_path
      },
    });

    // 4. DISPARO AL MOTOR RAG (FastAPI)
    try {
      const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000';
      
      fetch(`${fastApiUrl}/api/v1/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: newDocument.id,
          roomId: roomId,
          filePath: storageData.path // Usamos storageData.path en vez de document.file_path
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

// 2. ELIMINAR DOCUMENTO (Cumpliendo la regla de simetría)
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
      .remove([document.storage_path]); // CORRECCIÓN: document.file_path -> document.storage_path

    if (deleteStorageError) {
      console.error('Advertencia: No se pudo borrar el archivo de Supabase', deleteStorageError);
    }

    // 3. Borrar el registro de PostgreSQL
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

// 3. CONSULTAR ESTADO DEL DOCUMENTO (Endpoint para el Polling del Frontend)
export const getDocumentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { roomId, documentId } = req.params as { roomId: string; documentId: string };

    // Buscamos el documento asegurándonos de que pertenezca a la sala
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

    // 🔄 MAPEO AL CONTRATO DEL FRONTEND
    // Prisma nos da `filename` y `status` (ej. "READY", "PROCESSING")
    // El front espera `title` y el status en minúsculas.
    res.status(200).json({
      document: {
        id: doc.id,
        title: doc.filename,
        status: doc.status.toLowerCase(),
        created_at: doc.created_at
      }
    });
  } catch (error) {
    console.error('❌ Error al consultar estado del documento:', error);
    res.status(500).json({ error: 'Error interno al consultar el estado del documento.' });
  }
};