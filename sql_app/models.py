from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

# Importa la Base declarativa que definimos en database.py
from database import Base

# Importa el tipo ENUM específico de PostgreSQL para poder usar el parámetro 'name'
from sqlalchemy.dialects.postgresql import ENUM as PostgreSQLEnum
# Importa TypeDecorator para manejar la conversión del Enum
from sqlalchemy.types import TypeDecorator # No necesitamos SQLAlchemyString aquí si ya usamos PostgreSQLEnum directamente como impl

# --- Definición de TypeDecorator para el Enum de ProgresoTarea ---
class ProgresoTareaType(TypeDecorator):
    '''Convierte ProgresoTarea Enum de/a string para PostgreSQL'''

    # La implementación real será el ENUM de PostgreSQL
    # NOTA: En SQLAlchemy 2.0+, la forma recomendada es definir 'impl'
    # como una CLASE (PostgreSQLEnum), no una instancia.
    # Los parámetros para PostgreSQLEnum se pasan en el constructor de este TypeDecorator.
    impl = PostgreSQLEnum # ¡CAMBIO AQUÍ! Ahora es PostgreSQLEnum como clase

    cache_ok = True

    def __init__(self, enum_class, name, create_type=True, **kw): # Añadimos name y create_type
        self.enum_class = enum_class
        # Inicializamos la implementación base (PostgreSQLEnum) con los valores del enum y el nombre.
        # Aquí es donde pasamos los argumentos 'name' y 'create_type' a PostgreSQLEnum.
        # Los argumentos 'enum_class', 'name', 'create_type' se pasan directamente a la 'impl' (PostgreSQLEnum)
        # en el contexto de TypeDecorator, así que no se pasan en super().__init__.
        # Si usaras un tipo genérico como String, super().__init__(**kw) sería suficiente.
        # Para ENUMs específicos de dialectos, la clase de la implementación es importante.
        super().__init__(enum_class, name=name, create_type=create_type, **kw) # ¡CAMBIO CRUCIAL AQUÍ!

    def process_bind_param(self, value, dialect):
        # Cuando Python envía el valor a la base de datos
        if value is None:
            return value
        return value.value # Retorna el valor de la cadena (ej. "Pendiente")

    def process_result_value(self, value, dialect):
        # Cuando la base de datos devuelve un valor a Python
        if value is None:
            return value
        # Convierte la cadena de la DB al miembro del Enum de Python
        return self.enum_class(value)

# Definición del Enum para ProgresoTarea (DEBE coincidir con el de Pydantic)
class ProgresoTarea(enum.Enum):
    PENDIENTE = "PENDIENTE"
    EN_PROGRESO = "EN_PROGRESO"
    COMPLETADA = "COMPLETADA"
    BLOQUEADA = "BLOQUEADA"

# --- Modelos de SQLAlchemy para tus Tablas ---

class Analista(Base):
    __tablename__ = "analistas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, index=True)
    apellido = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    bms_id = Column(Integer, unique=True, index=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow, nullable=False)

    tareas_asignadas = relationship("Tarea", back_populates="analista_asignado")
    comentarios_hechos = relationship("ComentarioCampana", back_populates="analista")
    avisos_creados = relationship("Aviso", back_populates="creador")

class Campana(Base):
    __tablename__ = "campanas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, index=True, nullable=False)
    descripcion = Column(Text, nullable=True)
    fecha_inicio = Column(DateTime, nullable=False)
    fecha_fin = Column(DateTime, nullable=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow, nullable=False)

    tareas = relationship("Tarea", back_populates="campana_relacionada")
    comentarios = relationship("ComentarioCampana", back_populates="campana_relacionada")
    avisos = relationship("Aviso", back_populates="campana_relacionada")

class Tarea(Base):
    __tablename__ = "tareas"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, index=True, nullable=False)
    descripcion = Column(Text, nullable=True)
    fecha_vencimiento = Column(DateTime, nullable=True)
    # ¡Ahora ProgresoTareaType maneja el 'name' y 'create_type' internamente para PostgreSQLEnum!
    progreso = Column(ProgresoTareaType(ProgresoTarea, name='progresotareaenum', create_type=True),
                      default=ProgresoTarea.PENDIENTE, nullable=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow, nullable=False)

    analista_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=False)

    analista_asignado = relationship("Analista", back_populates="tareas_asignadas")
    campana_relacionada = relationship("Campana", back_populates="tareas")

    checklist_items = relationship("ChecklistItem", back_populates="tarea_parent")

class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id = Column(Integer, primary_key=True, index=True)
    descripcion = Column(String, nullable=False)
    completado = Column(Boolean, default=False, nullable=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow, nullable=False)

    tarea_id = Column(Integer, ForeignKey("tareas.id"), nullable=False)

    tarea_parent = relationship("Tarea", back_populates="checklist_items")

class ComentarioCampana(Base):
    __tablename__ = "comentarios_campana"

    id = Column(Integer, primary_key=True, index=True)
    contenido = Column(Text, nullable=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow, nullable=False)

    analista_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=False)

    analista = relationship("Analista", back_populates="comentarios_hechos")
    campana_relacionada = relationship("Campana", back_populates="comentarios")

class Aviso(Base):
    __tablename__ = "avisos"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, index=True, nullable=False)
    contenido = Column(Text, nullable=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow, nullable=False)
    fecha_vencimiento = Column(DateTime, nullable=True)

    creador_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=True)

    creador = relationship("Analista", back_populates="avisos_creados")
    campana_relacionada = relationship("Campana", back_populates="avisos")