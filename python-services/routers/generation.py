from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.rag_service import generate_flashcards, generate_quiz

router = APIRouter()

class GenerationPayload(BaseModel):
    roomId: str
    count: int = 3

@router.post("/flashcards")
async def create_flashcards(payload: GenerationPayload):
    try:
        flashcards = generate_flashcards(room_id=payload.roomId, count=payload.count)
        return {
            "status": "success",
            "data": flashcards
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/quizzes")
async def create_quiz(payload: GenerationPayload):
    try:
        quiz = generate_quiz(room_id=payload.roomId, count=payload.count)
        return {
            "status": "success",
            "data": quiz
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))