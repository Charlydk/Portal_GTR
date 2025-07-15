from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
import enum

class UserRole(str, enum.Enum):
    ANALISTA = "ANALISTA"
    SUPERVISOR = "SUPERVISOR"
    RESPONSABLE = "RESPONSABLE"

class ProgresoTarea(str, enum.Enum):
    PENDIENTE = "PENDIENTE"
    EN_PROGRESO = "EN_PROGRESO"
    COMPLETADA = "COMPLETADA"
    CANCELADA = "CANCELADA"

# --- Base Schemas (Input/Creation) ---
class AnalistaBase(BaseModel):
    nombre: str
    apellido: str
    email: str
    bms_id: int
    role: UserRole
    esta_activo: Optional[bool] = True

class AnalistaCreate(AnalistaBase):
    password: str

class PasswordUpdate(BaseModel):
    new_password: str

class CampanaBase(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None

class TareaBase(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    fecha_vencimiento: datetime
    progreso: ProgresoTarea
    analista_id: int
    campana_id: int

class ChecklistItemBase(BaseModel):
    tarea_id: int
    descripcion: str
    completado: Optional[bool] = False

class ComentarioCampanaBase(BaseModel):
    campana_id: int
    analista_id: int
    contenido: str

class AvisoBase(BaseModel):
    titulo: str
    contenido: str
    fecha_vencimiento: Optional[datetime] = None
    creador_id: int
    campana_id: Optional[int] = None

class AcuseReciboCreate(BaseModel):
    analista_id: int

# --- Simple Schemas (Para romper dependencias circulares en la salida) ---
class AnalistaSimple(BaseModel):
    id: int
    nombre: str
    apellido: str
    email: str
    bms_id: int
    role: UserRole
    esta_activo: bool
    fecha_creacion: datetime
    class Config:
        from_attributes = True

# Esquema ligero para el usuario actual (GET /users/me/)
class AnalistaMe(BaseModel):
    id: int
    nombre: str
    apellido: str
    email: str
    bms_id: int
    role: UserRole
    esta_activo: bool
    fecha_creacion: datetime
    class Config:
        from_attributes = True


class CampanaSimple(BaseModel):
    id: int
    nombre: str
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    class Config:
        from_attributes = True

class TareaSimple(BaseModel):
    id: int
    titulo: str
    progreso: ProgresoTarea
    fecha_vencimiento: datetime
    class Config:
        from_attributes = True

# Esquema para listas de tareas, sin checklist_items
class TareaListOutput(BaseModel):
    id: int
    titulo: str
    descripcion: Optional[str] = None
    fecha_vencimiento: datetime
    progreso: ProgresoTarea
    analista_id: int
    campana_id: int
    fecha_creacion: datetime
    analista: AnalistaSimple # Incluimos el analista para mostrar su nombre en la lista
    campana: CampanaSimple # Incluimos la campaña para mostrar su nombre en la lista
    class Config:
        from_attributes = True


class ChecklistItemSimple(BaseModel):
    id: int
    descripcion: str
    completado: bool
    class Config:
        from_attributes = True

class ComentarioCampanaSimple(BaseModel):
    id: int
    contenido: str
    fecha_creacion: datetime
    analista_id: int
    campana_id: int
    class Config:
        from_attributes = True

class AvisoSimple(BaseModel):
    id: int
    titulo: str
    contenido: str
    fecha_creacion: datetime
    creador_id: int
    campana_id: Optional[int] = None
    class Config:
        from_attributes = True

# ¡NUEVO ESQUEMA AQUÍ! Para listas de avisos, sin acuses_recibo
class AvisoListOutput(BaseModel):
    id: int
    titulo: str
    contenido: str
    fecha_vencimiento: Optional[datetime] = None
    fecha_creacion: datetime
    creador_id: int
    campana_id: Optional[int] = None
    creador: AnalistaSimple # Para mostrar el nombre del creador en la lista
    campana: Optional[CampanaSimple] = None # Para mostrar el nombre de la campaña en la lista
    class Config:
        from_attributes = True


class AcuseReciboAvisoSimple(BaseModel):
    id: int
    aviso_id: int
    analista_id: int
    fecha_acuse: datetime
    class Config:
        from_attributes = True


# --- Full Schemas (Output con relaciones seleccionadas usando los modelos "Simple") ---
class Analista(AnalistaBase):
    id: int
    fecha_creacion: datetime
    esta_activo: bool
    campanas_asignadas: List["CampanaSimple"] = []
    tareas: List["TareaSimple"] = []
    comentarios_campana: List["ComentarioCampanaSimple"] = []
    avisos_creados: List["AvisoSimple"] = []
    acuses_recibo_dados: List["AcuseReciboAvisoSimple"] = []
    class Config:
        from_attributes = True

class Campana(CampanaBase):
    id: int
    fecha_creacion: datetime
    analistas_asignados: List["AnalistaSimple"] = []
    tareas: List["TareaSimple"] = []
    comentarios: List["ComentarioCampanaSimple"] = []
    avisos: List["AvisoSimple"] = []
    class Config:
        from_attributes = True

class Tarea(TareaBase):
    id: int
    fecha_creacion: datetime
    analista: "AnalistaSimple"
    campana: "CampanaSimple"
    checklist_items: List["ChecklistItemSimple"] = []
    class Config:
        from_attributes = True

class ChecklistItem(ChecklistItemBase):
    id: int
    fecha_creacion: datetime
    tarea: "TareaSimple"
    class Config:
        from_attributes = True

class ComentarioCampana(ComentarioCampanaBase):
    id: int
    fecha_creacion: datetime
    campana: "CampanaSimple"
    analista: "AnalistaSimple"
    class Config:
        from_attributes = True

class Aviso(AvisoBase):
    id: int
    fecha_creacion: datetime
    creador: "AnalistaSimple"
    campana: Optional["CampanaSimple"] = None
    acuses_recibo: List["AcuseReciboAvisoSimple"] = []
    class Config:
        from_attributes = True

class AcuseReciboAviso(AcuseReciboCreate):
    id: int
    fecha_acuse: datetime
    analista: "AnalistaSimple"
    aviso: "AvisoSimple"
    class Config:
        from_attributes = True

# Para autenticación
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[UserRole] = None
