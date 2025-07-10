# sql_app/models.py

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base

import enum

Base = declarative_base()

# Definimos el Enum para los roles de usuario
class UserRole(enum.Enum):
    SUPERVISOR = "SUPERVISOR"
    RESPONSABLE = "RESPONSABLE"
    ANALISTA = "ANALISTA"

class Analista(Base):
    __tablename__ = "analistas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, index=True)
    apellido = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    bms_id = Column(Integer, unique=True, index=True)
    hashed_password = Column(String, nullable=False) # ¡NUEVO! Para la contraseña encriptada
    role = Column(Enum(UserRole), default=UserRole.ANALISTA, nullable=False) # ¡NUEVO! Rol del usuario
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    esta_activo = Column(Boolean, default=True)

    # Relaciones
    tareas = relationship("Tarea", back_populates="analista")
    comentarios_campana = relationship("ComentarioCampana", back_populates="analista")
    avisos_creados = relationship("Aviso", back_populates="creador") # Avisos creados por este analista
    acuses_recibo = relationship("AcuseReciboAviso", back_populates="analista") # Acuses de recibo dados por este analista

class Campana(Base):
    __tablename__ = "campanas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, index=True)
    descripcion = Column(String, nullable=True)
    fecha_inicio = Column(DateTime(timezone=True))
    fecha_fin = Column(DateTime(timezone=True), nullable=True)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    # Relaciones
    tareas = relationship("Tarea", back_populates="campana")
    comentarios = relationship("ComentarioCampana", back_populates="campana")
    avisos_asociados = relationship("Aviso", back_populates="campana") # Avisos asociados a esta campaña


class Tarea(Base):
    __tablename__ = "tareas"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, index=True)
    descripcion = Column(String, nullable=True)
    fecha_vencimiento = Column(DateTime(timezone=True), nullable=True)
    progreso = Column(Enum('PENDIENTE', 'EN_PROGRESO', 'COMPLETADA', 'BLOQUEADA', name='progreso_tarea_enum'), default='PENDIENTE')
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    analista_id = Column(Integer, ForeignKey("analistas.id"))
    campana_id = Column(Integer, ForeignKey("campanas.id"))

    # Relaciones
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

    # Relaciones
    tarea = relationship("Tarea", back_populates="checklist_items")


class ComentarioCampana(Base):
    __tablename__ = "comentarios_campana"

    id = Column(Integer, primary_key=True, index=True)
    contenido = Column(String)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    analista_id = Column(Integer, ForeignKey("analistas.id"))
    campana_id = Column(Integer, ForeignKey("campanas.id"))

    # Relaciones
    analista = relationship("Analista", back_populates="comentarios_campana")
    campana = relationship("Campana", back_populates="comentarios")


class Aviso(Base):
    __tablename__ = "avisos"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, index=True)
    contenido = Column(String)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    fecha_vencimiento = Column(DateTime(timezone=True), nullable=True)

    creador_id = Column(Integer, ForeignKey("analistas.id"))
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=True) # Un aviso puede no estar asociado a una campaña

    # Relaciones
    creador = relationship("Analista", back_populates="avisos_creados")
    campana = relationship("Campana", back_populates="avisos_asociados")
    acuses_recibo = relationship("AcuseReciboAviso", back_populates="aviso", cascade="all, delete-orphan")


class AcuseReciboAviso(Base):
    __tablename__ = "acuse_recibo_avisos"

    id = Column(Integer, primary_key=True, index=True)
    fecha_acuse = Column(DateTime(timezone=True), server_default=func.now())

    aviso_id = Column(Integer, ForeignKey("avisos.id", ondelete="CASCADE")) # Agregamos CASCADE para eliminar acuses si se borra el aviso
    analista_id = Column(Integer, ForeignKey("analistas.id"))

    # Relaciones
    aviso = relationship("Aviso", back_populates="acuses_recibo")
    analista = relationship("Analista", back_populates="acuses_recibo")
