from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum as SQLEnum, Date, Time, func, Text
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Table
from datetime import datetime

# Importamos todos los Enums desde nuestro archivo central
from enums import UserRole, ProgresoTarea, TipoIncidencia, EstadoIncidencia

Base = declarative_base()

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
    role = Column(SQLEnum(UserRole, name="userrole"), nullable=False, default=UserRole.ANALISTA)
    esta_activo = Column(Boolean, default=True)
    fecha_creacion = Column(DateTime, default=func.now())

    campanas_asignadas = relationship("Campana", secondary=analistas_campanas, back_populates="analistas_asignados")
    tareas = relationship("Tarea", back_populates="analista")
    avisos_creados = relationship("Aviso", back_populates="creador")
    acuses_recibo_avisos = relationship("AcuseReciboAviso", back_populates="analista")
    tareas_generadas_por_avisos = relationship("TareaGeneradaPorAviso", back_populates="analista_asignado")
    comentarios_generales_bitacora = relationship("ComentarioGeneralBitacora", back_populates="autor")
    incidencias_creadas = relationship("Incidencia", back_populates="creador", foreign_keys='Incidencia.creador_id')
    actualizaciones_incidencia_hechas = relationship("ActualizacionIncidencia", back_populates="autor")


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
    avisos = relationship("Aviso", back_populates="campana", cascade="all, delete-orphan")
    bitacora_entries = relationship("BitacoraEntry", back_populates="campana", cascade="all, delete-orphan")
    comentarios_generales = relationship("ComentarioGeneralBitacora", back_populates="campana", cascade="all, delete-orphan")
    incidencias = relationship("Incidencia", back_populates="campana", cascade="all, delete-orphan")

class Tarea(Base):
    __tablename__ = "tareas"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, nullable=False)
    descripcion = Column(String, nullable=True)
    fecha_vencimiento = Column(DateTime, nullable=False)
    # CAMBIO: Se mantiene el nombre base "progresotarea"
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

class ComentarioGeneralBitacora(Base):
    __tablename__ = "comentarios_generales_bitacora"
    id = Column(Integer, primary_key=True, index=True)
    comentario = Column(String, nullable=False)
    fecha_creacion = Column(DateTime, default=func.now())
    
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=False)
    autor_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)

    campana = relationship("Campana", back_populates="comentarios_generales")
    autor = relationship("Analista", back_populates="comentarios_generales_bitacora")

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
    fecha_creacion = Column(DateTime, default=func.now())
    fecha_ultima_actualizacion = Column(DateTime, default=func.now(), onupdate=func.now())
    
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=False)
    campana = relationship("Campana", back_populates="bitacora_entries")

class TareaGeneradaPorAviso(Base):
    __tablename__ = "tareas_generadas_por_avisos"
    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, nullable=False)
    descripcion = Column(String, nullable=True)
    fecha_vencimiento = Column(DateTime, nullable=True)
    # CAMBIO: Usamos el nombre base "progresotarea"
    progreso = Column(SQLEnum(ProgresoTarea, name="progresotarea"), nullable=False, default=ProgresoTarea.PENDIENTE)
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
    # CAMBIO: Usamos el nombre base "progresotarea" para ambos
    old_progreso = Column(SQLEnum(ProgresoTarea, name="progresotarea"), nullable=True)
    new_progreso = Column(SQLEnum(ProgresoTarea, name="progresotarea"), nullable=False)
    timestamp = Column(DateTime, default=func.now(), nullable=False)
    
    changed_by_analista_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    changed_by_analista = relationship("Analista")
    
    tarea_campana_id = Column(Integer, ForeignKey("tareas.id"), nullable=True)
    tarea_generada_id = Column(Integer, ForeignKey("tareas_generadas_por_avisos.id"), nullable=True)

    tarea_campana_rel = relationship("Tarea", back_populates="historial_estados")
    tarea_generada_rel = relationship("TareaGeneradaPorAviso", back_populates="historial_estados")

class Incidencia(Base):
    __tablename__ = "incidencias"
    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, nullable=False)
    descripcion_inicial = Column(Text, nullable=False)
    herramienta_afectada = Column(String, nullable=True)
    indicador_afectado = Column(String, nullable=True)
    tipo = Column(SQLEnum(TipoIncidencia, name="tipoincidencia_inc"), nullable=False)
    estado = Column(SQLEnum(EstadoIncidencia, name="estadoincidencia"), nullable=False, default=EstadoIncidencia.ABIERTA)
    fecha_apertura = Column(DateTime, default=func.now())
    fecha_cierre = Column(DateTime, nullable=True)
    creador_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=False)
    creador = relationship("Analista", back_populates="incidencias_creadas", foreign_keys=[creador_id])
    campana = relationship("Campana", back_populates="incidencias")
    actualizaciones = relationship("ActualizacionIncidencia", back_populates="incidencia", cascade="all, delete-orphan")

class ActualizacionIncidencia(Base):
    __tablename__ = "actualizaciones_incidencia"
    id = Column(Integer, primary_key=True, index=True)
    comentario = Column(Text, nullable=False)
    fecha_actualizacion = Column(DateTime, default=func.now())
    incidencia_id = Column(Integer, ForeignKey("incidencias.id"), nullable=False)
    autor_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    incidencia = relationship("Incidencia", back_populates="actualizaciones")
    autor = relationship("Analista", back_populates="actualizaciones_incidencia_hechas")
