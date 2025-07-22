# enums.py
from enum import Enum

class UserRole(str, Enum):
    ANALISTA = "ANALISTA"
    SUPERVISOR = "SUPERVISOR"
    RESPONSABLE = "RESPONSABLE"

class ProgresoTarea(str, Enum):
    PENDIENTE = "PENDIENTE"
    EN_PROGRESO = "EN_PROGRESO"
    COMPLETADA = "COMPLETADA"
    CANCELADA = "CANCELADA"

class TipoIncidencia(str, Enum):
    ERROR = "ERROR"
    CONSULTA = "CONSULTA"
    MEJORA = "MEJORA"
    OTRO = "OTRO"