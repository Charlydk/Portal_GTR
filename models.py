from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List

# --- Modelos Base (para crear y actualizar) ---

class AnalistaBase(BaseModel):
    nombre: str
    apellido: str
    email: str
    bms_id: int = Field(
        ...,
        ge=10000,      # Mayor que 999 (mínimo 4 dígitos)
        le=999999, # Menor que 100,000,000 (máximo 8 dígitos)
        description="Código único de legajo del analista (BMS ID), entero de 4 a 8 dígitos"
    )

class CampanaBase(BaseModel):
    nombre: str = Field(..., min_length=3, max_length=100) # ... indica que es requerido
    descripcion: Optional[str] = None # Optional indica que puede ser None (nulo)
    fecha_inicio: datetime
    fecha_fin: datetime

class TareaBase(BaseModel):
    titulo: str = Field(..., min_length=5, max_length=200)
    descripcion: Optional[str] = None
    fecha_inicio: datetime
    fecha_fin: datetime
    # progreso: str # Lo definiremos con un Enum más adelante para valores fijos
    id_analista: int # Asumimos que el ID del analista es un entero
    id_campana: int # Asumimos que el ID de la campaña es un entero

class ChecklistItemBase(BaseModel):
    descripcion: str = Field(..., min_length=3, max_length=200)
    # completado: bool # Lo manejaremos en el modelo de respuesta o actualización

class ComentarioCampanaBase(BaseModel):
    texto: str = Field(..., min_length=10)
    id_analista: int
    id_campana: int

class AvisoBase(BaseModel):
    titulo: str = Field(..., min_length=5, max_length=150)
    contenido: str = Field(..., min_length=10)

# --- Modelos Completos (para respuesta de la API, incluyendo IDs y valores por defecto) ---

class Analista(AnalistaBase):
    id: int # El ID se genera en la base de datos
    # Configuración para que Pydantic pueda manejar objetos ORM (como los que vendrán de la BD)
    class Config:
        from_attributes = True # Antes se usaba orm_mode = True

class Campana(CampanaBase):
    id: int
    class Config:
        from_attributes = True

# Para el progreso de la tarea, podemos usar un Enum para valores fijos
from enum import Enum

class ProgresoTarea(str, Enum):
    PENDIENTE = "Pendiente"
    EN_CURSO = "En Curso"
    COMPLETADA = "Completada"
    CANCELADA = "Cancelada"

class Tarea(TareaBase):
    id: int
    progreso: ProgresoTarea = ProgresoTarea.PENDIENTE # Valor por defecto
    class Config:
        from_attributes = True

class ChecklistItem(ChecklistItemBase):
    id: int
    completado: bool = False # Por defecto, no completado
    id_tarea: int # A qué tarea pertenece este item
    class Config:
        from_attributes = True

class ComentarioCampana(ComentarioCampanaBase):
    id: int
    fecha_creacion: datetime = Field(default_factory=datetime.now) # Se genera automáticamente
    class Config:
        from_attributes = True

class Aviso(AvisoBase):
    id: int
    fecha_publicacion: datetime = Field(default_factory=datetime.now)
    class Config:
        from_attributes = True

# --- Modelos de Relación (si necesitamos devolver una Campaña con sus Tareas, por ejemplo) ---

# Ejemplo: Una Campaña con una lista de sus Tareas
class CampanaConTareas(Campana):
    tareas: List[Tarea] = [] # Una lista de objetos Tarea

# Ejemplo: Una Tarea con sus ChecklistItems
class TareaConChecklist(Tarea):
    checklist_items: List[ChecklistItem] = []

# Nota: Estos modelos de relación se usarán cuando recuperemos datos de la base de datos
# y queramos incluir información relacionada.