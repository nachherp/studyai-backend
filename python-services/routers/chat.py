from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services.rag_service import ask_question

router = APIRouter()

class ChatPayload(BaseModel):
    roomId: str
    question: str

@router.post("/chat")
async def chat_with_documents(payload: ChatPayload):
    try:
        # Obtenemos la función generadora de tokens
        token_generator = ask_question(
            room_id=payload.roomId,
            question=payload.question
        )
        
        # Retornamos el flujo continuo con formato plain text
        return StreamingResponse(token_generator, media_type="text/plain")
        
    except Exception as e:
        print(f"❌ Error en el streaming del chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))