# backend/sql_app/models.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum, Table, Text, UniqueConstraint, Date # Importar Date
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
    role = Column(String, default=UserRole.ANALISTA.value)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    esta_activo = Column(Boolean, default=True)

    tareas = relationship("Tarea", back_populates="analista")
    comentarios = relationship("ComentarioCampana", back_populates="analista")
    avisos_creados = relationship("Aviso", back_populates="creador")
    acuses_recibo_avisos = relationship("AcuseReciboAviso", back_populates="analista")
    campanas_asignadas = relationship(
        "Campana",
        secondary=analistas_campanas,
        back_populates="analistas_asignados"
    )
    incidencias_registradas = relationship("Incidencia", back_populates="analista")


class Campana(Base):
    __tablename__ = "campanas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, index=True)
    descripcion = Column(Text, nullable=True)
    fecha_inicio = Column(DateTime(timezone=True), nullable=True)
    fecha_fin = Column(DateTime(timezone=True), nullable=True)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    tareas = relationship("Tarea", back_populates="campana")
    comentarios = relationship("ComentarioCampana", back_populates="campana")
    avisos = relationship("Aviso", back_populates="campana")
    analistas_asignados = relationship(
        "Analista",
        secondary=analistas_campanas,
        back_populates="campanas_asignadas"
    )
    
    bitacora_entries = relationship("BitacoraEntry", back_populates="campana")
    bitacora_general_comment = relationship("BitacoraGeneralComment", uselist=False, back_populates="campana")


class Tarea(Base):
    __tablename__ = "tareas"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, index=True)
    descripcion = Column(Text, nullable=True)
    fecha_vencimiento = Column(DateTime(timezone=True))
    progreso = Column(String, default=ProgresoTarea.PENDIENTE.value)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    analista_id = Column(Integer, ForeignKey("analistas.id"))
    campana_id = Column(Integer, ForeignKey("campanas.id"))

    analista = relationship("Analista", back_populates="tareas")
    campana = relationship("Campana", back_populates="tareas")
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
    contenido = Column(Text)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    analista_id = Column(Integer, ForeignKey("analistas.id"))
    campana_id = Column(Integer, ForeignKey("campanas.id"))

    analista = relationship("Analista", back_populates="comentarios")
    campana = relationship("Campana", back_populates="comentarios")


class Aviso(Base):
    __tablename__ = "avisos"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String)
    contenido = Column(Text)
    fecha_vencimiento = Column(DateTime(timezone=True), nullable=True)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    creador_id = Column(Integer, ForeignKey("analistas.id"))
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=True)

    creador = relationship("Analista", back_populates="avisos_creados")
    campana = relationship("Campana", back_populates="avisos")
    acuses_recibo = relationship("AcuseReciboAviso", back_populates="aviso", cascade="all, delete-orphan")


class AcuseReciboAviso(Base):
    __tablename__ = "acuses_recibo_avisos"

    id = Column(Integer, primary_key=True, index=True)
    fecha_acuse = Column(DateTime(timezone=True), server_default=func.now())

    aviso_id = Column(Integer, ForeignKey("avisos.id"))
    analista_id = Column(Integer, ForeignKey("analistas.id"))

    aviso = relationship("Aviso", back_populates="acuses_recibo")
    analista = relationship("Analista", back_populates="acuses_recibo_avisos")


# --- MODELOS DE BITÁCORA MODIFICADOS ---
class BitacoraEntry(Base):
    __tablename__ = "bitacora_entries"
    id = Column(Integer, primary_key=True, index=True)
    campana_id = Column(Integer, ForeignKey("campanas.id"))
    fecha = Column(Date, nullable=False) # ¡NUEVA COLUMNA: fecha de la bitácora!
    hora = Column(String, nullable=False) # Formato "HH:MM"
    comentario = Column(Text, nullable=True)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    fecha_ultima_actualizacion = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relación
    campana = relationship("Campana", back_populates="bitacora_entries")

    # ¡RESTRICCIÓN ÚNICA MODIFICADA! Ahora es por campana, fecha y hora
    __table_args__ = (UniqueConstraint('campana_id', 'fecha', 'hora', name='_campana_fecha_hora_uc'),)


class BitacoraGeneralComment(Base):
    __tablename__ = "bitacora_general_comments"
    id = Column(Integer, primary_key=True, index=True)
    campana_id = Column(Integer, ForeignKey("campanas.id"), unique=True)
    comentario = Column(Text, nullable=True)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    fecha_ultima_actualizacion = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relación
    campana = relationship("Campana", back_populates="bitacora_general_comment")

# --- NUEVO MODELO DE INCIDENCIA ---
class Incidencia(Base):
    __tablename__ = "incidencias"

    id = Column(Integer, primary_key=True, index=True)
    comentario = Column(Text, nullable=True)
    horario = Column(String, nullable=False) # Ej. "HH:MM"
    tipo_incidencia = Column(String, nullable=False) # Ej. "tecnica", "operativa", "otra"
    fecha_registro = Column(DateTime(timezone=True), server_default=func.now())
    
    analista_id = Column(Integer, ForeignKey("analistas.id"))
    analista = relationship("Analista", back_populates="incidencias_registradas")

