from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func
from datetime import timedelta
from typing import Optional, List

# Importamos los modelos de SQLAlchemy (para la DB)
from sql_app import models
from sql_app.models import UserRole # Importa el Enum UserRole

# Importa los modelos Pydantic (tus esquemas para la API)
from schemas.models import (
    Token, TokenData,
    ProgresoTarea, UserRole,
    AnalistaBase, Analista, AnalistaCreate, PasswordUpdate, AnalistaMe,
    CampanaBase, Campana, CampanaSimple,
    TareaBase, Tarea, TareaSimple, TareaListOutput,
    ChecklistItemBase, ChecklistItem, ChecklistItemSimple,
    ComentarioCampanaBase, ComentarioCampana, ComentarioCampanaSimple,
    AvisoBase, Aviso, AvisoSimple, AvisoListOutput, # ¡AvisoListOutput agregado!
    AcuseReciboAviso, AcuseReciboCreate, AcuseReciboAvisoSimple
)

# Importamos la función para obtener la sesión de la DB y el engine
from database import get_db, engine

# Importa las utilidades de seguridad
from security import verify_password, get_password_hash, create_access_token, decode_access_token, ACCESS_TOKEN_EXPIRE_MINUTES

# Importa los errores de SQLAlchemy para un mejor manejo
from sqlalchemy.exc import ProgrammingError

app = FastAPI(
    title="Portal GTR API",
    description="API para la gestión de analistas, campañas, tareas, avisos y acuses de recibo."
)

# Configuración de CORS
origins = [
    "http://localhost",
    "http://localhost:3000", # Si tu frontend corre en 3000
    "http://localhost:5173", # El puerto que reporta tu error
    "http://127.0.0.1:5173", # Otra posible dirección local del frontend
    "http://127.0.0.1:8000", # Si tu frontend se sirve desde el mismo servidor en otro puerto
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Permite todos los métodos (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"], # Permite todos los encabezados
)

# OAuth2PasswordBearer para manejar tokens en los headers
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@app.on_event("startup")
async def startup_event():
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    print("Base de datos y tablas verificadas/creadas al iniciar la aplicación.")

# --- Funciones de Utilidad para Autenticación ---

async def get_analista_by_email(email: str, db: AsyncSession) -> Optional[models.Analista]:
    """Obtiene un analista por su email. No carga relaciones aquí."""
    result = await db.execute(select(models.Analista).filter(models.Analista.email == email))
    return result.scalars().first()

async def get_current_analista(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> models.Analista:
    """Dependencia para obtener el analista autenticado a partir del token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        if payload is None:
            raise credentials_exception
        
        email: str = payload.get("sub")
        role_str: str = payload.get("role")
        
        if email is None or role_str is None:
            raise credentials_exception
        
        token_data = TokenData(email=email)
    except Exception:
        raise credentials_exception
    
    # Aquí no cargamos relaciones, solo el objeto Analista básico
    analista = await get_analista_by_email(token_data.email, db)
    if analista is None:
        raise credentials_exception
    
    return analista

def require_role(required_roles: List[UserRole]):
    """Dependencia para requerir roles específicos."""
    def role_checker(current_analista: models.Analista = Depends(get_current_analista)):
        if current_analista.role.value not in [r.value for r in required_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para realizar esta acción."
            )
        return current_analista
    return role_checker


# --- Endpoints de Autenticación ---

@app.post("/register/", response_model=Analista, status_code=status.HTTP_201_CREATED, summary="Registrar un nuevo Analista")
async def register_analista(analista: AnalistaCreate, db: AsyncSession = Depends(get_db)):
    """
    Registra un nuevo analista en el sistema.
    La contraseña se encripta antes de guardarse.
    """
    existing_analista_by_email = await get_analista_by_email(analista.email, db)
    if existing_analista_by_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El email ya está registrado.")
    
    result_bms = await db.execute(select(models.Analista).filter(models.Analista.bms_id == analista.bms_id))
    existing_analista_by_bms = result_bms.scalars().first()
    if existing_analista_by_bms:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El BMS ID ya existe.")

    hashed_password = get_password_hash(analista.password)
    db_analista = models.Analista(
        nombre=analista.nombre,
        apellido=analista.apellido,
        email=analista.email,
        bms_id=analista.bms_id,
        hashed_password=hashed_password,
        role=analista.role
    )
    db.add(db_analista)
    try:
        await db.commit()
        await db.refresh(db_analista)
        # Cargar explícitamente las relaciones para la respuesta COMPLETA
        result = await db.execute(
            select(models.Analista)
            .filter(models.Analista.id == db_analista.id)
            .options(
                selectinload(models.Analista.campanas_asignadas),
                selectinload(models.Analista.tareas),
                selectinload(models.Analista.comentarios_campana),
                selectinload(models.Analista.avisos_creados),
                selectinload(models.Analista.acuses_recibo_dados)
            )
        )
        analista_to_return = result.scalars().first()
        if not analista_to_return:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el analista después del registro.")
        return analista_to_return
    except ProgrammingError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error de base de datos al registrar analista: {e}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al registrar analista: {e}"
        )


@app.post("/token", response_model=Token, summary="Obtener Token de Acceso (Login)")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    """
    Permite a un analista iniciar sesión y obtener un token JWT.
    Requiere `username` (email) y `password`.
    """
    analista = await get_analista_by_email(form_data.username, db)
    if not analista or not verify_password(form_data.password, analista.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not analista.esta_activo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario inactivo. Contacte al administrador."
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": analista.email, "role": analista.role.value},
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me/", response_model=Analista, summary="Obtener información del Analista actual (Optimizado para Dashboard)")
async def read_users_me(current_analista: models.Analista = Depends(get_current_analista), db: AsyncSession = Depends(get_db)):
    """
    Obtiene la información del analista que actualmente ha iniciado sesión,
    incluyendo sus campañas asignadas, tareas, avisos creados y acuses de recibo
    para el dashboard.
    """
    # Recargar el analista y cargar explícitamente todas las relaciones necesarias
    result = await db.execute(
        select(models.Analista)
        .filter(models.Analista.id == current_analista.id)
        .options(
            selectinload(models.Analista.campanas_asignadas), # Ya estaba
            selectinload(models.Analista.tareas),             # ¡AÑADIDO! Para evitar MissingGreenlet
            selectinload(models.Analista.avisos_creados),     # ¡AÑADIDO! Para evitar MissingGreenlet
            selectinload(models.Analista.acuses_recibo_avisos) # ¡AÑADIDO! Para asegurar que esta también se cargue
        )
    )
    analista_with_relations = result.scalars().first()
    
    if not analista_with_relations:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No se pudo cargar el perfil del analista con sus relaciones.")
    
    return analista_with_relations


# --- Endpoints para Analistas (Protegidos) ---

@app.post("/analistas/", response_model=Analista, status_code=status.HTTP_201_CREATED, summary="Crear un nuevo Analista (Protegido por Supervisor/Responsable)")
async def crear_analista(
    analista: AnalistaCreate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    """
    Crea un nuevo analista en el sistema y lo guarda en la base de datos.
    Requiere autenticación y rol de SUPERVISOR o RESPONSABLE.
    """
    existing_analista_by_email = await get_analista_by_email(analista.email, db)
    if existing_analista_by_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El email ya está registrado.")
    
    result_bms = await db.execute(select(models.Analista).filter(models.Analista.bms_id == analista.bms_id))
    existing_analista_by_bms = result_bms.scalars().first()
    if existing_analista_by_bms:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El BMS ID ya existe.")

    hashed_password = get_password_hash(analista.password)
    db_analista = models.Analista(
        nombre=analista.nombre,
        apellido=analista.apellido,
        email=analista.email,
        bms_id=analista.bms_id,
        hashed_password=hashed_password,
        role=analista.role
    )
    db.add(db_analista)
    try:
        await db.commit()
        await db.refresh(db_analista)
        # Cargar explícitamente las relaciones para la respuesta COMPLETA
        result = await db.execute(
            select(models.Analista)
            .filter(models.Analista.id == db_analista.id)
            .options(
                selectinload(models.Analista.campanas_asignadas),
                selectinload(models.Analista.tareas),
                # selectinload(models.Analista.comentarios_campana), # ELIMINADO: Esta relación no existe en el modelo Analista
                selectinload(models.Analista.avisos_creados),
                selectinload(models.Analista.acuses_recibo_avisos) # ¡CORREGIDO AQUÍ!
            )
        )
        analista_to_return = result.scalars().first()
        if not analista_to_return:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el analista después de la creación.")
        return analista_to_return
    except ProgrammingError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error de base de datos al crear analista: {e}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al crear analista: {e}"
        )

@app.get("/analistas/", response_model=List[Analista], summary="Obtener todos los Analistas Activos (Protegido por Supervisor/Responsable)")
async def obtener_analistas(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    """
    Obtiene la lista de todos los analistas **activos** desde la base de datos.
    Requiere autenticación y rol de SUPERVISOR o RESPONSABLE.
    """
    query = select(models.Analista)
    query = query.options(
        selectinload(models.Analista.campanas_asignadas),
        selectinload(models.Analista.tareas),
        selectinload(models.Analista.avisos_creados),
        selectinload(models.Analista.acuses_recibo_avisos) # ¡CORREGIDO AQUÍ! De 'acuses_recibo_dados' a 'acuses_recibo_avisos'
    )
    query = query.where(models.Analista.esta_activo == True)
    result = await db.execute(query)
    analistas = result.scalars().unique().all()
    return analistas


@app.get("/analistas/{analista_id}", response_model=Analista, summary="Obtener Analista por ID (activo) (Protegido)")
async def obtener_analista_por_id(
    analista_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene los detalles de un analista **activo** específico por su ID.
    Requiere autenticación.
    Un analista normal solo puede ver su propio perfil.
    """
    result = await db.execute(
        select(models.Analista)
        .filter(models.Analista.id == analista_id, models.Analista.esta_activo == True)
        .options(
            selectinload(models.Analista.campanas_asignadas),
            selectinload(models.Analista.tareas),
            selectinload(models.Analista.avisos_creados),
            selectinload(models.Analista.acuses_recibo_avisos) # ¡CORREGIDO AQUÍ!
        )
    )
    analista = result.scalars().first()
    if not analista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado o inactivo.")
    
    if current_analista.role == UserRole.ANALISTA and current_analista.id != analista_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver este perfil de analista.")

    return analista


@app.get("/analistas/todos/", response_model=List[Analista], summary="Obtener todos los Analistas (activos e inactivos) (Protegido por Supervisor)")
async def get_all_analistas(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR]))
):
    """
    Obtiene una lista de todos los analistas, incluyendo inactivos si `include_inactive` es True.
    Requiere autenticación y rol de SUPERVISOR.
    """
    query = select(models.Analista).options(
        selectinload(models.Analista.campanas_asignadas),
        selectinload(models.Analista.tareas),
        selectinload(models.Analista.avisos_creados),
        selectinload(models.Analista.acuses_recibo_avisos) # ¡CORREGIDO AQUÍ!
    )
    if not include_inactive:
        query = query.where(models.Analista.esta_activo == True)
    result = await db.execute(query)
    analistas = result.scalars().unique().all()
    return analistas


@app.get("/analistas/bms/{bms_id}", response_model=Analista, summary="Obtener Analista por BMS ID (Protegido)")
async def obtener_analista_por_bms_id(
    bms_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene un analista específico por su BMS ID (legajo) desde la base de datos.
    Requiere autenticación. Un analista normal solo puede ver su propio perfil.
    """
    result = await db.execute(
        select(models.Analista)
        .filter(models.Analista.bms_id == bms_id, models.Analista.esta_activo == True)
        .options(
            selectinload(models.Analista.campanas_asignadas),
            selectinload(models.Analista.tareas),
            selectinload(models.Analista.avisos_creados),
            selectinload(models.Analista.acuses_recibo_avisos) # ¡CORREGIDO AQUÍ!
        )
    )
    analista = result.scalars().first()
    if not analista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado por BMS ID o inactivo.")
    
    if current_analista.role == UserRole.ANALISTA and current_analista.bms_id != bms_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver este perfil de analista.")

    return analista


@app.put("/analistas/{analista_id}", response_model=Analista, summary="Actualizar un Analista existente (Protegido por Supervisor/Responsable)")
async def actualizar_analista(
    analista_id: int,
    analista_update: AnalistaBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    """
    Actualiza la información de un analista existente.
    Requiere autenticación y rol de SUPERVISOR o RESPONSABLE.
    Los analistas solo pueden actualizar su propio perfil.
    """
    db_analista_result = await db.execute(select(models.Analista).where(models.Analista.id == analista_id))
    analista_existente = db_analista_result.scalars().first()

    if analista_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado")

    if current_analista.role == UserRole.RESPONSABLE and analista_existente.role != UserRole.ANALISTA:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Un Responsable solo puede editar perfiles de Analistas normales.")
    
    if current_analista.role == UserRole.ANALISTA:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Los analistas no pueden usar este endpoint para actualizar su perfil.")


    analista_data = analista_update.model_dump(exclude_unset=True)
    for key, value in analista_data.items():
        if key == "hashed_password" or key == "role":
            continue
        setattr(analista_existente, key, value)

    try:
        await db.commit()
        await db.refresh(analista_existente)
        # Cargar explícitamente las relaciones para la respuesta COMPLETA
        result = await db.execute(
            select(models.Analista)
            .filter(models.Analista.id == analista_existente.id)
            .options(
                selectinload(models.Analista.campanas_asignadas),
                selectinload(models.Analista.tareas),
                # selectinload(models.Analista.comentarios_campana), # ELIMINADO
                selectinload(models.Analista.avisos_creados),
                selectinload(models.Analista.acuses_recibo_avisos) # ¡CORREGIDO AQUÍ!
            )
        )
        analista_to_return = result.scalars().first()
        if not analista_to_return:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el analista después de la actualización.")
        
        return analista_to_return
    except ProgrammingError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error de base de datos al actualizar analista: {e}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al actualizar analista: {e}"
        )

@app.put("/analistas/{analista_id}/password", response_model=Analista, summary="Actualizar contraseña de un Analista (Protegido)")
async def update_analista_password(
    analista_id: int,
    password_update: PasswordUpdate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Actualiza la contraseña de un analista.
    Un analista puede actualizar su propia contraseña.
    Un Responsable puede actualizar la contraseña de un Analista normal.
    Un Supervisor puede actualizar cualquier contraseña.
    """
    db_analista_result = await db.execute(select(models.Analista).where(models.Analista.id == analista_id))
    analista_a_actualizar = db_analista_result.scalars().first()

    if analista_a_actualizar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado.")

    if current_analista.role == UserRole.ANALISTA and current_analista.id != analista_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para actualizar esta contraseña.")
    
    if current_analista.role == UserRole.RESPONSABLE and analista_a_actualizar.role != UserRole.ANALISTA:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Un Responsable solo puede actualizar la contraseña de Analistas normales.")
    
    hashed_password = get_password_hash(password_update.new_password)
    analista_a_actualizar.hashed_password = hashed_password

    try:
        await db.commit()
        await db.refresh(analista_a_actualizar)
        # Cargar explícitamente las relaciones para la respuesta COMPLETA
        result = await db.execute(
            select(models.Analista)
            .filter(models.Analista.id == analista_a_actualizar.id)
            .options(
                selectinload(models.Analista.campanas_asignadas),
                selectinload(models.Analista.tareas),
                # selectinload(models.Analista.comentarios_campana), # ELIMINADO
                selectinload(models.Analista.avisos_creados),
                selectinload(models.Analista.acuses_recibo_avisos) # ¡CORREGIDO AQUÍ!
            )
        )
        analista_to_return = result.scalars().first()
        if not analista_to_return:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el analista después de la actualización de contraseña.")
        return analista_to_return
    except ProgrammingError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error de base de datos al actualizar contraseña: {e}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al actualizar contraseña: {e}"
        )


@app.delete("/analistas/{analista_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Desactivar un Analista (Protegido por Supervisor)")
async def desactivar_analista(
    analista_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR]))
):
    """
    Desactiva (soft delete) un analista existente en la base de datos.
    El analista no se elimina físicamente, solo se marca como inactivo.
    Requiere autenticación y rol de SUPERVISOR.
    """
    db_analista = await db.execute(select(models.Analista).where(models.Analista.id == analista_id))
    analista_a_desactivar = db_analista.scalar_one_or_none()

    if analista_a_desactivar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado.")

    if analista_a_desactivar.id == current_analista.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No puedes desactivarte a ti mismo.")

    analista_a_desactivar.esta_activo = False
    
    try:
        await db.commit()
    except ProgrammingError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error de base de datos al desactivar analista: {e}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al desactivar analista: {e}"
        )
    await db.refresh(analista_a_desactivar)

    return

# --- Endpoints para Asignación de Campañas a Analistas (¡NUEVOS!) ---

@app.post("/analistas/{analista_id}/campanas/{campana_id}", response_model=Analista, status_code=status.HTTP_200_OK, summary="Asignar Campaña a Analista")
async def asignar_campana_a_analista(
    analista_id: int,
    campana_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    """
    Asigna una campaña a un analista.
    Requiere autenticación y rol de SUPERVISOR o RESPONSABLE.
    """
    analista_result = await db.execute(
        select(models.Analista)
        .filter(models.Analista.id == analista_id)
        .options(
            selectinload(models.Analista.campanas_asignadas),
            selectinload(models.Analista.tareas),
            # selectinload(models.Analista.comentarios_campana), # ELIMINADO
            selectinload(models.Analista.avisos_creados),
            selectinload(models.Analista.acuses_recibo_avisos) # ¡CORREGIDO AQUÍ!
        )
    )
    analista = analista_result.scalars().first()
    if not analista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado.")

    campana_result = await db.execute(select(models.Campana).filter(models.Campana.id == campana_id))
    campana = campana_result.scalars().first()
    if not campana:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada.")

    # Un RESPONSABLE solo puede asignar campañas a analistas de rol ANALISTA
    if current_analista.role == UserRole.RESPONSABLE and analista.role != UserRole.ANALISTA:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Un Responsable solo puede asignar campañas a analistas de rol ANALISTA.")

    if campana in analista.campanas_asignadas:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="La campaña ya está asignada a este analista.")

    analista.campanas_asignadas.append(campana)
    try:
        await db.commit()
    except ProgrammingError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error de base de datos al asignar campaña: {e}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al asignar campaña: {e}"
        )
    await db.refresh(analista)
    # Recargar explícitamente las relaciones para la respuesta COMPLETA
    # Asegúrate de que esta sección también tenga las correcciones
    result = await db.execute(
        select(models.Analista)
        .filter(models.Analista.id == analista.id)
        .options(
            selectinload(models.Analista.campanas_asignadas),
            selectinload(models.Analista.tareas),
            # selectinload(models.Analista.comentarios_campana), # ELIMINADO
            selectinload(models.Analista.avisos_creados),
            selectinload(models.Analista.acuses_recibo_avisos) # ¡CORREGIDO AQUÍ!
        )
    )
    analista_to_return = result.scalars().first()
    if not analista_to_return:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el analista después de la asignación.")
    return analista_to_return

@app.delete("/analistas/{analista_id}/campanas/{campana_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Desasignar Campaña de Analista")
async def desasignar_campana_de_analista(
    analista_id: int,
    campana_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    """
    Desasigna una campaña de un analista.
    Requiere autenticación y rol de SUPERVISOR o RESPONSABLE.
    """
    analista_result = await db.execute(
        select(models.Analista)
        .filter(models.Analista.id == analista_id)
        .options(
            selectinload(models.Analista.campanas_asignadas),
            selectinload(models.Analista.tareas),
            selectinload(models.Analista.avisos_creados),
            selectinload(models.Analista.acuses_recibo_avisos) # ¡CORREGIDO AQUÍ también para carga inicial!
        )
    )
    analista = analista_result.scalars().first()
    if not analista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado.")

    campana_result = await db.execute(select(models.Campana).filter(models.Campana.id == campana_id))
    campana = campana_result.scalars().first()
    if not campana:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada.")

    # Un RESPONSABLE solo puede desasignar campañas de analistas de rol ANALISTA
    if current_analista.role == UserRole.RESPONSABLE and analista.role != UserRole.ANALISTA:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Un Responsable solo puede desasignar campañas de analistas de rol ANALISTA.")

    if campana not in analista.campanas_asignadas:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La campaña no está asignada a este analista.")

    analista.campanas_asignadas.remove(campana)
    try:
        await db.commit()
    except ProgrammingError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error de base de datos al desasignar campaña: {e}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al desasignar campaña: {e}"
        )
    # Si esta función devuelve el analista actualizado, necesitarías recargarlo con las relaciones
    # Si solo devuelve 204 No Content, no es necesario recargar el objeto completo.
    # Por ahora, como el response_model es Analista, asumiré que quieres devolver el objeto.
    await db.refresh(analista)
    result = await db.execute(
        select(models.Analista)
        .filter(models.Analista.id == analista.id)
        .options(
            selectinload(models.Analista.campanas_asignadas),
            selectinload(models.Analista.tareas),
            selectinload(models.Analista.avisos_creados),
            selectinload(models.Analista.acuses_recibo_avisos) # ¡CORREGIDO AQUÍ!
        )
    )
    analista_to_return = result.scalars().first()
    if not analista_to_return:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el analista después de la desasignación.")
    return analista_to_return

# --- Endpoints para Campañas (Protegidos) ---

@app.post("/campanas/", response_model=Campana, status_code=status.HTTP_201_CREATED, summary="Crear una nueva Campaña (Protegido por Supervisor/Responsable)")
async def crear_campana(
    campana: CampanaBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    """
    Crea una nueva campaña en el sistema y la guarda en la base de datos.
    Requiere autenticación y rol de SUPERVISOR o RESPONSABLE.
    """
    db_campana = models.Campana(**campana.model_dump())
    db.add(db_campana)
    try:
        await db.commit()
    except ProgrammingError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error de base de datos al crear campaña: {e}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al crear campaña: {e}"
        )
    await db.refresh(db_campana)

    # Forzar la carga de relaciones antes de la serialización de Pydantic
    result = await db.execute(
        select(models.Campana)
        .filter(models.Campana.id == db_campana.id)
        .options(
            selectinload(models.Campana.analistas_asignados),
            selectinload(models.Campana.tareas),
            selectinload(models.Campana.comentarios),
            selectinload(models.Campana.avisos)
        )
    )
    campana_to_return = result.scalars().first()
    if not campana_to_return:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar la campaña después de la creación.")
    return campana_to_return


@app.get("/campanas/", response_model=List[Campana], summary="Obtener todas las Campañas (Protegido)")
async def obtener_campanas(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene la lista de todas las campañas desde la base de datos.
    Requiere autenticación.
    """
    result = await db.execute(
        select(models.Campana)
        .options(
            selectinload(models.Campana.analistas_asignados),
            selectinload(models.Campana.tareas),
            selectinload(models.Campana.comentarios),
            selectinload(models.Campana.avisos)
        )
    )
    campanas = result.scalars().unique().all()
    return campanas


@app.get("/campanas/{campana_id}", response_model=Campana, summary="Obtener Campaña por ID (Protegido)")
async def obtener_campana_por_id(
    campana_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene una campaña específica por su ID desde la base de datos.
    Requiere autenticación.
    """
    result = await db.execute(
        select(models.Campana)
        .filter(models.Campana.id == campana_id)
        .options(
            selectinload(models.Campana.analistas_asignados),
            selectinload(models.Campana.tareas),
            selectinload(models.Campana.comentarios),
            selectinload(models.Campana.avisos)
        )
    )
    campana = result.scalars().first()
    if not campana:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada.")
    return campana

@app.put("/campanas/{campana_id}", response_model=Campana, summary="Actualizar una Campaña existente (Protegido por Supervisor/Responsable)")
async def actualizar_campana(
    campana_id: int,
    campana_update: CampanaBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    """
    Actualiza la información de una campaña existente.
    Requiere autenticación y rol de SUPERVISOR o RESPONSABLE.
    """
    db_campana = await db.execute(select(models.Campana).where(models.Campana.id == campana_id))
    campana_existente = db_campana.scalar_one_or_none()

    if campana_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada")

    campana_data = campana_update.model_dump(exclude_unset=True)
    for key, value in campana_data.items():
        setattr(campana_existente, key, value)

    try:
        await db.commit()
        await db.refresh(campana_existente)
        # Recargar la campaña con sus relaciones para la respuesta
        result = await db.execute(
            select(models.Campana)
            .filter(models.Campana.id == campana_existente.id)
            .options(
                selectinload(models.Campana.analistas_asignados),
                selectinload(models.Campana.tareas),
                selectinload(models.Campana.comentarios),
                selectinload(models.Campana.avisos)
            )
        )
        campana_to_return = result.scalars().first()
        if not campana_to_return:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar la campaña después de la actualización.")
        
        return campana_to_return
    except ProgrammingError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error de base de datos al actualizar campaña: {e}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al actualizar campaña: {e}"
        )


@app.delete("/campanas/{campana_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar una Campaña (Protegido por Supervisor)")
async def eliminar_campana(
    campana_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR]))
):
    """
    Elimina una campaña existente.
    Requiere autenticación y rol de SUPERVISOR.
    """
    db_campana = await db.execute(select(models.Campana).where(models.Campana.id == campana_id))
    campana_a_eliminar = db_campana.scalar_one_or_none()

    if campana_a_eliminar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada")

    try:
        await db.delete(campana_a_eliminar)
        await db.commit()
    except ProgrammingError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error de base de datos al eliminar campaña: {e}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al eliminar campaña: {e}"
        )
    return


# --- Endpoints para Tareas (Protegidos) ---

@app.post("/tareas/", response_model=Tarea, status_code=status.HTTP_201_CREATED, summary="Crear una nueva Tarea (Protegido por Supervisor/Responsable)")
async def crear_tarea(
    tarea: TareaBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    """
    Crea una nueva tarea en el sistema y la guarda en la base de datos.
    Requiere autenticación y rol de SUPERVISOR o RESPONSABLE.
    """
    analista_result = await db.execute(select(models.Analista).filter(models.Analista.id == tarea.analista_id))
    analista_existente = analista_result.scalars().first()
    if not analista_existente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Analista con ID {tarea.analista_id} no encontrado.")

    campana_result = await db.execute(select(models.Campana).filter(models.Campana.id == tarea.campana_id))
    campana_existente = campana_result.scalars().first()
    if not campana_existente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Campaña con ID {tarea.campana_id} no encontrada.")

    tarea_data_dict = tarea.model_dump()
    db_tarea = models.Tarea(
        **tarea_data_dict
    )
    db.add(db_tarea)
    try:
        await db.commit()
    except ProgrammingError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error de base de datos al crear tarea: {e}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al crear tarea: {e}"
        )
    await db.refresh(db_tarea)

    # Forzar la carga de relaciones para la respuesta COMPLETA
    result = await db.execute(
        select(models.Tarea)
        .options(
            selectinload(models.Tarea.analista),
            selectinload(models.Tarea.campana),
            selectinload(models.Tarea.checklist_items)
        )
        .filter(models.Tarea.id == db_tarea.id)
    )
    tarea_to_return = result.scalars().first()
    if not tarea_to_return:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar la tarea después de la creación.")
    
    return tarea_to_return


@app.get("/tareas/", response_model=List[TareaListOutput], summary="Obtener Tareas (con filtros opcionales) (Protegido)")
async def obtener_tareas(
    db: AsyncSession = Depends(get_db),
    analista_id: Optional[int] = None,
    campana_id: Optional[int] = None,
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene todas las tareas, o filtra por analista y/o campaña.
    Requiere autenticación.
    Un analista normal solo ve sus propias tareas.
    """
    query = select(models.Tarea).options(
        selectinload(models.Tarea.analista),
        selectinload(models.Tarea.campana)
        # ¡IMPORTANTE! Se eliminó selectinload(models.Tarea.checklist_items) para optimizar la carga de la lista
        # El frontend debería usar el endpoint de detalle para obtener los checklist_items.
    )

    if current_analista.role == UserRole.ANALISTA:
        query = query.where(models.Tarea.analista_id == current_analista.id)
    else:
        if analista_id:
            query = query.where(models.Tarea.analista_id == analista_id)
        if campana_id:
            query = query.where(models.Tarea.campana_id == campana_id)

    tareas = await db.execute(query)
    return tareas.scalars().unique().all()


@app.get("/tareas/{tarea_id}", response_model=Tarea, summary="Obtener Tarea por ID (Protegido)")
async def obtener_tarea_por_id(
    tarea_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene una tarea específica por su ID desde la base de datos,
    incluyendo nombres de Analista, Campaña y sus Checklist Items.
    """
    result = await db.execute(
        select(models.Tarea)
        .filter(models.Tarea.id == tarea_id)
        .options(
            selectinload(models.Tarea.analista),
            selectinload(models.Tarea.campana),
            selectinload(models.Tarea.checklist_items) # Se mantiene la carga completa para el detalle
        )
    )
    tarea = result.scalars().first()
    
    if not tarea:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada.")
    
    if current_analista.role == UserRole.ANALISTA and tarea.analista_id != current_analista.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver esta tarea.")

    return tarea


@app.put("/tareas/{tarea_id}", response_model=Tarea, summary="Actualizar una Tarea existente (Protegido por Supervisor/Responsable)")
async def actualizar_tarea(
    tarea_id: int,
    tarea_update: TareaBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    """
    Actualiza la información de una tarea existente.
    Requiere autenticación y rol de SUPERVISOR o RESPONSABLE.
    """
    db_tarea_result = await db.execute(
        select(models.Tarea)
        .filter(models.Tarea.id == tarea_id)
        .options(
            selectinload(models.Tarea.analista),
            selectinload(models.Tarea.campana),
            selectinload(models.Tarea.checklist_items)
        )
    )
    tarea_existente = db_tarea_result.scalars().first()

    if tarea_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada")

    update_data = tarea_update.model_dump(exclude_unset=True)

    if "progreso" in update_data:
        tarea_existente.progreso = update_data["progreso"]
        del update_data["progreso"]

    if "analista_id" in update_data and update_data["analista_id"] != tarea_existente.analista_id:
        analista_result = await db.execute(select(models.Analista).filter(models.Analista.id == update_data["analista_id"]))
        if analista_result.scalars().first() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Nuevo Analista con ID {update_data['analista_id']} no encontrado.")
        tarea_existente.analista_id = update_data["analista_id"]
        del update_data["analista_id"]

    if "campana_id" in update_data and update_data["campana_id"] != tarea_existente.campana_id:
        campana_result = await db.execute(select(models.Campana).filter(models.Campana.id == update_data["campana_id"]))
        if campana_result.scalars().first() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Nueva Campaña con ID {update_data['campana_id']} no encontrada.")
        tarea_existente.campana_id = update_data["campana_id"]
        del update_data["campana_id"]

    for key, value in update_data.items():
        setattr(tarea_existente, key, value)

    try:
        await db.commit()
        await db.refresh(tarea_existente)
        result = await db.execute(
            select(models.Tarea)
            .filter(models.Tarea.id == tarea_existente.id)
            .options(
                selectinload(models.Tarea.analista),
                selectinload(models.Tarea.campana),
                selectinload(models.Tarea.checklist_items)
            )
        )
        tarea_to_return = result.scalars().first()
        if not tarea_to_return:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar la tarea después de la actualización.")
        
        return tarea_to_return
    except ProgrammingError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error de base de datos al actualizar tarea: {e}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al actualizar tarea: {e}"
        )


@app.delete("/tareas/{tarea_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar una Tarea (Protegido por Supervisor)")
async def eliminar_tarea(
    tarea_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR]))
):
    """
    Elimina una tarea existente.
    Requiere autenticación y rol de SUPERVISOR.
    """
    db_tarea = await db.execute(select(models.Tarea).where(models.Tarea.id == tarea_id))
    tarea_a_eliminar = db_tarea.scalar_one_or_none()

    if tarea_a_eliminar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada")

    try:
        await db.delete(tarea_a_eliminar)
        await db.commit()
    except ProgrammingError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error de base de datos al eliminar tarea: {e}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al eliminar tarea: {e}"
        )
    return


# --- Endpoints para checklist tareas (Protegidos) ---

@app.post("/checklist_items/", response_model=ChecklistItem, status_code=status.HTTP_201_CREATED, summary="Crear un nuevo ChecklistItem (Protegido por Supervisor/Responsable)")
async def crear_checklist_item(
    item: ChecklistItemBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    """
    Crea un nuevo elemento de checklist asociado a una tarea.
    Requiere autenticación y rol de SUPERVISOR o RESPONSABLE.
    """
    tarea_existente_result = await db.execute(
        select(models.Tarea)
        .filter(models.Tarea.id == item.tarea_id)
        .options(selectinload(models.Tarea.analista), selectinload(models.Tarea.campana))
    )
    tarea_existente = tarea_existente_result.scalars().first()
    if tarea_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada para asociar el ChecklistItem")

    db_item = models.ChecklistItem(**item.model_dump())
    db.add(db_item)
    try:
        await db.commit()
    except ProgrammingError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error de base de datos al crear checklist item: {e}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al crear checklist item: {e}"
        )
    await db.refresh(db_item)
    # Cargar explícitamente la relación tarea para la respuesta COMPLETA
    result = await db.execute(
        select(models.ChecklistItem)
        .filter(models.ChecklistItem.id == db_item.id)
        .options(selectinload(models.ChecklistItem.tarea))
    )
    item_to_return = result.scalars().first()
    if not item_to_return:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el checklist item después de la creación.")
    return item_to_return

@app.get("/checklist_items/{item_id}", response_model=ChecklistItem, summary="Obtener ChecklistItem por ID (Protegido)")
async def obtener_checklist_item_por_id(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene un ítem de checklist específico por su ID.
    Requiere autenticación. Un analista normal solo ve ítems de sus propias tareas.
    """
    result = await db.execute(
        select(models.ChecklistItem)
        .filter(models.ChecklistItem.id == item_id)
        .options(selectinload(models.ChecklistItem.tarea))
    )
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ChecklistItem no encontrado.")
    
    if current_analista.role == UserRole.ANALISTA:
        tarea_result = await db.execute(
            select(models.Tarea)
            .filter(models.Tarea.id == item.tarea_id, models.Tarea.analista_id == current_analista.id)
        )
        if not tarea_result.scalars().first():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver este ChecklistItem.")

    return item


@app.get("/checklist_items/", response_model=List[ChecklistItem], summary="Obtener ChecklistItems (con filtro opcional por tarea) (Protegido)")
async def obtener_checklist_items(
    db: AsyncSession = Depends(get_db),
    tarea_id: Optional[int] = None,
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene todos los elementos de checklist, o filtra por ID de tarea.
    Requiere autenticación. Un analista normal solo ve ítems de sus propias tareas.
    """
    query = select(models.ChecklistItem).options(selectinload(models.ChecklistItem.tarea))
    
    if current_analista.role == UserRole.ANALISTA:
        query = query.join(models.Tarea).where(models.Tarea.analista_id == current_analista.id)
        if tarea_id:
            query = query.where(models.ChecklistItem.tarea_id == tarea_id)
    else:
        if tarea_id:
            query = query.where(models.ChecklistItem.tarea_id == tarea_id)

    items = await db.execute(query)
    return items.scalars().all()

@app.put("/checklist_items/{item_id}", response_model=ChecklistItem, summary="Actualizar un ChecklistItem existente (Protegido por Supervisor/Responsable)")
async def actualizar_checklist_item(
    item_id: int,
    item_update: ChecklistItemBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    """
    Actualiza la información de un elemento de checklist existente.
    Requiere autenticación y rol de SUPERVISOR o RESPONSABLE.
    """
    db_item_result = await db.execute(
        select(models.ChecklistItem)
        .filter(models.ChecklistItem.id == item_id)
        .options(selectinload(models.ChecklistItem.tarea))
    )
    item_existente = db_item_result.scalars().first()

    if item_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ChecklistItem no encontrado")

    if item_update.tarea_id != item_existente.tarea_id:
        nueva_tarea_existente_result = await db.execute(select(models.Tarea).where(models.Tarea.id == item_update.tarea_id))
        if nueva_tarea_existente_result.scalars().first() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nueva Tarea no encontrada para reasignar el ChecklistItem")
        item_existente.tarea_id = item_update.tarea_id

    item_existente.descripcion = item_update.descripcion
    item_existente.completado = item_update.completado

    try:
        await db.commit()
    except ProgrammingError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error de base de datos al actualizar checklist item: {e}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al actualizar checklist item: {e}"
        )
    await db.refresh(item_existente)
    # Cargar explícitamente la relación tarea para la respuesta COMPLETA
    result = await db.execute(
        select(models.ChecklistItem)
        .filter(models.ChecklistItem.id == item_existente.id)
        .options(selectinload(models.ChecklistItem.tarea))
    )
    item_to_return = result.scalars().first()
    if not item_to_return:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el checklist item después de la actualización.")
    return item_to_return

@app.delete("/checklist_items/{item_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar un ChecklistItem (Protegido por Supervisor)")
async def eliminar_checklist_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR]))
):
    """
    Elimina un elemento de checklist existente.
    Requiere autenticación y rol de SUPERVISOR.
    """
    db_item_result = await db.execute(select(models.ChecklistItem).where(models.ChecklistItem.id == item_id))
    item_a_eliminar = db_item_result.scalars().first()

    if item_a_eliminar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ChecklistItem no encontrado")

    try:
        await db.delete(item_a_eliminar)
        await db.commit()
    except ProgrammingError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error de base de datos al eliminar checklist item: {e}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al eliminar checklist item: {e}"
        )
    return


# --- Endpoints para Comentarios de Campaña (Protegidos) ---

@app.post("/comentarios_campana/", response_model=ComentarioCampana, status_code=status.HTTP_201_CREATED, summary="Crear un nuevo Comentario de Campaña (Protegido)")
async def crear_comentario_campana(
    comentario: ComentarioCampanaBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Crea un nuevo comentario asociado a una campaña y a un analista.
    Requiere autenticación.
    """
    analista_result = await db.execute(select(models.Analista).filter(models.Analista.id == comentario.analista_id))
    if analista_result.scalars().first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado.")

    campana_result = await db.execute(select(models.Campana).filter(models.Campana.id == comentario.campana_id))
    if campana_result.scalars().first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada.")

    db_comentario = models.ComentarioCampana(**comentario.model_dump())
    db.add(db_comentario)
    try:
        await db.commit()
    except ProgrammingError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error de base de datos al crear comentario de campaña: {e}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al crear comentario de campaña: {e}"
        )
    await db.refresh(db_comentario)

    # Forzar la carga de relaciones para la respuesta COMPLETA
    result = await db.execute(
        select(models.ComentarioCampana)
        .options(selectinload(models.ComentarioCampana.analista), selectinload(models.ComentarioCampana.campana))
        .filter(models.ComentarioCampana.id == db_comentario.id)
    )
    comentario_to_return = result.scalars().first()
    if not comentario_to_return:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el comentario después de la creación.")
    
    return comentario_to_return


@app.get("/comentarios_campana/", response_model=List[ComentarioCampana], summary="Obtener Comentarios de Campaña (con filtros opcionales) (Protegido)")
async def obtener_comentarios_campana(
    db: AsyncSession = Depends(get_db),
    campana_id: Optional[int] = None,
    analista_id: Optional[int] = None,
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene todos los comentarios de campaña, o filtra por ID de campaña y/o ID de analista.
    Requiere autenticación.
    """
    query = select(models.ComentarioCampana).options(
        selectinload(models.ComentarioCampana.analista),
        selectinload(models.ComentarioCampana.campana)
    )
    if campana_id:
        query = query.where(models.ComentarioCampana.campana_id == campana_id)
    if analista_id:
        query = query.where(models.ComentarioCampana.analista_id == analista_id)

    comentarios = await db.execute(query)
    return comentarios.scalars().unique().all()


@app.delete("/comentarios_campana/{comentario_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar un Comentario de Campaña (Protegido por Supervisor)")
async def eliminar_comentario_campana(
    comentario_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR]))
):
    """
    Elimina un comentario de campaña existente.
    Requiere autenticación y rol de SUPERVISOR.
    """
    db_comentario_result = await db.execute(select(models.ComentarioCampana).where(models.ComentarioCampana.id == comentario_id))
    comentario_a_eliminar = db_comentario_result.scalars().first()

    if comentario_a_eliminar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comentario de Campaña no encontrado.")

    try:
        await db.delete(comentario_a_eliminar)
        await db.commit()
    except ProgrammingError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error de base de datos al eliminar comentario de campaña: {e}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al eliminar comentario de campaña: {e}"
        )
    return


# --- Endpoints para Avisos (Protegidos) ---

@app.post("/avisos/", response_model=Aviso, status_code=status.HTTP_201_CREATED, summary="Crear un nuevo Aviso (Protegido por Supervisor/Responsable)")
async def crear_aviso(
    aviso: AvisoBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    """
    Crea un nuevo aviso.
    Requiere autenticación y rol de SUPERVISOR o RESPONSABLE.
    """
    creador_result = await db.execute(select(models.Analista).filter(models.Analista.id == aviso.creador_id))
    if creador_result.scalars().first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista creador no encontrado.")

    if aviso.campana_id:
        campana_result = await db.execute(select(models.Campana).filter(models.Campana.id == aviso.campana_id))
        if campana_result.scalars().first() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña asociada no encontrada.")

    db_aviso = models.Aviso(**aviso.model_dump())
    db.add(db_aviso)
    try:
        await db.commit()
    except ProgrammingError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error de base de datos al crear aviso: {e}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al crear aviso: {e}"
        )
    await db.refresh(db_aviso)

    # Forzar la carga de relaciones anidadas para la respuesta COMPLETA
    result = await db.execute(
        select(models.Aviso)
        .filter(models.Aviso.id == db_aviso.id)
        .options(
            selectinload(models.Aviso.creador),
            selectinload(models.Aviso.campana),
            selectinload(models.Aviso.acuses_recibo).selectinload(models.AcuseReciboAviso.analista)
        )
    )
    aviso_to_return = result.scalars().first()
    if not aviso_to_return:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el aviso después de la creación.")
    return aviso_to_return

@app.get("/avisos/", response_model=List[AvisoListOutput], summary="Obtener Avisos (con filtros opcionales) (Protegido)") # ¡CAMBIO AQUÍ!
async def obtener_avisos(
    db: AsyncSession = Depends(get_db),
    creador_id: Optional[int] = None,
    campana_id: Optional[int] = None,
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene todos los avisos, o filtra por ID del creador (analista) y/o ID de campaña.
    Requiere autenticación. Un analista normal solo ve avisos creados por él o asociados a sus campañas.
    """
    query = select(models.Aviso).options(
        selectinload(models.Aviso.creador),
        selectinload(models.Aviso.campana)
        # ¡IMPORTANTE! Se eliminó selectinload(models.Aviso.acuses_recibo) para optimizar la carga de la lista
        # El frontend debería usar el endpoint de detalle para obtener los acuses_recibo.
    )

    if current_analista.role == UserRole.ANALISTA:
        query = query.filter(
            (models.Aviso.creador_id == current_analista.id) |
            (models.Aviso.campana_id.is_(None)) |
            (models.Aviso.campana_id.in_(
                select(models.analistas_campanas.c.campana_id).where(models.analistas_campanas.c.analista_id == current_analista.id)
            ))
        )
    else:
        if creador_id:
            query = query.where(models.Aviso.creador_id == creador_id)
        if campana_id:
            query = query.where(models.Aviso.campana_id == campana_id)

    avisos = await db.execute(query)
    return avisos.scalars().unique().all()


@app.get("/avisos/{aviso_id}", response_model=Aviso, summary="Obtener Aviso por ID (Protegido)")
async def obtener_aviso_por_id(
    aviso_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene un aviso específico por su ID.
    Requiere autenticación. Un analista normal solo ve avisos que él creó o asociados a sus campañas.
    """
    result = await db.execute(
        select(models.Aviso)
        .filter(models.Aviso.id == aviso_id)
        .options(
            selectinload(models.Aviso.creador),
            selectinload(models.Aviso.campana),
            selectinload(models.Aviso.acuses_recibo).selectinload(models.AcuseReciboAviso.analista) # ¡IMPORTANTE! Se mantiene la carga completa para el detalle
        )
    )
    aviso = result.scalars().first()
    if not aviso:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aviso no encontrado.")
    
    if current_analista.role == UserRole.ANALISTA:
        is_creator = aviso.creador_id == current_analista.id
        is_assigned_to_campaign = False
        if aviso.campana_id:
            assigned_campaigns_result = await db.execute(
                select(models.analistas_campanas.c.campana_id)
                .where(models.analistas_campanas.c.analista_id == current_analista.id)
            )
            assigned_campaign_ids = [c_id for (c_id,) in assigned_campaigns_result.all()]
            is_assigned_to_campaign = aviso.campana_id in assigned_campaign_ids
        
        if not is_creator and not is_assigned_to_campaign:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver este aviso.")

    return aviso

@app.put("/avisos/{aviso_id}", response_model=Aviso, summary="Actualizar un Aviso existente (Protegido por Supervisor/Responsable)")
async def actualizar_aviso(
    aviso_id: int,
    aviso_update: AvisoBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    """
    Actualiza la información de un aviso existente.
    Requiere autenticación y rol de SUPERVISOR o RESPONSABLE.
    """
    db_aviso_result = await db.execute(select(models.Aviso).where(models.Aviso.id == aviso_id))
    aviso_existente = db_aviso_result.scalars().first()

    if aviso_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aviso no encontrado.")

    if aviso_update.creador_id is not None and aviso_update.creador_id != aviso_existente.creador_id:
        nuevo_creador_result = await db.execute(select(models.Analista).where(models.Analista.id == aviso_update.creador_id))
        if nuevo_creador_result.scalars().first() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nuevo Analista creador no encontrado para reasignar el Aviso.")
        aviso_existente.creador_id = aviso_update.creador_id

    if aviso_update.campana_id is not None and aviso_update.campana_id != aviso_existente.campana_id:
        nueva_campana_result = await db.execute(select(models.Campana).where(models.Campana.id == aviso_update.campana_id))
        if nueva_campana_result.scalars().first() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nueva Campaña no encontrada para reasignar el Aviso.")
        aviso_existente.campana_id = aviso_update.campana_id
    elif aviso_update.campana_id is None and aviso_existente.campana_id is not None:
        aviso_existente.campana_id = None

    aviso_data = aviso_update.model_dump(exclude_unset=True)
    for key, value in aviso_data.items():
        if key not in ['creador_id', 'campana_id']:
            setattr(aviso_existente, key, value)

    try:
        await db.commit()
        await db.refresh(aviso_existente)
    except ProgrammingError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error de base de datos al actualizar aviso: {e}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al actualizar aviso: {e}"
        )
    
    updated_aviso_result = await db.execute(
        select(models.Aviso)
        .options(
            selectinload(models.Aviso.creador),
            selectinload(models.Aviso.campana),
            selectinload(models.Aviso.acuses_recibo).selectinload(models.AcuseReciboAviso.analista)
        )
        .filter(models.Aviso.id == aviso_id)
    )
    updated_aviso = updated_aviso_result.scalars().first()
    if not updated_aviso:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el aviso después de la actualización.")
    
    return updated_aviso


@app.delete("/avisos/{aviso_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar un Aviso (Protegido por Supervisor)")
async def eliminar_aviso(
    aviso_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR]))
):
    """
    Elimina un aviso existente.
    Requiere autenticación y rol de SUPERVISOR.
    """
    db_aviso_result = await db.execute(select(models.Aviso).where(models.Aviso.id == aviso_id))
    aviso_a_eliminar = db_aviso_result.scalars().first()

    if aviso_a_eliminar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aviso no encontrado.")

    try:
        await db.delete(aviso_a_eliminar)
        await db.commit()
    except ProgrammingError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error de base de datos al eliminar aviso: {e}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al eliminar aviso: {e}"
        )
    return


# --- Endpoints para Acuses de Recibo de Avisos (Protegidos) ---

@app.post("/avisos/{aviso_id}/acuse_recibo", response_model=AcuseReciboAviso, status_code=status.HTTP_201_CREATED, summary="Registrar acuse de recibo para un Aviso (Protegido)")
async def registrar_acuse_recibo(
    aviso_id: int,
    acuse_data: AcuseReciboCreate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Registra que un analista ha visto y acusado un aviso específico.
    Requiere autenticación. Un analista solo puede acusar recibo para sí mismo.
    """
    analista_id = acuse_data.analista_id

    if current_analista.role == UserRole.ANALISTA and analista_id != current_analista.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para registrar un acuse de recibo para otro analista.")

    analista_result = await db.execute(select(models.Analista).filter(models.Analista.id == analista_id))
    analista_existente = analista_result.scalars().first()
    if analista_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado.")

    aviso_result = await db.execute(
        select(models.Aviso)
        .options(selectinload(models.Aviso.creador), selectinload(models.Aviso.campana))
        .where(models.Aviso.id == aviso_id)
    )
    aviso_existente = aviso_result.scalars().first()
    if aviso_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aviso no encontrado.")

    existing_acuse_result = await db.execute(
        select(models.AcuseReciboAviso)
        .where(models.AcuseReciboAviso.aviso_id == aviso_id)
        .where(models.AcuseReciboAviso.analista_id == analista_id)
    )
    if existing_acuse_result.scalars().first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este analista ya ha acusado este aviso.")

    db_acuse = models.AcuseReciboAviso(aviso_id=aviso_id, analista_id=analista_id)
    db.add(db_acuse)
    try:
        await db.commit()
    except ProgrammingError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error de base de datos al registrar acuse de recibo: {e}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al registrar acuse de recibo: {e}"
        )
    await db.refresh(db_acuse)

    # Forzar la carga de relaciones para la respuesta COMPLETA
    result = await db.execute(
        select(models.AcuseReciboAviso)
        .options(
            selectinload(models.AcuseReciboAviso.analista),
            selectinload(models.AcuseReciboAviso.aviso).selectinload(models.Aviso.creador),
            selectinload(models.AcuseReciboAviso.aviso).selectinload(models.Aviso.campana)
        )
        .filter(models.AcuseReciboAviso.id == db_acuse.id)
    )
    acuse_to_return = result.scalars().first()
    if not acuse_to_return:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el acuse de recibo después de la creación.")
    
    return acuse_to_return

@app.get("/avisos/{aviso_id}/acuses_recibo", response_model=List[AcuseReciboAviso], summary="Obtener acuses de recibo para un Aviso (Protegido)")
async def obtener_acuses_recibo_por_aviso(
    aviso_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene todos los acuses de recibo para un aviso específico.
    Requiere autenticación.
    """
    aviso_result = await db.execute(select(models.Aviso).where(models.Aviso.id == aviso_id))
    aviso_existente = aviso_result.scalars().first()
    if aviso_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aviso no encontrado.")
    
    if current_analista.role == UserRole.ANALISTA and aviso_existente.creador_id != current_analista.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver los acuses de recibo de este aviso.")


    query = select(models.AcuseReciboAviso).options(
        selectinload(models.AcuseReciboAviso.analista),
        selectinload(models.AcuseReciboAviso.aviso).selectinload(models.Aviso.creador),
        selectinload(models.AcuseReciboAviso.aviso).selectinload(models.Aviso.campana)
    ).where(models.AcuseReciboAviso.aviso_id == aviso_id)

    acuses = await db.execute(query)
    return acuses.scalars().unique().all()

@app.get("/analistas/{analista_id}/acuses_recibo_avisos", response_model=List[AcuseReciboAviso], summary="Obtener acuses de recibo dados por un Analista (Protegido)")
async def obtener_acuses_recibo_por_analista(
    analista_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene todos los acuses de recibo dados por un analista específico.
    Requiere autenticación. Un analista normal solo puede ver sus propios acuses de recibo.
    """
    analista_result = await db.execute(select(models.Analista).where(models.Analista.id == analista_id))
    analista_existente = analista_result.scalars().first()
    if analista_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado.")
    
    if current_analista.role == UserRole.ANALISTA and analista_id != current_analista.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver los acuses de recibo de otro analista.")


    query = select(models.AcuseReciboAviso).options(
        selectinload(models.AcuseReciboAviso.analista),
        selectinload(models.AcuseReciboAviso.aviso).selectinload(models.Aviso.creador),
        selectinload(models.AcuseReciboAviso.aviso).selectinload(models.Aviso.campana)
    ).where(models.AcuseReciboAviso.analista_id == analista_id)

    acuses = await db.execute(query)
    return acuses.scalars().unique().all()
