from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.rag_service import process_and_vectorize_pdf, delete_vectors_by_document

router = APIRouter()

class IngestPayload(BaseModel):
    documentId: str
    roomId: str
    filePath: str

@router.post("/ingest")
async def ingest_document(payload: IngestPayload):
    try:
        process_and_vectorize_pdf(
            document_id=payload.documentId,
            room_id=payload.roomId,
            file_path=payload.filePath
        )
        return {"status": "success", "message": "Documento vectorizado exitosamente"}
    except Exception as e:
        print(f"❌ Error en ingesta: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/documents/{document_id}")
async def delete_document_vectors(document_id: str):
    try:
        deleted = delete_vectors_by_document(document_id)
        if deleted:
            return {"status": "success", "message": f"Vectores del documento {document_id} eliminados"}
        else:
            return {"status": "not_found", "message": "Vectores no encontrados, pero la petición fue exitosa"}
    except Exception as e:
        print(f"❌ Error al borrar vectores: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
