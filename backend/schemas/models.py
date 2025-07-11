from pydantic import BaseModel, Field, EmailStr, ConfigDict
from datetime import datetime
from typing import Optional, List
from enum import Enum

# --- 1. Modelos para Autenticación (Son independientes, van primero) ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# --- 2. Enums ---
class ProgresoTarea(str, Enum):
    PENDIENTE = "PENDIENTE"
    EN_PROGRESO = "EN_PROGRESO"
    COMPLETADA = "COMPLETADA"
    BLOQUEADA = "BLOQUEADA"

class UserRole(str, Enum):
    SUPERVISOR = "SUPERVISOR"
    RESPONSABLE = "RESPONSABLE"
    ANALISTA = "ANALISTA"

# --- 3. Base Models (Definiciones básicas de campos, sin relaciones complejas) ---
class AnalistaBase(BaseModel):
    nombre: str
    apellido: str
    email: EmailStr
    bms_id: int = Field(..., ge=10000, le=99999999)
    role: UserRole = UserRole.ANALISTA

class PasswordUpdate(BaseModel):
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

# --- 4. Create Models (Extienden las bases con campos adicionales para creación) ---
class AnalistaCreate(AnalistaBase):
    password: str = Field(..., min_length=6)

# --- 5. Simple Models (Versiones ligeras para evitar recursión en relaciones) ---
# ¡CRÍTICO! Definimos todas las versiones "Simple" aquí, antes de los modelos completos
class AnalistaSimple(BaseModel):
    id: int
    nombre: str
    apellido: str
    email: EmailStr
    bms_id: int
    class Config:
        from_attributes = True

class CampanaSimple(BaseModel):
    id: int
    nombre: str
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
    class Config:
        from_attributes = True

class AvisoSimple(BaseModel): # Versión simple de Aviso para AcuseReciboAviso
    id: int
    titulo: str
    class Config:
        from_attributes = True

class AcuseReciboAvisoSimple(BaseModel): # Versión simple de AcuseReciboAviso para Aviso
    id: int
    fecha_acuse: datetime
    class Config:
        from_attributes = True

# --- 6. Full Models (Modelos de respuesta de la API, incluyen IDs y relaciones) ---
# Estos modelos ahora pueden referenciar a los "Simple Models" sin problemas.
class Analista(AnalistaBase):
    id: int
    fecha_creacion: datetime
    esta_activo: bool
    hashed_password: str
    campanas_asignadas: List["CampanaSimple"] = [] # Usa el Simple Model
    class Config:
        from_attributes = True

class Campana(CampanaBase):
    id: int
    fecha_creacion: datetime
    analistas_asignados: List["AnalistaSimple"] = [] # Usa el Simple Model
    class Config:
        from_attributes = True

class Tarea(TareaBase):
    id: int
    fecha_creacion: datetime
    analista: AnalistaSimple
    campana: CampanaSimple
    checklist_items: List["ChecklistItemSimple"] = [] # Usa el Simple Model
    class Config:
        from_attributes = True

class ChecklistItem(ChecklistItemBase):
    id: int
    fecha_creacion: datetime
    class Config:
        from_attributes = True

class ComentarioCampana(ComentarioCampanaBase):
    id: int
    fecha_creacion: datetime
    analista: AnalistaSimple
    campana: CampanaSimple
    class Config:
        from_attributes = True

class Aviso(AvisoBase):
    id: int
    fecha_creacion: datetime
    creador_id: int
    creador: AnalistaSimple
    campana: Optional[CampanaSimple] = None
    acuses_recibo: List["AcuseReciboAvisoSimple"] = [] # Usa el Simple Model
    class Config:
        from_attributes = True

class AcuseReciboAviso(AcuseReciboAvisoBase):
    id: int
    fecha_acuse: datetime
    analista: AnalistaSimple
    aviso: AvisoSimple # Usa el Simple Model para evitar recursión profunda
    class Config:
        from_attributes = True

# --- 7. Rebuild Models (¡CRÍTICO! Para resolver referencias adelantadas) ---
# Llama a model_rebuild() para cada modelo que pueda tener forward references.
# Esto debe hacerse DESPUÉS de que todas las clases estén definidas.
Analista.model_rebuild()
Campana.model_rebuild()
Tarea.model_rebuild()
ChecklistItem.model_rebuild()
ComentarioCampana.model_rebuild()
Aviso.model_rebuild()
AcuseReciboAviso.model_rebuild()
