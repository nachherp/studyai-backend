import os
import re
import json
import tempfile
from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
# ✅ Reemplaza las importaciones viejas de chains por estas de langchain_core
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from supabase import create_client, Client
from core.config import settings

# 1. Conexión a Supabase
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

# 2. IA y Vectores
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
    """Descarga el PDF, lo procesa y guarda los vectores."""
    print(f"📥 Descargando documento: {file_path}...")
    
    # Descargar de Supabase
    res = supabase.storage.from_("documents").download(file_path)
    
    # Archivo temporal
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
        tmp_file.write(res)
        tmp_path = tmp_file.name

    try:
        print("📄 Extrayendo texto y generando chunks...")
        loader = PyPDFLoader(tmp_path)
        docs = loader.load()

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=150
        )
        chunks = text_splitter.split_documents(docs)

        # Inyectar metadatos
        for chunk in chunks:
            chunk.metadata["document_id"] = document_id
            chunk.metadata["room_id"] = room_id

        print(f"🧠 Guardando {len(chunks)} vectores en ChromaDB...")
        vector_store.add_documents(chunks)
        return True
        
    finally:
        # Limpieza simétrica
        os.remove(tmp_path)
        print("🧹 Archivo temporal eliminado.")

def delete_vectors_by_document(document_id: str):
    """Busca y elimina todos los vectores asociados a un documento específico."""
    print(f"🗑️ Buscando vectores para el documento: {document_id}...")
    
    # 1. Buscar los IDs internos de Chroma que coinciden con nuestro metadata
    result = vector_store.get(where={"document_id": document_id})
    ids_to_delete = result.get("ids", [])

    # 2. Si existen, los eliminamos físicamente de la base de datos
    if ids_to_delete:
        print(f"🧨 Destruyendo {len(ids_to_delete)} vectores de ChromaDB...")
        vector_store.delete(ids=ids_to_delete)
        return True
    else:
        print("⚠️ No se encontraron vectores para este documento en ChromaDB.")
        return False
    
import json # Asegúrate de tener esta importación arriba si no está

def ask_question(room_id: str, question: str):
    """Recupera contexto y transmite la respuesta en streaming incluyendo las páginas fuente."""
    print(f"💬 Consulta en streaming para la sala {room_id}: {question}")

    # 1. Buscar los fragmentos en ChromaDB filtrando por la sala correcta
    docs = vector_store.similarity_search(question, k=4, filter={"room_id": room_id})
    
    # 2. Extraer el texto y recolectar las páginas fuente de los metadatos (evitando duplicados)
    context_text = "\n\n".join([doc.page_content for doc in docs])
    
    # Extraemos el número de página sumándole 1 (porque PyPDFLoader empieza en la página 0)
    sources = sorted(list(set([int(doc.metadata.get("page", 0)) + 1 for doc in docs])))

    # 3. Diseñar el System Prompt instructivo
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
    
    # 4. FUNCIÓN GENERADORA: Va enviando los datos en tiempo real
    def generate():
        print("🧠 Transmitiendo tokens desde Llama 3...")
        # Usamos .stream() en lugar de .invoke() para recibir palabra por palabra
        for chunk in llm.stream(final_prompt):
            # Enviamos el fragmento de texto puro al cliente
            yield chunk.content

        # Al finalizar el texto de la IA, enviamos una última línea con las fuentes en formato JSON
        # Esto le permitirá a nuestro playground pintarlas de forma limpia
        yield f"\n\nSOURCES_DATA:{json.dumps(sources)}"

    return generate()



def generate_flashcards(room_id: str):
    """Genera flashcards utilizando el JSON Mode nativo de Groq."""
    print(f"🃏 Generando Flashcards para la sala: {room_id}...")

    try:
        docs = vector_store.similarity_search("conceptos clave, definiciones importantes, resumen", k=2, filter={"room_id": room_id})
        context_text = "\n\n".join([doc.page_content for doc in docs])

        system_prompt = (
            "Eres un creador de material didáctico experto. Tu tarea es extraer conceptos "
            "clave del contexto proporcionado y crear 3 tarjetas de estudio.\n"
            "DEBES responder con un objeto JSON válido. La propiedad principal DEBE llamarse 'flashcards'.\n"
            "Estructura requerida:\n"
            "{{\n"
            "  \"flashcards\": [\n"
            "    {{\"front\": \"Concepto o pregunta corta\", \"back\": \"Definición o respuesta detallada\"}}\n"
            "  ]\n"
            "}}\n\n"
            "Contexto:\n"
            "{context}" 
        ) # ☝️ Nota cómo {context} es el único con una sola llave

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "Genera las flashcards.")
        ])
        
        final_prompt = prompt.format_messages(context=context_text)
        
        llm_json = llm.bind(response_format={"type": "json_object"})
        response = llm_json.invoke(final_prompt)
        
        data = json.loads(response.content)
        return data.get("flashcards", [])

    except Exception as e:
        print("❌ Falló el procesamiento de Flashcards:", str(e))
        return {"error": f"Error al generar tarjetas: {str(e)}"}

def generate_quiz(room_id: str):
    """Genera un quiz utilizando el JSON Mode nativo de Groq."""
    print(f"📝 Generando Quiz para la sala: {room_id}...")

    try:
        docs = vector_store.similarity_search("conceptos clave, procesos, evaluaciones", k=2, filter={"room_id": room_id})
        context_text = "\n\n".join([doc.page_content for doc in docs])

        system_prompt = (
            "Eres un profesor universitario experto elaborando exámenes. Crea un cuestionario "
            "de 3 preguntas de opción múltiple basado estrictamente en el contexto proporcionado.\n"
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
        return data.get("quiz", [])

    except Exception as e:
        print("❌ Falló el procesamiento del Quiz:", str(e))
        return {"error": f"Error al generar el cuestionario: {str(e)}"}