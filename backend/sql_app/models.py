from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum as SQLEnum, Date, Time, func
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Table
from datetime import datetime

# --- CORRECCIÓN 1: Importamos los Enums desde el archivo central 'enums.py' ---
from enums import UserRole, ProgresoTarea, TipoIncidencia

Base = declarative_base()

# --- CORRECCIÓN 2: Eliminamos las declaraciones de Enum duplicadas de este archivo ---
# Ya no se necesitan, porque las estamos importando.

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
    nombre = Column(String, nullable=False)
    apellido = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    bms_id = Column(Integer, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    # --- CORRECCIÓN 3: Usamos el Enum importado ---
    role = Column(SQLEnum(UserRole, name="userrole"), nullable=False, default=UserRole.ANALISTA)
    esta_activo = Column(Boolean, default=True)
    fecha_creacion = Column(DateTime, default=func.now())

    campanas_asignadas = relationship("Campana", secondary=analistas_campanas, back_populates="analistas_asignados")
    tareas = relationship("Tarea", back_populates="analista")
    avisos_creados = relationship("Aviso", back_populates="creador")
    acuses_recibo_avisos = relationship("AcuseReciboAviso", back_populates="analista")
    tareas_generadas_por_avisos = relationship("TareaGeneradaPorAviso", back_populates="analista_asignado")

class Campana(Base):
    __tablename__ = "campanas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    descripcion = Column(String, nullable=True)
    fecha_inicio = Column(DateTime, nullable=True)
    fecha_fin = Column(DateTime, nullable=True)
    fecha_creacion = Column(DateTime, default=func.now())

    analistas_asignados = relationship("Analista", secondary=analistas_campanas, back_populates="campanas_asignadas")
    tareas = relationship("Tarea", back_populates="campana", cascade="all, delete-orphan")
    comentarios = relationship("ComentarioCampana", back_populates="campana", cascade="all, delete-orphan")
    avisos = relationship("Aviso", back_populates="campana", cascade="all, delete-orphan")
    bitacora_entries = relationship("BitacoraEntry", back_populates="campana", cascade="all, delete-orphan")
    bitacora_general_comment = relationship("BitacoraGeneralComment", uselist=False, back_populates="campana", cascade="all, delete-orphan")

class Tarea(Base):
    __tablename__ = "tareas"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, nullable=False)
    descripcion = Column(String, nullable=True)
    fecha_vencimiento = Column(DateTime, nullable=False)
    # --- CORRECCIÓN 3: Usamos el Enum importado ---
    progreso = Column(SQLEnum(ProgresoTarea, name="progresotarea"), nullable=False, default=ProgresoTarea.PENDIENTE)
    fecha_creacion = Column(DateTime, default=func.now())
    fecha_finalizacion = Column(DateTime, nullable=True)
    
    analista_id = Column(Integer, ForeignKey("analistas.id"), nullable=True)
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=True)

    analista = relationship("Analista", back_populates="tareas")
    campana = relationship("Campana", back_populates="tareas")
    checklist_items = relationship("ChecklistItem", back_populates="tarea", cascade="all, delete-orphan")
    historial_estados = relationship("HistorialEstadoTarea", back_populates="tarea_campana_rel", cascade="all, delete-orphan")

class ChecklistItem(Base):
    __tablename__ = "checklist_items"
    id = Column(Integer, primary_key=True, index=True)
    descripcion = Column(String, nullable=False)
    completado = Column(Boolean, default=False)
    fecha_creacion = Column(DateTime, default=func.now())
    
    tarea_id = Column(Integer, ForeignKey("tareas.id"), nullable=False)
    tarea = relationship("Tarea", back_populates="checklist_items")

class ComentarioCampana(Base):
    __tablename__ = "comentarios_campana"
    id = Column(Integer, primary_key=True, index=True)
    contenido = Column(String, nullable=False)
    fecha_creacion = Column(DateTime, default=func.now())
    
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=False)
    analista_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)

    campana = relationship("Campana", back_populates="comentarios")
    analista = relationship("Analista")

class Aviso(Base):
    __tablename__ = "avisos"
    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, nullable=False)
    contenido = Column(String, nullable=False)
    fecha_creacion = Column(DateTime, default=func.now())
    fecha_vencimiento = Column(DateTime, nullable=True)
    requiere_tarea = Column(Boolean, default=False)
    fecha_vencimiento_tarea = Column(DateTime, nullable=True)
    
    creador_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=True)

    creador = relationship("Analista", back_populates="avisos_creados")
    campana = relationship("Campana", back_populates="avisos")
    acuses_recibo = relationship("AcuseReciboAviso", back_populates="aviso", cascade="all, delete-orphan")
    tareas_generadas = relationship("TareaGeneradaPorAviso", back_populates="aviso_origen", cascade="all, delete-orphan")

class AcuseReciboAviso(Base):
    __tablename__ = "acuses_recibo_avisos"
    id = Column(Integer, primary_key=True, index=True)
    fecha_acuse = Column(DateTime, default=func.now())
    
    aviso_id = Column(Integer, ForeignKey("avisos.id"), nullable=False)
    analista_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)

    aviso = relationship("Aviso", back_populates="acuses_recibo")
    analista = relationship("Analista", back_populates="acuses_recibo_avisos")

class BitacoraEntry(Base):
    __tablename__ = "bitacora_entries"
    id = Column(Integer, primary_key=True, index=True)
    fecha = Column(Date, nullable=False)
    hora = Column(Time, nullable=False)
    comentario = Column(String, nullable=True)
    es_incidencia = Column(Boolean, default=False)
    # --- CORRECCIÓN 3: Usamos el Enum importado ---
    tipo_incidencia = Column(SQLEnum(TipoIncidencia, name="tipoincidencia"), nullable=True)
    comentario_incidencia = Column(String, nullable=True)
    fecha_creacion = Column(DateTime, default=func.now())
    fecha_ultima_actualizacion = Column(DateTime, default=func.now(), onupdate=func.now())
    
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=False)
    campana = relationship("Campana", back_populates="bitacora_entries")

class BitacoraGeneralComment(Base):
    __tablename__ = "bitacora_general_comments"
    id = Column(Integer, primary_key=True, index=True)
    comentario = Column(String, nullable=True)
    fecha_creacion = Column(DateTime, default=func.now())
    fecha_ultima_actualizacion = Column(DateTime, default=func.now(), onupdate=func.now())
    
    campana_id = Column(Integer, ForeignKey("campanas.id"), unique=True, nullable=False)
    campana = relationship("Campana", back_populates="bitacora_general_comment")

class TareaGeneradaPorAviso(Base):
    __tablename__ = "tareas_generadas_por_avisos"
    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, nullable=False)
    descripcion = Column(String, nullable=True)
    fecha_vencimiento = Column(DateTime, nullable=True)
    # --- CORRECCIÓN 3: Usamos el Enum importado ---
    progreso = Column(SQLEnum(ProgresoTarea, name="progresotarea_gen"), nullable=False, default=ProgresoTarea.PENDIENTE)
    fecha_creacion = Column(DateTime, default=func.now())
    fecha_finalizacion = Column(DateTime, nullable=True)
    
    analista_asignado_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    aviso_origen_id = Column(Integer, ForeignKey("avisos.id"), nullable=True)

    analista_asignado = relationship("Analista", back_populates="tareas_generadas_por_avisos")
    aviso_origen = relationship("Aviso", back_populates="tareas_generadas")
    historial_estados = relationship("HistorialEstadoTarea", back_populates="tarea_generada_rel", cascade="all, delete-orphan")

class HistorialEstadoTarea(Base):
    __tablename__ = "historial_estados_tarea"
    id = Column(Integer, primary_key=True, index=True)
    # --- CORRECCIÓN 3: Usamos el Enum importado ---
    old_progreso = Column(SQLEnum(ProgresoTarea, name="progresotarea_hist_old"), nullable=True)
    new_progreso = Column(SQLEnum(ProgresoTarea, name="progresotarea_hist_new"), nullable=False)
    timestamp = Column(DateTime, default=func.now(), nullable=False)
    
    changed_by_analista_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    changed_by_analista = relationship("Analista")
    
    tarea_campana_id = Column(Integer, ForeignKey("tareas.id"), nullable=True)
    tarea_generada_id = Column(Integer, ForeignKey("tareas_generadas_por_avisos.id"), nullable=True)

    tarea_campana_rel = relationship("Tarea", back_populates="historial_estados")
    tarea_generada_rel = relationship("TareaGeneradaPorAviso", back_populates="historial_estados")
