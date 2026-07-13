import os
import re
import uuid
import json
import tempfile
from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.documents import Document
from supabase import create_client, Client
from core.config import settings

supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

embeddings_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
llm = ChatGroq(
    temperature=0,
    model_name="llama-3.3-70b-versatile",
    api_key=settings.GROQ_API_KEY
)
vector_store = Chroma(
    collection_name="study_rooms",
    embedding_function=embeddings_model,
    persist_directory="./chroma_db"
)

def process_and_vectorize_pdf(document_id: str, room_id: str, file_path: str):
    print(f"Descargando documento: {file_path}...")
    
    res = supabase.storage.from_("documents").download(file_path)
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
        tmp_file.write(res)
        tmp_path = tmp_file.name

    try:
        print("Extrayendo texto y generando chunks...")
        loader = PyPDFLoader(tmp_path)
        docs = loader.load()

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=150
        )
        chunks = text_splitter.split_documents(docs)

        for chunk in chunks:
            chunk.metadata["document_id"] = document_id
            chunk.metadata["room_id"] = room_id

        if not chunks:
            print("El documento no contiene texto extraíble.")
            supabase.table("documents").update({"status": "FAILED"}).eq("id", document_id).execute()
            return False

        print(f"Guardando {len(chunks)} vectores en ChromaDB...")
        vector_store.add_documents(chunks)
        
        # Update status to READY
        supabase.table("documents").update({"status": "READY"}).eq("id", document_id).execute()
        
        return True
        
    except Exception as e:
        # Update status to FAILED
        supabase.table("documents").update({"status": "FAILED"}).eq("id", document_id).execute()
        raise e
    finally:
        os.remove(tmp_path)
        print("Archivo temporal eliminado.")

def delete_vectors_by_document(document_id: str):
    print(f" Buscando vectores para el documento: {document_id}...")
    
    result = vector_store.get(where={"document_id": document_id})
    ids_to_delete = result.get("ids", [])

    if ids_to_delete:
        print(f" Destruyendo {len(ids_to_delete)} vectores de ChromaDB...")
        vector_store.delete(ids=ids_to_delete)
        return True
    else:
        print(" No se encontraron vectores para este documento en ChromaDB.")
        return False
    
def ask_question(room_id: str, question: str):
    print(f" Consulta en streaming para la sala {room_id}: {question}")

    docs = vector_store.similarity_search(question, k=4, filter={"room_id": room_id})
    
    context_text = "\n\n".join([doc.page_content for doc in docs])
    
    sources = sorted(list(set([int(doc.metadata.get("page", 0)) + 1 for doc in docs])))

    system_prompt = (
        "Eres un tutor de estudio experto de la plataforma StudyAI.\n"
        "Usa únicamente los siguientes fragmentos de documentos recuperados para "
        "responder a la pregunta del estudiante.\n"
        "Si la respuesta no está en el contexto, di honestamente que no lo sabes, "
        "no inventes información. Sé claro, pedagógico y conciso.\n\n"
        "Contexto recuperado:\n"
        "{context}"
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{question}"),
    ])

    final_prompt = prompt.format_messages(context=context_text, question=question)
    
    def generate():
        print(" Transmitiendo tokens desde Llama 3...")
        for chunk in llm.stream(final_prompt):
            yield chunk.content

        yield f"\n\nSOURCES_DATA:{json.dumps(sources)}"

    return generate()

def generate_flashcards(room_id: str, count: int = 3):
    count = max(1, min(count, 6))
    print(f" Generando {count} Flashcards para la sala: {room_id}...")

    try:
        docs = vector_store.similarity_search("conceptos clave, definiciones importantes, resumen", k=2, filter={"room_id": room_id})
        context_text = "\n\n".join([doc.page_content for doc in docs])

        system_prompt = (
            "Eres un creador de material didáctico experto. Tu tarea es extraer conceptos "
            f"clave del contexto proporcionado y crear exactamente {count} tarjetas de estudio.\n"
            "DEBES responder con un objeto JSON válido. La propiedad principal DEBE llamarse 'flashcards'.\n"
            "Estructura requerida:\n"
            "{{\n"
            "  \"flashcards\": [\n"
            "    {{\"front\": \"Concepto o pregunta corta\", \"back\": \"Definición o respuesta detallada\"}}\n"
            "  ]\n"
            "}}\n\n"
            "Contexto:\n"
            "{context}" 
        ) 

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "Genera las flashcards.")
        ])
        
        final_prompt = prompt.format_messages(context=context_text)
        
        llm_json = llm.bind(response_format={"type": "json_object"})
        response = llm_json.invoke(final_prompt)
        
        data = json.loads(response.content)
        flashcards = data.get("flashcards", [])

        if flashcards:
            
            insert_data = [{
                "id": str(uuid.uuid4()), 
                "room_id": room_id, 
                "front": c.get("front", ""), 
                "back": c.get("back", "")
            } for c in flashcards]
            
            supabase.table("flashcards").insert(insert_data).execute()

        return flashcards

    except Exception as e:
        print(" Falló el procesamiento de Flashcards:", str(e))
        return {"error": f"Error al generar tarjetas: {str(e)}"}


def generate_quiz(room_id: str, count: int = 3):
    count = max(1, min(count, 10))
    print(f" Generando Quiz de {count} preguntas para la sala: {room_id}...")

    try:
        docs = vector_store.similarity_search("conceptos clave, procesos, evaluaciones", k=2, filter={"room_id": room_id})
        context_text = "\n\n".join([doc.page_content for doc in docs])

        system_prompt = (
            "Eres un profesor universitario experto elaborando exámenes. Crea un cuestionario "
            f"de exactamente {count} preguntas de opción múltiple basado estrictamente en el contexto proporcionado.\n"
            "DEBES responder con un objeto JSON válido. La propiedad principal DEBE llamarse 'quiz'.\n"
            "Estructura requerida:\n"
            "{{\n"
            "  \"quiz\": [\n"
            "    {{\n"
            "      \"question\": \"Pregunta clara y directa\",\n"
            "      \"options\": [\"Opción A\", \"Opción B\", \"Opción C\", \"Opción D\"],\n"
            "      \"correct_answer\": \"Texto exacto de la opción correcta\",\n"
            "      \"explanation\": \"Breve explicación\"\n"
            "    }}\n"
            "  ]\n"
            "}}\n\n"
            "Contexto:\n"
            "{context}"
        )

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "Genera el quiz.")
        ])
        
        final_prompt = prompt.format_messages(context=context_text)
        
        llm_json = llm.bind(response_format={"type": "json_object"})
        response = llm_json.invoke(final_prompt)
        
        data = json.loads(response.content)
        quiz_questions = data.get("quiz", [])

        if quiz_questions:
           
            quiz_id = str(uuid.uuid4())
            supabase.table("quizzes").insert({
                "id": quiz_id,
                "room_id": room_id,
                "title": "Quiz Automático Llama 3",
                "type": "multiple_choice"
            }).execute()
            
            
            questions_data = [{
                "id": str(uuid.uuid4()),
                "quiz_id": quiz_id,
                "question": q.get("question", ""),
                "answer": q.get("correct_answer", ""),
                "options": q.get("options", []),
                "explanation": q.get("explanation", "")
            } for q in quiz_questions]
            
            supabase.table("quiz_questions").insert(questions_data).execute()

        return quiz_questions

    except Exception as e:
        print(" Falló el procesamiento del Quiz:", str(e))
        return {"error": f"Error al generar el cuestionario: {str(e)}"}