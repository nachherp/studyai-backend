from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import documents,chat,generation

app = FastAPI(
    title="StudyAI - RAG Engine API",
    description="Motor de Inteligencia Artificial para procesamiento de documentos",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Conectar las rutas modulares
app.include_router(documents.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(generation.router, prefix="/api/v1")
@app.get("/api/v1/health")
def health_check():
    return {"status": "ok", "message": "RAG Engine modular funcionando al 100%"}