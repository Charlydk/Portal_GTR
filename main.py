from fastapi import FastAPI, HTTPException, status
from typing import List
from models import AnalistaBase, Analista, CampanaBase, Campana, ProgresoTarea, TareaBase, Tarea, ChecklistItemBase, ChecklistItem, ComentarioCampanaBase, ComentarioCampana, AvisoBase, Aviso # Importamos todos los modelos

app = FastAPI()

# --- Simulación de Base de Datos (en memoria por ahora) ---
# En un proyecto real, esto sería una base de datos como Supabase/PostgreSQL.
# Usamos listas para simular tablas y contadores para IDs.
db_analistas = []
db_campanas = []
db_tareas = []
db_checklist_items = []
db_comentarios_campana = []
db_avisos = []

next_analista_id = 1
next_campana_id = 1
next_tarea_id = 1
next_checklist_item_id = 1
next_comentario_campana_id = 1
next_aviso_id = 1

# --- Endpoints para Analistas ---

@app.post("/analistas/", response_model=Analista, status_code=status.HTTP_201_CREATED)
def crear_analista(analista: AnalistaBase):
    """
    Crea un nuevo analista en el sistema.
    """
    global next_analista_id
    # Verificar si el bms_id ya existe
    for db_ana in db_analistas:
        if db_ana.bms_id == analista.bms_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El BMS ID ya existe.")

    new_analista = Analista(id=next_analista_id, **analista.model_dump()) # Usamos model_dump() para convertir el Pydantic model a dict
    db_analistas.append(new_analista)
    next_analista_id += 1
    return new_analista

@app.get("/analistas/", response_model=List[Analista])
def obtener_analistas():
    """
    Obtiene la lista de todos los analistas.
    """
    return db_analistas

@app.get("/analistas/{analista_id}", response_model=Analista)
def obtener_analista_por_id(analista_id: int):
    """
    Obtiene un analista específico por su ID interno.
    """
    for analista in db_analistas:
        if analista.id == analista_id:
            return analista
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado.")

@app.get("/analistas/bms/{bms_id}", response_model=Analista)
def obtener_analista_por_bms_id(bms_id: int):
    """
    Obtiene un analista específico por su BMS ID (legajo).
    """
    for analista in db_analistas:
        if analista.bms_id == bms_id:
            return analista
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado por BMS ID.")

# --- Endpoints para Campañas ---

@app.post("/campanas/", response_model=Campana, status_code=status.HTTP_201_CREATED)
def crear_campana(campana: CampanaBase):
    """
    Crea una nueva campaña en el sistema.
    """
    global next_campana_id
    new_campana = Campana(id=next_campana_id, **campana.model_dump())
    db_campanas.append(new_campana)
    next_campana_id += 1
    return new_campana

@app.get("/campanas/", response_model=List[Campana])
def obtener_campanas():
    """
    Obtiene la lista de todas las campañas.
    """
    return db_campanas

@app.get("/campanas/{campana_id}", response_model=Campana)
def obtener_campana_por_id(campana_id: int):
    """
    Obtiene una campaña específica por su ID.
    """
    for campana in db_campanas:
        if campana.id == campana_id:
            return campana
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada.")

# --- Otras rutas de ejemplo (mantendremos las originales para referencia) ---
@app.get("/")
def read_root():
    return {"message": "¡Bienvenido al Portal GTR Backend con FastAPI!"}

@app.get("/items/{item_id}")
def read_item(item_id: int, q: str | None = None):
    return {"item_id": item_id, "q": q}