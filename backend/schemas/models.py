from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, date, time
from typing import List, Optional
# --- CORRECCIÓN 1: Nos aseguramos de importar los Enums correctos desde enums.py ---
from enums import UserRole, ProgresoTarea, TipoIncidencia
from enum import Enum

# --- CORRECCIÓN 2: Eliminamos las declaraciones de Enum duplicadas de este archivo ---
# Ahora Pydantic usará las definiciones importadas de enums.py como la única fuente de verdad.

# --- Schemas Base (para creación y actualización) ---

class AnalistaBase(BaseModel):
    nombre: str
    apellido: str
    email: EmailStr
    bms_id: int
    role: UserRole
    esta_activo: Optional[bool] = True

class AnalistaCreate(AnalistaBase):
    password: str = Field(..., min_length=6)

class PasswordUpdate(BaseModel):
    new_password: str = Field(..., min_length=6)

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
    analista_id: Optional[int] = None
    campana_id: Optional[int] = None
    fecha_finalizacion: Optional[datetime] = None

class TareaUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    fecha_vencimiento: Optional[datetime] = None
    progreso: Optional[ProgresoTarea] = None
    analista_id: Optional[int] = None
    campana_id: Optional[int] = None
    fecha_finalizacion: Optional[datetime] = None

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
    requiere_tarea: Optional[bool] = False
    fecha_vencimiento_tarea: Optional[datetime] = None

class AcuseReciboCreate(BaseModel):
    analista_id: int

class BitacoraEntryBase(BaseModel):
    campana_id: int
    fecha: date
    hora: time
    comentario: Optional[str] = None
    es_incidencia: Optional[bool] = False
    tipo_incidencia: Optional[TipoIncidencia] = None
    comentario_incidencia: Optional[str] = None

class BitacoraEntryUpdate(BaseModel):
    fecha: Optional[date] = None
    hora: Optional[time] = None
    comentario: Optional[str] = None
    es_incidencia: Optional[bool] = None
    tipo_incidencia: Optional[TipoIncidencia] = None
    comentario_incidencia: Optional[str] = None

class BitacoraGeneralCommentBase(BaseModel):
    campana_id: int
    comentario: Optional[str] = None

class BitacoraGeneralCommentUpdate(BaseModel):
    comentario: Optional[str] = None

class TareaGeneradaPorAvisoBase(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    fecha_vencimiento: Optional[datetime] = None
    progreso: ProgresoTarea = ProgresoTarea.PENDIENTE
    analista_asignado_id: int
    aviso_origen_id: Optional[int] = None
    fecha_finalizacion: Optional[datetime] = None

class TareaGeneradaPorAvisoUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    fecha_vencimiento: Optional[datetime] = None
    progreso: Optional[ProgresoTarea] = None
    analista_asignado_id: Optional[int] = None
    aviso_origen_id: Optional[int] = None
    fecha_finalizacion: Optional[datetime] = None

class HistorialEstadoTareaBase(BaseModel):
    old_progreso: Optional[ProgresoTarea] = None
    new_progreso: ProgresoTarea
    changed_by_analista_id: int
    tarea_campana_id: Optional[int] = None
    tarea_generada_id: Optional[int] = None


# --- Simple Schemas (Para romper dependencias circulares en la salida) ---
class AnalistaSimple(BaseModel):
    id: int
    nombre: str
    apellido: str
    email: EmailStr
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
    email: EmailStr
    bms_id: int
    role: UserRole
    esta_activo: bool
    fecha_creacion: datetime
    campanas_asignadas: List["CampanaSimple"] = []
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
    fecha_finalizacion: Optional[datetime] = None
    class Config:
        from_attributes = True

class TareaGeneradaPorAvisoSimple(BaseModel):
    id: int
    titulo: str
    progreso: ProgresoTarea
    fecha_vencimiento: Optional[datetime] = None
    fecha_finalizacion: Optional[datetime] = None
    class Config:
        from_attributes = True

class HistorialEstadoTareaSimple(BaseModel):
    id: int
    old_progreso: Optional[ProgresoTarea] = None
    new_progreso: ProgresoTarea
    timestamp: datetime
    changed_by_analista_id: int
    tarea_campana_id: Optional[int] = None
    tarea_generada_id: Optional[int] = None
    class Config:
        from_attributes = True


class TareaListOutput(BaseModel):
    id: int
    titulo: str
    descripcion: Optional[str] = None
    fecha_vencimiento: datetime
    progreso: ProgresoTarea
    analista_id: Optional[int] = None
    campana_id: Optional[int] = None
    fecha_creacion: datetime
    fecha_finalizacion: Optional[datetime] = None
    analista: Optional[AnalistaSimple] = None
    campana: Optional[CampanaSimple] = None
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
    requiere_tarea: bool
    fecha_vencimiento_tarea: Optional[datetime] = None
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
    requiere_tarea: bool
    fecha_vencimiento_tarea: Optional[datetime] = None
    class Config:
        from_attributes = True


class AcuseReciboAvisoSimple(BaseModel):
    id: int
    aviso_id: int
    analista_id: int
    fecha_acuse: datetime
    class Config:
        from_attributes = True

class BitacoraEntrySimple(BaseModel):
    id: int
    fecha: date
    hora: time
    comentario: Optional[str] = None
    es_incidencia: Optional[bool] = False
    tipo_incidencia: Optional[TipoIncidencia] = None
    comentario_incidencia: Optional[str] = None
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
    tareas_generadas_por_avisos: List["TareaGeneradaPorAvisoSimple"] = []
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
    analista: Optional[AnalistaSimple] = None
    campana: Optional["CampanaSimple"] = None
    checklist_items: List["ChecklistItemSimple"] = []
    historial_estados: List["HistorialEstadoTareaSimple"] = []
    class Config:
        from_attributes = True

class TareaGeneradaPorAviso(TareaGeneradaPorAvisoBase):
    id: int
    fecha_creacion: datetime
    progreso: ProgresoTarea
    analista_asignado: "AnalistaSimple"
    aviso_origen: Optional["AvisoSimple"] = None
    historial_estados: List["HistorialEstadoTareaSimple"] = []
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
    tareas_generadas: List["TareaGeneradaPorAvisoSimple"] = []
    class Config:
        from_attributes = True

class AcuseReciboAviso(AcuseReciboCreate):
    id: int
    fecha_acuse: datetime
    analista: "AnalistaSimple"
    aviso: "AvisoSimple"
    class Config:
        from_attributes = True

class BitacoraEntry(BitacoraEntryBase):
    id: int
    fecha_creacion: datetime
    fecha_ultima_actualizacion: datetime
    campana: "CampanaSimple"
    class Config:
        from_attributes = True

class BitacoraGeneralComment(BitacoraGeneralCommentBase):
    id: int
    fecha_creacion: datetime
    fecha_ultima_actualizacion: datetime
    campana: "CampanaSimple"
    class Config:
        from_attributes = True

class HistorialEstadoTarea(HistorialEstadoTareaBase):
    id: int
    timestamp: datetime
    changed_by_analista: AnalistaSimple
    class Config:
        from_attributes = True

# Para autenticación
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[UserRole] = None
