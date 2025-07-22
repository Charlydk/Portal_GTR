from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum as SQLEnum, Date, Time
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Table, Column
from datetime import datetime
from enums import UserRole, ProgresoTarea, TipoIncidencia # <-- AÑADE ESTA LÍNEA
import enum

Base = declarative_base()

# Enum para roles de usuario
class UserRole(enum.Enum):
    ANALISTA = "ANALISTA"
    SUPERVISOR = "SUPERVISOR"
    RESPONSABLE = "RESPONSABLE"

# Enum para progreso de tarea
class ProgresoTarea(enum.Enum):
    PENDIENTE = "PENDIENTE"
    EN_PROGRESO = "EN_PROGRESO"
    COMPLETADA = "COMPLETADA"
    CANCELADA = "CANCELADA"

# Enum para tipos de incidencia
class TipoIncidencia(enum.Enum):
    ERROR = "ERROR"
    CONSULTA = "CONSULTA"
    MEJORA = "MEJORA"
    OTRO = "OTRO"

# Tabla de asociación para Analistas y Campañas (muchos a muchos)
analistas_campanas = Table(
    'analistas_campanas',
    Base.metadata,
    Column('analista_id', Integer, ForeignKey('analistas.id'), primary_key=True),
    Column('campana_id', Integer, ForeignKey('campanas.id'), primary_key=True)
)

class Analista(Base):
    __tablename__ = "analistas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, index=True)
    apellido = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    bms_id = Column(Integer, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(SQLEnum(UserRole), default=UserRole.ANALISTA) # Usar SQLEnum para el Enum
    esta_activo = Column(Boolean, default=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    campanas_asignadas = relationship("Campana", secondary=analistas_campanas, back_populates="analistas_asignados")
    tareas = relationship("Tarea", back_populates="analista") # Tareas de campaña
    avisos_creados = relationship("Aviso", back_populates="creador")
    acuses_recibo_avisos = relationship("AcuseReciboAviso", back_populates="analista")
    tareas_generadas_por_avisos = relationship("TareaGeneradaPorAviso", back_populates="analista_asignado") # Relación para tareas generadas por avisos

class Campana(Base):
    __tablename__ = "campanas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, unique=True, index=True)
    descripcion = Column(String, nullable=True)
    fecha_inicio = Column(DateTime, default=datetime.utcnow)
    fecha_fin = Column(DateTime, nullable=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    analistas_asignados = relationship("Analista", secondary=analistas_campanas, back_populates="campanas_asignadas")
    tareas = relationship("Tarea", back_populates="campana")
    comentarios = relationship("ComentarioCampana", back_populates="campana")
    avisos = relationship("Aviso", back_populates="campana")
    bitacora_entries = relationship("BitacoraEntry", back_populates="campana")
    bitacora_general_comment = relationship("BitacoraGeneralComment", back_populates="campana", uselist=False)

class Tarea(Base):
    __tablename__ = "tareas"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, index=True)
    descripcion = Column(String, nullable=True)
    fecha_vencimiento = Column(DateTime)
    progreso = Column(SQLEnum(ProgresoTarea), default=ProgresoTarea.PENDIENTE) # Usar SQLEnum
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_finalizacion = Column(DateTime, nullable=True) # NUEVO: Fecha en que la tarea se completa/cancela

    analista_id = Column(Integer, ForeignKey("analistas.id"))
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=True)

    # Relaciones
    analista = relationship("Analista", back_populates="tareas")
    campana = relationship("Campana", back_populates="tareas")
    checklist_items = relationship("ChecklistItem", back_populates="tarea")
    historial_estados = relationship("HistorialEstadoTarea", back_populates="tarea_campana_rel") # NUEVO: Relación al historial de estados

class TareaGeneradaPorAviso(Base):
    __tablename__ = "tareas_generadas_por_avisos"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, index=True)
    descripcion = Column(String, nullable=True)
    fecha_vencimiento = Column(DateTime)
    progreso = Column(SQLEnum(ProgresoTarea), default=ProgresoTarea.PENDIENTE) # Usar SQLEnum
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_finalizacion = Column(DateTime, nullable=True) # NUEVO: Fecha en que la tarea se completa/cancela

    analista_asignado_id = Column(Integer, ForeignKey("analistas.id"))
    aviso_origen_id = Column(Integer, ForeignKey("avisos.id"))

    # Relaciones
    analista_asignado = relationship("Analista", back_populates="tareas_generadas_por_avisos")
    aviso_origen = relationship("Aviso", back_populates="tareas_generadas")
    historial_estados = relationship("HistorialEstadoTarea", back_populates="tarea_generada_rel") # NUEVO: Relación al historial de estados

class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id = Column(Integer, primary_key=True, index=True)
    descripcion = Column(String)
    completado = Column(Boolean, default=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    tarea_id = Column(Integer, ForeignKey("tareas.id"))

    # Relaciones
    tarea = relationship("Tarea", back_populates="checklist_items")

class ComentarioCampana(Base):
    __tablename__ = "comentarios_campana"

    id = Column(Integer, primary_key=True, index=True)
    contenido = Column(String)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    analista_id = Column(Integer, ForeignKey("analistas.id"))
    campana_id = Column(Integer, ForeignKey("campanas.id"))

    # Relaciones
    analista = relationship("Analista")
    campana = relationship("Campana", back_populates="comentarios")

class Aviso(Base):
    __tablename__ = "avisos"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, index=True)
    contenido = Column(String)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_vencimiento = Column(DateTime, nullable=True) # Fecha de vencimiento del aviso en sí
    
    # Nuevos campos para avisos que requieren tarea
    requiere_tarea = Column(Boolean, default=False)
    fecha_vencimiento_tarea = Column(DateTime, nullable=True) # Fecha de vencimiento para la tarea generada

    creador_id = Column(Integer, ForeignKey("analistas.id"))
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=True) # Puede ser un aviso general

    # Relaciones
    creador = relationship("Analista", back_populates="avisos_creados")
    campana = relationship("Campana", back_populates="avisos")
    acuses_recibo = relationship("AcuseReciboAviso", back_populates="aviso")
    tareas_generadas = relationship("TareaGeneradaPorAviso", back_populates="aviso_origen") # Relación con tareas generadas por este aviso

class AcuseReciboAviso(Base):
    __tablename__ = "acuses_recibo_avisos"

    id = Column(Integer, primary_key=True, index=True)
    fecha_acuse = Column(DateTime, default=datetime.utcnow)

    aviso_id = Column(Integer, ForeignKey("avisos.id"))
    analista_id = Column(Integer, ForeignKey("analistas.id"))

    # Relaciones
    aviso = relationship("Aviso", back_populates="acuses_recibo")
    analista = relationship("Analista", back_populates="acuses_recibo_avisos")

class BitacoraEntry(Base):
    __tablename__ = "bitacora_entries"

    id = Column(Integer, primary_key=True, index=True)
    campana_id = Column(Integer, ForeignKey("campanas.id"))
    fecha = Column(Date) # Solo la fecha
    hora = Column(Time) # Solo la hora
    comentario = Column(String, nullable=True)
    es_incidencia = Column(Boolean, default=False)
    tipo_incidencia = Column(SQLEnum(TipoIncidencia), nullable=True)
    comentario_incidencia = Column(String, nullable=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_ultima_actualizacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    campana = relationship("Campana", back_populates="bitacora_entries")

class BitacoraGeneralComment(Base):
    __tablename__ = "bitacora_general_comments"

    id = Column(Integer, primary_key=True, index=True)
    campana_id = Column(Integer, ForeignKey("campanas.id"), unique=True) # Un comentario general por campaña
    comentario = Column(String, nullable=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_ultima_actualizacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    campana = relationship("Campana", back_populates="bitacora_general_comment")

# NUEVO MODELO PARA EL HISTORIAL DE ESTADOS DE TAREAS
class HistorialEstadoTarea(Base):
    __tablename__ = "historial_estados_tarea"

    id = Column(Integer, primary_key=True, index=True)
    old_progreso = Column(SQLEnum(ProgresoTarea), nullable=True) # Estado antes del cambio (puede ser null si es el primer estado)
    new_progreso = Column(SQLEnum(ProgresoTarea), nullable=False) # Estado después del cambio
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False) # Momento del cambio

    # Quién realizó el cambio (puede ser un analista, supervisor o responsable)
    changed_by_analista_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    changed_by_analista = relationship("Analista") # Relación con el analista que hizo el cambio

    # Claves foráneas para vincular a Tarea o TareaGeneradaPorAviso
    # Usamos nullable=True en ambos y un CHECK constraint en la DB para asegurar que solo uno sea no nulo
    tarea_campana_id = Column(Integer, ForeignKey("tareas.id"), nullable=True)
    tarea_generada_id = Column(Integer, ForeignKey("tareas_generadas_por_avisos.id"), nullable=True)

    # Relaciones inversas
    tarea_campana_rel = relationship("Tarea", back_populates="historial_estados")
    tarea_generada_rel = relationship("TareaGeneradaPorAviso", back_populates="historial_estados")

    # Opcional: Añadir un CHECK constraint para asegurar que solo una de las FKs sea no nula
    # Esto se haría a nivel de la tabla en la base de datos, no directamente en SQLAlchemy ORM.
    # Por ejemplo, en PostgreSQL:
    # ALTER TABLE historial_estados_tarea ADD CONSTRAINT chk_one_task_fk CHECK (
    #   (tarea_campana_id IS NOT NULL AND tarea_generada_id IS NULL) OR
    #   (tarea_campana_id IS NULL AND tarea_generada_id IS NOT NULL)
    # );
    # Para SQLite, se puede manejar la lógica en el ORM o en el endpoint.
    # Por ahora, la lógica en el endpoint será suficiente para asegurar la integridad.
