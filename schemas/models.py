from pydantic import BaseModel, Field, EmailStr
from datetime import datetime, date # Importamos 'date' si lo vamos a usar para campos solo de fecha
from typing import Optional, List
from enum import Enum

# --- Enums ---

class ProgresoTarea(str, Enum):
    PENDIENTE = "PENDIENTE"
    EN_PROGRESO = "EN_PROGRESO"
    COMPLETADA = "COMPLETADA"
    BLOQUEADA = "BLOQUEADA"

# --- Modelos Base (para crear y actualizar) ---

class AnalistaBase(BaseModel):
    nombre: str
    apellido: str
    email: EmailStr # Usamos EmailStr para validación de formato de email
    bms_id: int = Field(
        ...,
        ge=10000,       # Mayor que 999 (mínimo 4 dígitos)
        le=99999999,    # Máximo 8 dígitos
        description="Código único de legajo del analista (BMS ID), entero de 4 a 8 dígitos"
    )

class CampanaBase(BaseModel):
    nombre: str = Field(..., min_length=3, max_length=100)
    descripcion: Optional[str] = None
    fecha_inicio: datetime # Las fechas las manejamos como datetime por el error de la zona horaria
    fecha_fin: Optional[datetime] = None # Opcional y puede ser None

class TareaBase(BaseModel):
    titulo: str = Field(..., min_length=5, max_length=200)
    descripcion: Optional[str] = None
    # Eliminamos fecha_inicio y fecha_fin aquí si solo usas fecha_vencimiento en la DB
    fecha_vencimiento: Optional[datetime] = None # Opcional y puede ser None
    progreso: ProgresoTarea = ProgresoTarea.PENDIENTE # Valor por defecto

    analista_id: int # Cambiado a 'analista_id' para consistencia con SQLAlchemy
    campana_id: int  # Cambiado a 'campana_id' para consistencia con SQLAlchemy

class ChecklistItemBase(BaseModel):
    descripcion: str = Field(..., min_length=3, max_length=200)

class ComentarioCampanaBase(BaseModel):
    contenido: str = Field(..., min_length=10) # Cambiado a 'contenido' para consistencia
    analista_id: int # Cambiado a 'analista_id'
    campana_id: int  # Cambiado a 'campana_id'

class AvisoBase(BaseModel):
    titulo: str = Field(..., min_length=5, max_length=150)
    contenido: str = Field(..., min_length=10)
    # fecha_publicacion no está aquí, se genera en la DB/respuesta
    fecha_vencimiento: Optional[datetime] = None # Opcional y puede ser None
    # creador_id y campana_id se agregarán en el modelo completo o en la lógica del endpoint

# --- Modelos Completos (para respuesta de la API, incluyendo IDs y valores por defecto) ---

class Analista(AnalistaBase):
    id: int
    fecha_creacion: datetime # Agregado para que coincida con lo que devuelve la DB
    class Config:
        from_attributes = True

class Campana(CampanaBase):
    id: int
    fecha_creacion: datetime # Agregado para que coincida con lo que devuelve la DB
    class Config:
        from_attributes = True

class Tarea(TareaBase):
    id: int
    fecha_creacion: datetime # Agregado para que coincida con lo que devuelve la DB
    class Config:
        from_attributes = True

class ChecklistItem(ChecklistItemBase):
    id: int
    completado: bool = False # Por defecto, no completado
    tarea_id: int # Clave foránea, debe estar aquí para que Pydantic la maneje
    fecha_creacion: datetime # Agregado para que coincida con lo que devuelve la DB
    class Config:
        from_attributes = True

class ComentarioCampana(ComentarioCampanaBase):
    id: int
    fecha_creacion: datetime # Se genera automáticamente
    class Config:
        from_attributes = True

class Aviso(AvisoBase):
    id: int
    fecha_creacion: datetime # Se genera automáticamente
    creador_id: int # Agregado para mostrar quién lo creó
    campana_id: Optional[int] = None # Agregado, puede ser None
    class Config:
        from_attributes = True

# --- Modelos de Relación (si necesitamos devolver una Campaña con sus Tareas, por ejemplo) ---
# Estos son opcionales y los usarías más adelante cuando traigas relaciones de la DB

class CampanaConTareas(Campana):
    tareas: List["Tarea"] = [] # Uso de comillas para referencia forward (evitar dependencia circular)

class TareaConChecklist(Tarea):
    checklist_items: List["ChecklistItem"] = []

# Nota: Asegúrate de importar estos modelos de relación en main.py si los vas a usar