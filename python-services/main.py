from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Inicializar FastAPI
app = FastAPI(
    title="StudyAI - RAG Engine API",
    description="Motor de Inteligencia Artificial para procesamiento de documentos",
    version="1.0.0"
)

# Configurar CORS para permitir peticiones de otros servicios
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # En producción, aquí pondremos la URL de Vercel
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health Check Endpoint
@app.get("/api/v1/health")
def health_check():
    return {
        "status": "ok",
        "message": "RAG Engine FastAPI funcionando correctamente",
        "service": "python-services"
    }