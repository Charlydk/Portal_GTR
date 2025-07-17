from pydantic import BaseModel
from datetime import datetime, date # Importar 'date'
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

class TareaUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    fecha_vencimiento: Optional[datetime] = None
    progreso: Optional[ProgresoTarea] = None
    analista_id: Optional[int] = None
    campana_id: Optional[int] = None

class ChecklistItemBase(BaseModel):
    tarea_id: int
    descripcion: str
    completado: Optional[bool] = False

class ChecklistItemUpdate(BaseModel):
    tarea_id: Optional[int] = None
    descripcion: Optional[str] = None
    completado: Optional[bool] = None

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

# --- ESQUEMAS DE INCIDENCIA (Base y Create) ---
class IncidenciaBase(BaseModel):
    comentario: Optional[str] = None
    horario: str # Formato "HH:MM"
    tipo_incidencia: str # Ej. "tecnica", "operativa", "otra"
    analista_id: int # El ID del analista que registra la incidencia

class IncidenciaCreate(IncidenciaBase):
    pass # No hay campos adicionales requeridos para la creación por ahora

# --- ESQUEMAS DE BITÁCORA (Base y Update) ---
class BitacoraEntryBase(BaseModel):
    campana_id: int
    fecha: date # ¡NUEVO: Campo 'fecha' requerido en la base!
    hora: str # Formato "HH:MM"
    comentario: Optional[str] = None

class BitacoraEntryUpdate(BaseModel):
    fecha: Optional[date] = None # ¡NUEVO: Campo 'fecha' opcional para actualización!
    hora: Optional[str] = None
    comentario: Optional[str] = None

class BitacoraGeneralCommentBase(BaseModel):
    campana_id: int
    comentario: Optional[str] = None

class BitacoraGeneralCommentUpdate(BaseModel):
    comentario: Optional[str] = None


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

class TareaListOutput(BaseModel):
    id: int
    titulo: str
    descripcion: Optional[str] = None
    fecha_vencimiento: datetime
    progreso: ProgresoTarea
    analista_id: int
    campana_id: int
    fecha_creacion: datetime
    analista: AnalistaSimple
    campana: CampanaSimple
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

class AvisoListOutput(BaseModel):
    id: int
    titulo: str
    contenido: str
    fecha_vencimiento: Optional[datetime] = None
    fecha_creacion: datetime
    creador_id: int
    campana_id: Optional[int] = None
    creador: AnalistaSimple
    campana: Optional[CampanaSimple] = None
    class Config:
        from_attributes = True


class AcuseReciboAvisoSimple(BaseModel):
    id: int
    aviso_id: int
    analista_id: int
    fecha_acuse: datetime
    class Config:
        from_attributes = True

# --- ESQUEMAS DE INCIDENCIA (Simple) ---
class IncidenciaSimple(BaseModel):
    id: int
    horario: str
    tipo_incidencia: str
    fecha_registro: datetime
    class Config:
        from_attributes = True

# --- ESQUEMAS DE BITÁCORA (Simple) ---
class BitacoraEntrySimple(BaseModel):
    id: int
    fecha: date # ¡NUEVO: Campo 'fecha' en el esquema simple!
    hora: str
    comentario: Optional[str] = None
    fecha_creacion: datetime
    fecha_ultima_actualizacion: datetime
    class Config:
        from_attributes = True

class BitacoraGeneralCommentSimple(BaseModel):
    id: int
    comentario: Optional[str] = None
    fecha_creacion: datetime
    fecha_ultima_actualizacion: datetime
    class Config:
        from_attributes = True


# --- Full Schemas (Output con relaciones seleccionadas usando los modelos "Simple") ---
class Analista(AnalistaBase):
    id: int
    fecha_creacion: datetime
    esta_activo: bool
    campanas_asignadas: List["CampanaSimple"] = []
    tareas: List["TareaSimple"] = []
    avisos_creados: List["AvisoSimple"] = []
    acuses_recibo_avisos: List["AcuseReciboAvisoSimple"] = []
    incidencias_registradas: List["IncidenciaSimple"] = []

    class Config:
        from_attributes = True

class Campana(CampanaBase):
    id: int
    fecha_creacion: datetime
    analistas_asignados: List["AnalistaSimple"] = []
    tareas: List["TareaSimple"] = []
    comentarios: List["ComentarioCampanaSimple"] = []
    avisos: List["AvisoSimple"] = []
    bitacora_entries: List["BitacoraEntrySimple"] = []
    bitacora_general_comment: Optional["BitacoraGeneralCommentSimple"] = None
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

# --- ESQUEMAS DE INCIDENCIA (Full) ---
class Incidencia(IncidenciaBase):
    id: int
    fecha_registro: datetime
    analista: "AnalistaSimple"
    class Config:
        from_attributes = True

# --- ESQUEMAS DE BITÁCORA (Full) ---
class BitacoraEntry(BitacoraEntryBase):
    id: int
    fecha_creacion: datetime
    fecha_ultima_actualizacion: datetime
    class Config:
        from_attributes = True

class BitacoraGeneralComment(BitacoraGeneralCommentBase):
    id: int
    fecha_creacion: datetime
    fecha_ultima_actualizacion: datetime
    class Config:
        from_attributes = True


# Para autenticación
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[UserRole] = None
