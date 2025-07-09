from pydantic import BaseModel, Field, EmailStr, ConfigDict # Importamos ConfigDict
from datetime import datetime, date
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
    email: EmailStr
    bms_id: int = Field(
        ...,
        ge=10000,
        le=99999999,
        description="Código único de legajo del analista (BMS ID), entero de 4 a 8 dígitos"
    )

class CampanaBase(BaseModel):
    nombre: str = Field(..., min_length=3, max_length=100)
    descripcion: Optional[str] = None
    fecha_inicio: datetime
    fecha_fin: Optional[datetime] = None

class TareaBase(BaseModel):
    titulo: str = Field(..., min_length=5, max_length=200)
    descripcion: Optional[str] = None
    fecha_vencimiento: Optional[datetime] = None # Usamos datetime para consistencia con tu DB
    progreso: ProgresoTarea = ProgresoTarea.PENDIENTE

    analista_id: int
    campana_id: int

class ChecklistItemBase(BaseModel):
    descripcion: str = Field(..., min_length=3, max_length=200)
    completado: bool = False
    tarea_id: int

class ComentarioCampanaBase(BaseModel):
    contenido: str = Field(..., min_length=10)
    analista_id: int
    campana_id: int

class AvisoBase(BaseModel):
    titulo: str = Field(..., min_length=3, max_length=100)
    contenido: str = Field(..., min_length=10)
    fecha_vencimiento: Optional[datetime] = None
    creador_id: int
    campana_id: Optional[int] = None

class AcuseReciboAvisoBase(BaseModel):
    aviso_id: int
    analista_id: int

# --- Modelos Completos (para respuesta de la API, incluyendo IDs y valores por defecto) ---

# Declaración forward para evitar problemas de referencia circular
class Analista(AnalistaBase):
    id: int
    fecha_creacion: datetime
    esta_activo: bool # ¡Añadido el campo esta_activo!
    # No es necesario poner las relaciones inversas aquí a menos que quieras anidarlas en el response de Analista
    # tareas: List["Tarea"] = [] # Ejemplo si quisieras que un Analista incluyera sus tareas
    # avisos_creados: List["Aviso"] = []
    # comentarios: List["ComentarioCampana"] = []
    # acuses_recibo: List["AcuseReciboAviso"] = []
    model_config = ConfigDict(from_attributes=True)

class Campana(CampanaBase):
    id: int
    fecha_creacion: datetime
    # No es necesario poner las relaciones inversas aquí a menos que quieras anidarlas en el response de Campana
    # tareas: List["Tarea"] = []
    # comentarios: List["ComentarioCampana"] = []
    # avisos: List["Aviso"] = []
    model_config = ConfigDict(from_attributes=True)

class Tarea(TareaBase):
    id: int
    fecha_creacion: datetime
    analista: Analista  # ¡QUITAMOS Optional y el valor por defecto!
    campana: Campana    # ¡QUITAMOS Optional y el valor por defecto!
    # checklist_items: List["ChecklistItem"] = []
    model_config = ConfigDict(from_attributes=True)

class ChecklistItem(ChecklistItemBase):
    id: int
    fecha_creacion: datetime
    # tarea_parent: Tarea # Si necesitas el objeto Tarea anidado aquí (probablemente no)
    model_config = ConfigDict(from_attributes=True)

class ComentarioCampana(ComentarioCampanaBase):
    id: int
    fecha_creacion: datetime
    # analista: Analista # Puedes anidar el analista y campana si quieres
    # campana: Campana
    model_config = ConfigDict(from_attributes=True)

class Aviso(AvisoBase):
    id: int
    fecha_creacion: datetime
    # creador: Analista # Puedes anidar el creador y campaña si quieres
    # campana: Campana
    # acuses_recibo: List["AcuseReciboAviso"] = []
    model_config = ConfigDict(from_attributes=True)

class AcuseReciboAviso(AcuseReciboAvisoBase):
    id: int
    fecha_acuse: datetime
    # aviso: Aviso # Puedes anidar el aviso y analista si quieres
    # analista: Analista
    model_config = ConfigDict(from_attributes=True)


# --- Modelos de Relación (ejemplos de anidación si las necesitas) ---
# Se recomienda definir estos solo si realmente necesitas devolver una lista de objetos
# anidados dentro de otro objeto en tu API. Por ahora, no son estrictamente necesarios
# para el problema actual de "Ver Tarea" si solo necesitas Analista y Campana directamente en Tarea.

# class CampanaConTareas(Campana):
#     tareas: List[Tarea] = [] # Ya Tarea está definida, no necesitas comillas

# class TareaConChecklist(Tarea):
#     checklist_items: List[ChecklistItem] = []


# --- ¡Importante! Resolviendo referencias forward ---
# Si usaras CampanaConTareas o TareaConChecklist donde una referencia circular fuera un problema,
# Pydantic v2 maneja esto de forma más automática con el model_config, pero para referencias
# directas dentro del mismo archivo, generalmente no es un problema si el orden de definición es lógico.
# Si tuvieras problemas con esto, la forma más explícita es:
# Campana.model_rebuild()
# Tarea.model_rebuild()
# Analista.model_rebuild()
