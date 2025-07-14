from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum, Table
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
import enum

Base = declarative_base()

# Enum para los roles de usuario
class UserRole(enum.Enum):
    SUPERVISOR = "SUPERVISOR"
    RESPONSABLE = "RESPONSABLE"
    ANALISTA = "ANALISTA"

# Enum para el progreso de la tarea
class ProgresoTarea(enum.Enum):
    PENDIENTE = "PENDIENTE"
    EN_PROGRESO = "EN_PROGRESO"
    COMPLETADA = "COMPLETADA"
    BLOQUEADA = "BLOQUEADA"

# Tabla de asociación para la relación muchos a muchos entre Analista y Campaña
# Esto permite que un analista esté asignado a múltiples campañas y una campaña tenga múltiples analistas.
analistas_campanas = Table(
    'analistas_campanas', Base.metadata,
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
    role = Column(Enum(UserRole), default=UserRole.ANALISTA)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    esta_activo = Column(Boolean, default=True)

    # Relación con Tareas (uno a muchos: un analista tiene muchas tareas)
    tareas = relationship("Tarea", back_populates="analista")
    # Relación con Comentarios de Campaña (uno a muchos: un analista hace muchos comentarios)
    comentarios = relationship("ComentarioCampana", back_populates="analista")
    # Relación con Avisos (uno a muchos: un analista crea muchos avisos)
    avisos_creados = relationship("Aviso", back_populates="creador")
    # Relación con Acuses de Recibo de Avisos (uno a muchos: un analista hace muchos acuses)
    acuses_recibo_avisos = relationship("AcuseReciboAviso", back_populates="analista")
    
    # ¡NUEVA RELACIÓN! Muchos a muchos con Campañas
    campanas_asignadas = relationship(
        "Campana",
        secondary=analistas_campanas,
        back_populates="analistas_asignados"
    )

class Campana(Base):
    __tablename__ = "campanas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, index=True)
    descripcion = Column(String, nullable=True)
    fecha_inicio = Column(DateTime(timezone=True))
    fecha_fin = Column(DateTime(timezone=True), nullable=True)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    # Relación con Tareas (uno a muchos: una campaña tiene muchas tareas)
    tareas = relationship("Tarea", back_populates="campana")
    # Relación con Comentarios de Campaña (uno a muchos: una campaña tiene muchos comentarios)
    comentarios = relationship("ComentarioCampana", back_populates="campana")
    # Relación con Avisos (uno a muchos: una campaña puede tener muchos avisos)
    avisos = relationship("Aviso", back_populates="campana")

    # ¡NUEVA RELACIÓN! Muchos a muchos con Analistas
    analistas_asignados = relationship(
        "Analista",
        secondary=analistas_campanas,
        back_populates="campanas_asignadas"
    )

class Tarea(Base):
    __tablename__ = "tareas"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, index=True)
    descripcion = Column(String, nullable=True)
    fecha_vencimiento = Column(DateTime(timezone=True), nullable=True)
    # MODIFICACIÓN CLAVE AQUÍ: native_enum=False
    progreso = Column(Enum(ProgresoTarea, values_callable=lambda x: [e.value for e in x], native_enum=False), default=ProgresoTarea.PENDIENTE)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    analista_id = Column(Integer, ForeignKey("analistas.id"))
    campana_id = Column(Integer, ForeignKey("campanas.id"))

    analista = relationship("Analista", back_populates="tareas")
    campana = relationship("Campana", back_populates="tareas")

    # Relación con ChecklistItem (uno a muchos: una tarea tiene muchos ítems de checklist)
    checklist_items = relationship("ChecklistItem", back_populates="tarea", cascade="all, delete-orphan")

class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id = Column(Integer, primary_key=True, index=True)
    descripcion = Column(String)
    completado = Column(Boolean, default=False)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    tarea_id = Column(Integer, ForeignKey("tareas.id"))
    tarea = relationship("Tarea", back_populates="checklist_items")

class ComentarioCampana(Base):
    __tablename__ = "comentarios_campana"

    id = Column(Integer, primary_key=True, index=True)
    contenido = Column(String)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    analista_id = Column(Integer, ForeignKey("analistas.id"))
    campana_id = Column(Integer, ForeignKey("campanas.id"))

    analista = relationship("Analista", back_populates="comentarios")
    campana = relationship("Campana", back_populates="comentarios")

class Aviso(Base):
    __tablename__ = "avisos"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String)
    contenido = Column(String)
    fecha_vencimiento = Column(DateTime(timezone=True), nullable=True)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    creador_id = Column(Integer, ForeignKey("analistas.id"))
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=True)

    creador = relationship("Analista", back_populates="avisos_creados")
    campana = relationship("Campana", back_populates="avisos")

    # Relación con AcuseReciboAviso (uno a muchos: un aviso tiene muchos acuses)
    acuses_recibo = relationship("AcuseReciboAviso", back_populates="aviso", cascade="all, delete-orphan")

class AcuseReciboAviso(Base):
    __tablename__ = "acuses_recibo_avisos"

    id = Column(Integer, primary_key=True, index=True)
    fecha_acuse = Column(DateTime(timezone=True), server_default=func.now())

    aviso_id = Column(Integer, ForeignKey("avisos.id"))
    analista_id = Column(Integer, ForeignKey("analistas.id"))

    aviso = relationship("Aviso", back_populates="acuses_recibo")
    analista = relationship("Analista", back_populates="acuses_recibo_avisos")
