from pydantic import BaseModel, Field, EmailStr, ConfigDict
from datetime import datetime, date
from typing import Optional, List
from enum import Enum

# --- Enums ---

class ProgresoTarea(str, Enum):
    PENDIENTE = "PENDIENTE"
    EN_PROGRESO = "EN_PROGRESO"
    COMPLETADA = "COMPLETADA"
    BLOQUEADA = "BLOQUEADA"

class UserRole(str, Enum):
    SUPERVISOR = "SUPERVISOR"
    RESPONSABLE = "RESPONSABLE"
    ANALISTA = "ANALISTA"

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
    role: UserRole = UserRole.ANALISTA

class AnalistaCreate(AnalistaBase):
    password: str = Field(..., min_length=6)

class PasswordUpdate(BaseModel): # ¡NUEVO! Esquema para actualizar la contraseña
    new_password: str = Field(..., min_length=6)

class CampanaBase(BaseModel):
    nombre: str = Field(..., min_length=3, max_length=100)
    descripcion: Optional[str] = None
    fecha_inicio: datetime
    fecha_fin: Optional[datetime] = None

class TareaBase(BaseModel):
    titulo: str = Field(..., min_length=5, max_length=200)
    descripcion: Optional[str] = None
    fecha_vencimiento: Optional[datetime] = None
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

class AcuseReciboCreate(BaseModel):
    analista_id: int

# --- Modelos Completos (para respuesta de la API, incluyendo IDs y valores por defecto) ---

class Analista(AnalistaBase):
    id: int
    fecha_creacion: datetime
    esta_activo: bool
    hashed_password: str
    model_config = ConfigDict(from_attributes=True)

class Campana(CampanaBase):
    id: int
    fecha_creacion: datetime
    model_config = ConfigDict(from_attributes=True)

class Tarea(TareaBase):
    id: int
    fecha_creacion: datetime
    analista: Analista
    campana: Campana
    checklist_items: List["ChecklistItem"] = []
    model_config = ConfigDict(from_attributes=True)

class ChecklistItem(ChecklistItemBase):
    id: int
    fecha_creacion: datetime
    model_config = ConfigDict(from_attributes=True)

class ComentarioCampana(ComentarioCampanaBase):
    id: int
    fecha_creacion: datetime
    analista: Analista
    model_config = ConfigDict(from_attributes=True)

class Aviso(AvisoBase):
    id: int
    fecha_creacion: datetime
    creador: Analista
    campana: Optional[Campana] = None
    model_config = ConfigDict(from_attributes=True)

class AcuseReciboAviso(AcuseReciboAvisoBase):
    id: int
    fecha_acuse: datetime
    analista: Analista
    aviso: Aviso
    model_config = ConfigDict(from_attributes=True)

# --- Modelos para Autenticación ---

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
