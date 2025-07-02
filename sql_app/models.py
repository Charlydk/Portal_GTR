from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

# Importa la Base declarativa que definimos en database.py
from database import Base

# Definición del Enum para ProgresoTarea (debe coincidir con el de Pydantic)
class ProgresoTareaEnum(enum.Enum):
    PENDIENTE = "Pendiente"
    EN_PROGRESO = "En Progreso"
    COMPLETADA = "Completada"
    BLOQUEADA = "Bloqueada"

# --- Modelos de SQLAlchemy para tus Tablas ---

class Analista(Base):
    __tablename__ = "analistas" # Nombre de la tabla en la base de datos

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, index=True)
    apellido = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    bms_id = Column(Integer, unique=True, index=True) # BMS ID como entero único
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    # Relación con Tareas (un analista puede tener muchas tareas asignadas)
    tareas_asignadas = relationship("Tarea", back_populates="analista_asignado")

    # Relación con Comentarios de Campaña (un analista puede hacer muchos comentarios)
    comentarios_hechos = relationship("ComentarioCampana", back_populates="analista")

    # Relación con Avisos (un analista puede crear muchos avisos)
    avisos_creados = relationship("Aviso", back_populates="creador")

class Campana(Base):
    __tablename__ = "campanas" # Nombre de la tabla en la base de datos

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, index=True)
    descripcion = Column(Text, nullable=True) # Text para descripciones largas, nullable=True si puede ser nulo
    fecha_inicio = Column(DateTime)
    fecha_fin = Column(DateTime)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    # Relación con Tareas (una campaña puede tener muchas tareas)
    tareas = relationship("Tarea", back_populates="campana_relacionada")

    # Relación con Comentarios de Campaña (una campaña puede tener muchos comentarios)
    comentarios = relationship("ComentarioCampana", back_populates="campana_relacionada")

    # Relación con Avisos (una campaña puede tener muchos avisos)
    avisos = relationship("Aviso", back_populates="campana_relacionada")

class Tarea(Base):
    __tablename__ = "tareas" # Nombre de la tabla en la base de datos

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, index=True)
    descripcion = Column(Text, nullable=True)
    fecha_vencimiento = Column(DateTime)
    progreso = Column(Enum(ProgresoTareaEnum), default=ProgresoTareaEnum.PENDIENTE) # Usamos el Enum
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    # Claves Foráneas
    analista_id = Column(Integer, ForeignKey("analistas.id")) # Relación con Analista
    campana_id = Column(Integer, ForeignKey("campanas.id"))   # Relación con Campaña

    # Relaciones ORM
    analista_asignado = relationship("Analista", back_populates="tareas_asignadas")
    campana_relacionada = relationship("Campana", back_populates="tareas")

    # Relación con ChecklistItems
    checklist_items = relationship("ChecklistItem", back_populates="tarea_parent")


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id = Column(Integer, primary_key=True, index=True)
    descripcion = Column(String)
    completado = Column(Boolean, default=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    # Clave Foránea
    tarea_id = Column(Integer, ForeignKey("tareas.id"))

    # Relación ORM
    tarea_parent = relationship("Tarea", back_populates="checklist_items")


class ComentarioCampana(Base):
    __tablename__ = "comentarios_campana"

    id = Column(Integer, primary_key=True, index=True)
    contenido = Column(Text)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    # Claves Foráneas
    analista_id = Column(Integer, ForeignKey("analistas.id"))
    campana_id = Column(Integer, ForeignKey("campanas.id"))

    # Relaciones ORM
    analista = relationship("Analista", back_populates="comentarios_hechos")
    campana_relacionada = relationship("Campana", back_populates="comentarios")


class Aviso(Base):
    __tablename__ = "avisos"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, index=True)
    contenido = Column(Text)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_vencimiento = Column(DateTime, nullable=True) # Puede que no todos los avisos tengan vencimiento

    # Claves Foráneas
    creador_id = Column(Integer, ForeignKey("analistas.id"))
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=True) # Un aviso puede no estar ligado a una campaña

    # Relaciones ORM
    creador = relationship("Analista", back_populates="avisos_creados")
    campana_relacionada = relationship("Campana", back_populates="avisos")