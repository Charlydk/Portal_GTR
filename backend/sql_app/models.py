from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Date # Incluí Date por si la necesitas más adelante
from sqlalchemy.orm import relationship # <-- Necesario para definir relaciones
from sqlalchemy.sql import func
from datetime import datetime
import enum

# Importa la Base declarativa que definimos en database.py
from database import Base # Usar .database para importación relativa dentro del paquete sql_app

# Importa el tipo ENUM específico de PostgreSQL
from sqlalchemy.dialects.postgresql import ENUM as PostgreSQLEnum
from sqlalchemy.types import TypeDecorator # Para personalizar el manejo del Enum

# --- Definición de TypeDecorator para el Enum de ProgresoTarea ---
# Esto asegura que tu Enum de Python se mapee correctamente al tipo ENUM de PostgreSQL
class ProgresoTareaType(TypeDecorator):
    impl = PostgreSQLEnum # La implementación real será el ENUM de PostgreSQL
    cache_ok = True # Optimizaciones de caché

    def __init__(self, enum_class, name, create_type=True, **kw):
        self.enum_class = enum_class
        # Asegúrate de que los valores del enum sean cadenas
        enum_values = [e.value for e in enum_class]
        super().__init__(*enum_values, name=name, create_type=create_type, **kw)

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        return value.value # Retorna el valor de la cadena (ej. "PENDIENTE")

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        # Convierte la cadena de la DB al miembro del Enum de Python
        return self.enum_class(value)

# Definición del Enum para ProgresoTarea (DEBE coincidir con el de Pydantic y TypeDecorator)
class ProgresoTarea(enum.Enum):
    PENDIENTE = "PENDIENTE"
    EN_PROGRESO = "EN_PROGRESO"
    COMPLETADA = "COMPLETADA"
    BLOQUEADA = "BLOQUEADA"

# --- Modelos de SQLAlchemy para tus Tablas ---

class Analista(Base):
    __tablename__ = "analistas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, index=True, nullable=False) # Añadido nullable=False
    apellido = Column(String, index=True, nullable=False) # Añadido nullable=False
    email = Column(String, unique=True, index=True, nullable=False) # Añadido nullable=False
    bms_id = Column(Integer, unique=True, index=True, nullable=False) # Añadido nullable=False
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now(), nullable=False) # Usar func.now() para la DB

    # Relaciones inversas (back_populates debe apuntar al nombre del atributo de relación en el otro modelo)
    tareas = relationship("Tarea", back_populates="analista", cascade="all, delete-orphan") # Añadido cascade
    comentarios = relationship("ComentarioCampana", back_populates="analista", cascade="all, delete-orphan")
    avisos_creados = relationship("Aviso", back_populates="creador", cascade="all, delete-orphan")
    acuses_recibo = relationship("AcuseReciboAviso", back_populates="analista", cascade="all, delete-orphan") # Nombre corregido


class Campana(Base):
    __tablename__ = "campanas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, index=True, nullable=False)
    descripcion = Column(Text, nullable=True)
    fecha_inicio = Column(DateTime(timezone=True), nullable=False) # Usar DateTime para consistencia con Pydantic
    fecha_fin = Column(DateTime(timezone=True), nullable=True)     # Usar DateTime para consistencia con Pydantic
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relaciones inversas
    tareas = relationship("Tarea", back_populates="campana", cascade="all, delete-orphan") # Añadido cascade
    comentarios = relationship("ComentarioCampana", back_populates="campana", cascade="all, delete-orphan")
    avisos = relationship("Aviso", back_populates="campana", cascade="all, delete-orphan")


class Tarea(Base):
    __tablename__ = "tareas"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, index=True, nullable=False)
    descripcion = Column(Text, nullable=True)
    fecha_vencimiento = Column(DateTime(timezone=True), nullable=True) # Usar DateTime
    
    # Uso del TypeDecorator para el Enum
    progreso = Column(ProgresoTareaType(ProgresoTarea, name='progresotareaenum'),
                      default=ProgresoTarea.PENDIENTE, nullable=False)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    analista_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=False)

    # Relaciones directas (nombre del atributo en este modelo)
    analista = relationship("Analista", back_populates="tareas") # back_populates apunta al atributo 'tareas' en Analista
    campana = relationship("Campana", back_populates="tareas")   # back_populates apunta al atributo 'tareas' en Campana

    checklist_items = relationship("ChecklistItem", back_populates="tarea", cascade="all, delete-orphan")


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id = Column(Integer, primary_key=True, index=True)
    descripcion = Column(String, nullable=False)
    completado = Column(Boolean, default=False, nullable=False)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    tarea_id = Column(Integer, ForeignKey("tareas.id"), nullable=False)

    tarea = relationship("Tarea", back_populates="checklist_items") # back_populates apunta al atributo 'checklist_items' en Tarea


class ComentarioCampana(Base):
    __tablename__ = "comentarios_campana"

    id = Column(Integer, primary_key=True, index=True)
    contenido = Column(Text, nullable=False)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    analista_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=False)

    analista = relationship("Analista", back_populates="comentarios") # back_populates apunta al atributo 'comentarios' en Analista
    campana = relationship("Campana", back_populates="comentarios")   # back_populates apunta al atributo 'comentarios' en Campana


class Aviso(Base):
    __tablename__ = "avisos"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, index=True, nullable=False)
    contenido = Column(Text, nullable=False)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    fecha_vencimiento = Column(DateTime(timezone=True), nullable=True) # Usar DateTime
    
    creador_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=True)

    creador = relationship("Analista", back_populates="avisos_creados") # back_populates apunta a 'avisos_creados' en Analista
    campana = relationship("Campana", back_populates="avisos") # back_populates apunta a 'avisos' en Campana

    acuses_recibo = relationship("AcuseReciboAviso", back_populates="aviso", cascade="all, delete-orphan")


class AcuseReciboAviso(Base):
    __tablename__ = "acuses_recibo_avisos" # Nombre de tabla corregido para ser consistente

    id = Column(Integer, primary_key=True, index=True)
    aviso_id = Column(Integer, ForeignKey("avisos.id"), nullable=False)
    analista_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    fecha_acuse = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    aviso = relationship("Aviso", back_populates="acuses_recibo") # back_populates apunta a 'acuses_recibo' en Aviso
    analista = relationship("Analista", back_populates="acuses_recibo") # back_populates apunta a 'acuses_recibo' en Analista (corregido)