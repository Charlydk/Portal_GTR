from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func
from datetime import timedelta, date, datetime # Importar datetime
from typing import Optional, List

# Importamos los modelos de SQLAlchemy (para la DB)
from sql_app import models
from sql_app.models import UserRole, ProgresoTarea, TipoIncidencia # Importar ProgresoTarea y TipoIncidencia
from enums import UserRole, ProgresoTarea, TipoIncidencia


# Importa los modelos Pydantic (tus esquemas para la API)
from schemas.models import (
    Token, TokenData,
    ProgresoTarea, UserRole, TipoIncidencia, # Asegurarse de importar TipoIncidencia aquí
    AnalistaBase, Analista, AnalistaCreate, PasswordUpdate, AnalistaMe,
    CampanaBase, Campana, CampanaSimple,
    TareaBase, Tarea, TareaSimple, TareaListOutput, TareaUpdate,
    ChecklistItemBase, ChecklistItem, ChecklistItemSimple, ChecklistItemUpdate,
    ComentarioCampanaBase, ComentarioCampana, ComentarioCampanaSimple,
    AvisoBase, Aviso, AvisoSimple, AvisoListOutput,
    AcuseReciboAviso, AcuseReciboCreate, AcuseReciboAvisoSimple,
    BitacoraEntryBase, BitacoraEntryUpdate, BitacoraEntry,
    BitacoraGeneralCommentBase, BitacoraGeneralCommentUpdate, BitacoraGeneralComment,
    BitacoraEntrySimple, BitacoraGeneralCommentSimple,
    # Nuevos esquemas para TareaGeneradaPorAviso
    TareaGeneradaPorAvisoBase, TareaGeneradaPorAvisoUpdate, TareaGeneradaPorAviso, TareaGeneradaPorAvisoSimple,
    # Nuevos esquemas para HistorialEstadoTarea
    HistorialEstadoTareaBase, HistorialEstadoTarea, HistorialEstadoTareaSimple
)

# Importamos la función para obtener la sesión de la DB y el engine
from database import get_db, engine

# Importa las utilidades de seguridad
from security import verify_password, get_password_hash, create_access_token, decode_access_token, ACCESS_TOKEN_EXPIRE_MINUTES

app = FastAPI(
    title="Portal GTR API",
    description="API para la gestión de analistas, campañas, tareas, avisos y acuses de recibo."
)

# Configuración de CORS
origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://127.0.0.1:5173", # Asegúrate de que tu frontend está en este puerto
    "http://localhost:5173",
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
    
    # Cargar el analista con todas las relaciones necesarias para el dashboard y otras operaciones
    result = await db.execute(
        select(models.Analista)
        .filter(models.Analista.email == token_data.email)
        .options(
            selectinload(models.Analista.campanas_asignadas),
            selectinload(models.Analista.tareas), # Tareas de campaña
            selectinload(models.Analista.avisos_creados),
            selectinload(models.Analista.acuses_recibo_avisos),
            selectinload(models.Analista.tareas_generadas_por_avisos) # NUEVO: Cargar tareas generadas por avisos
        )
    )
    analista = result.scalars().first()
    if analista is None:
        raise credentials_exception
    
    return analista

def require_role(required_roles: List[UserRole]):
    """Dependencia para requerir roles específicos."""
    def role_checker(current_analista: models.Analista = Depends(get_current_analista)):
        # CORRECCIÓN: Comparar los valores de cadena de los Enums
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
        role=analista.role.value,
        hashed_password=hashed_password
    )
    db.add(db_analista)
    try:
        await db.commit()
        await db.refresh(db_analista)
        # Recargar el analista con todas las relaciones para la respuesta
        result = await db.execute(
            select(models.Analista)
            .filter(models.Analista.id == db_analista.id)
            .options(
                selectinload(models.Analista.campanas_asignadas),
                selectinload(models.Analista.tareas),
                selectinload(models.Analista.avisos_creados),
                selectinload(models.Analista.acuses_recibo_avisos),
                selectinload(models.Analista.tareas_generadas_por_avisos) # NUEVO
            )
        )
        analista_to_return = result.scalars().first()
        if not analista_to_return:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el analista después del registro.")
        return analista_to_return
    except Exception as e: # Captura excepciones más generales para rollback
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
    # CORRECCIÓN: Pasar el valor de cadena del Enum UserRole
    access_token = create_access_token(
        data={"sub": analista.email, "role": analista.role.value}, # <-- .value para obtener la cadena
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me/", response_model=Analista, summary="Obtener información del Analista actual (Optimizado para Dashboard)")
async def read_users_me(current_analista: models.Analista = Depends(get_current_analista), db: AsyncSession = Depends(get_db)):
    """
    Obtiene la información del analista que actualmente ha iniciado sesión,
    incluyendo sus campañas asignadas, tareas, avisos creados, acuses de recibo y tareas generadas por avisos.
    """
    # current_analista ya viene cargado con todas las relaciones debido a get_current_analista
    return current_analista


@app.get("/campanas/tareas_disponibles/", response_model=List[TareaListOutput], summary="Obtener Tareas de Campaña sin Asignar (Protegido)")
async def obtener_tareas_disponibles(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene las tareas de las campañas a las que el analista está asignado,
    pero que aún no tienen un analista asignado (analista_id es NULL).
    """
    # Obtener los IDs de las campañas asignadas al analista actual
    assigned_campaign_ids = [c.id for c in current_analista.campanas_asignadas]

    if not assigned_campaign_ids:
        return [] # Si no tiene campañas, no hay tareas disponibles

    query = select(models.Tarea).options(
        selectinload(models.Tarea.analista),
        selectinload(models.Tarea.campana)
    ).where(
        models.Tarea.campana_id.in_(assigned_campaign_ids),
        models.Tarea.analista_id.is_(None) # La condición clave: tareas sin analista
    )

    tareas = await db.execute(query)
    return tareas.scalars().unique().all()


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
        role=analista.role.value
    )
    db.add(db_analista)
    try:
        await db.commit()
        await db.refresh(db_analista)
        # Recargar el analista con todas las relaciones para la respuesta
        result = await db.execute(
            select(models.Analista)
            .filter(models.Analista.id == db_analista.id)
            .options(
                selectinload(models.Analista.campanas_asignadas),
                selectinload(models.Analista.tareas),
                selectinload(models.Analista.avisos_creados),
                selectinload(models.Analista.acuses_recibo_avisos),
                selectinload(models.Analista.tareas_generadas_por_avisos) # NUEVO
            )
        )
        analista_to_return = result.scalars().first()
        if not analista_to_return:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el analista después de la creación.")
        
        return analista_to_return
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
        selectinload(models.Analista.acuses_recibo_avisos),
        selectinload(models.Analista.tareas_generadas_por_avisos) # NUEVO
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
            selectinload(models.Analista.acuses_recibo_avisos),
            selectinload(models.Analista.tareas_generadas_por_avisos) # NUEVO
        )
    )
    analista = result.scalars().first()
    if not analista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado o inactivo.")
    
    if current_analista.role == UserRole.ANALISTA.value and current_analista.id != analista_id:
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
        selectinload(models.Analista.acuses_recibo_avisos),
        selectinload(models.Analista.tareas_generadas_por_avisos) # NUEVO
    )
    if not include_inactive:
        query = query.where(models.Analista.esta_activo == True)
    result = await db.execute(query)
    analistas = result.scalars().unique().all()
    return analistas


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

    if current_analista.role == UserRole.RESPONSABLE.value and analista_existente.role != UserRole.ANALISTA.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Un Responsable solo puede editar perfiles de Analistas normales.")
    
    if current_analista.role == UserRole.ANALISTA.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Los analistas no pueden usar este endpoint para actualizar su perfil.")


    analista_data = analista_update.model_dump(exclude_unset=True)
    for key, value in analista_data.items():
        if key == "hashed_password":
            continue
        if key == "role":
            setattr(analista_existente, key, value.value)
        else:
            setattr(analista_existente, key, value)

    try:
        await db.commit()
        await db.refresh(analista_existente)
        # Recargar el analista con todas las relaciones para la respuesta
        result = await db.execute(
            select(models.Analista)
            .filter(models.Analista.id == analista_existente.id)
            .options(
                selectinload(models.Analista.campanas_asignadas),
                selectinload(models.Analista.tareas),
                selectinload(models.Analista.avisos_creados),
                selectinload(models.Analista.acuses_recibo_avisos),
                selectinload(models.Analista.tareas_generadas_por_avisos) # NUEVO
            )
        )
        analista_to_return = result.scalars().first()
        if not analista_to_return:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el analista después de la actualización.")
        
        return analista_to_return
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

    if current_analista.role == UserRole.ANALISTA.value and current_analista.id != analista_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para actualizar esta contraseña.")
    
    if current_analista.role == UserRole.RESPONSABLE.value and analista_a_actualizar.role != UserRole.ANALISTA.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Un Responsable solo puede actualizar la contraseña de Analistas normales.")
    
    hashed_password = get_password_hash(password_update.new_password)
    analista_a_actualizar.hashed_password = hashed_password

    try:
        await db.commit()
        await db.refresh(analista_a_actualizar)
        # Recargar el analista con todas las relaciones para la respuesta
        result = await db.execute(
            select(models.Analista)
            .filter(models.Analista.id == analista_a_actualizar.id)
            .options(
                selectinload(models.Analista.campanas_asignadas),
                selectinload(models.Analista.tareas),
                selectinload(models.Analista.avisos_creados),
                selectinload(models.Analista.acuses_recibo_avisos),
                selectinload(models.Analista.tareas_generadas_por_avisos) # NUEVO
            )
        )
        analista_to_return = result.scalars().first()
        if not analista_to_return:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el analista después de la actualización de contraseña.")
        return analista_to_return
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
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al desactivar analista: {e}"
        )
    await db.refresh(analista_a_desactivar)

    return

# --- Endpoints para Asignación de Campañas a Analistas ---

@app.post("/analistas/{analista_id}/campanas/{campana_id}", response_model=Analista, status_code=status.HTTP_200_OK, summary="Asignar Campana a Analista (Protegido)")
async def asignar_campana_a_analista(
    analista_id: int,
    campana_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Asigna una campaña a un analista.
    Requiere autenticación.
    Un Analista solo puede asignarse a sí mismo.
    Un Supervisor o Responsable pueden asignar campañas a cualquier analista.
    """
    if current_analista.role == UserRole.ANALISTA.value:
        if analista_id != current_analista.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Un Analista solo puede asignarse campañas a sí mismo.")

    analista_result = await db.execute(
        select(models.Analista)
        .filter(models.Analista.id == analista_id)
        .options(
            selectinload(models.Analista.campanas_asignadas),
            selectinload(models.Analista.tareas),
            selectinload(models.Analista.avisos_creados),
            selectinload(models.Analista.acuses_recibo_avisos),
            selectinload(models.Analista.tareas_generadas_por_avisos) # NUEVO
        )
    )
    analista = analista_result.scalars().first()
    if not analista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado.")

    campana_result = await db.execute(select(models.Campana).filter(models.Campana.id == campana_id))
    campana = campana_result.scalars().first()
    if not campana:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada.")

    if (current_analista.role == UserRole.RESPONSABLE.value and 
        analista.role != UserRole.ANALISTA.value and 
        analista_id != current_analista.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Un Responsable solo puede asignar campañas a analistas de rol ANALISTA o a sí mismo.")


    if campana in analista.campanas_asignadas:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="La campana ya está asignada a este analista.")

    analista.campanas_asignadas.append(campana)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al asignar campana: {e}"
        )
    await db.refresh(analista)
    result = await db.execute(
        select(models.Analista)
        .filter(models.Analista.id == analista.id)
        .options(
            selectinload(models.Analista.campanas_asignadas),
            selectinload(models.Analista.tareas),
            selectinload(models.Analista.avisos_creados),
            selectinload(models.Analista.acuses_recibo_avisos),
            selectinload(models.Analista.tareas_generadas_por_avisos) # NUEVO
        )
    )
    analista_to_return = result.scalars().first()
    if not analista_to_return:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el analista después de la desasignación.")
    return analista_to_return

@app.delete("/analistas/{analista_id}/campanas/{campana_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Desasignar Campana de Analista (Protegido)")
async def desasignar_campana_de_analista(
    analista_id: int,
    campana_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Desasigna una campaña de un analista.
    Requiere autenticación.
    Un Analista solo puede desasignarse a sí mismo.
    Un Supervisor o Responsable pueden desasignar campañas de cualquier analista.
    """
    if current_analista.role == UserRole.ANALISTA.value:
        if analista_id != current_analista.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Un Analista solo puede desasignarse campañas a sí mismo.")

    analista_result = await db.execute(
        select(models.Analista)
        .filter(models.Analista.id == analista_id)
        .options(
            selectinload(models.Analista.campanas_asignadas),
            selectinload(models.Analista.tareas),
            selectinload(models.Analista.avisos_creados),
            selectinload(models.Analista.acuses_recibo_avisos),
            selectinload(models.Analista.tareas_generadas_por_avisos) # NUEVO
        )
    )
    analista = analista_result.scalars().first()
    if not analista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado.")

    campana_result = await db.execute(select(models.Campana).filter(models.Campana.id == campana_id))
    campana = campana_result.scalars().first()
    if not campana:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada.")

    if (current_analista.role == UserRole.RESPONSABLE.value and 
        analista.role != UserRole.ANALISTA.value and 
        analista_id != current_analista.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Un Responsable solo puede desasignar campañas de analistas de rol ANALISTA o a sí mismo.")

    if campana not in analista.campanas_asignadas:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La campana no está asignada a este analista.")

    analista.campanas_asignadas.remove(campana)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al desasignar campana: {e}"
        )
    await db.refresh(analista)
    result = await db.execute(
        select(models.Analista)
        .filter(models.Analista.id == analista.id)
        .options(
            selectinload(models.Analista.campanas_asignadas),
            selectinload(models.Analista.tareas),
            selectinload(models.Analista.avisos_creados),
            selectinload(models.Analista.acuses_recibo_avisos),
            selectinload(models.Analista.tareas_generadas_por_avisos) # NUEVO
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
    # CORRECCIÓN: Asegurarse de que las fechas sean timezone-naive
    campana_data = campana.model_dump()
    if campana_data.get("fecha_inicio") is not None:
        campana_data["fecha_inicio"] = campana_data["fecha_inicio"].replace(tzinfo=None)
    if campana_data.get("fecha_fin") is not None:
        campana_data["fecha_fin"] = campana_data["fecha_fin"].replace(tzinfo=None)

    db_campana = models.Campana(**campana_data) # Usar campana_data modificada
    db.add(db_campana)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al crear campaña: {e}"
        )
    await db.refresh(db_campana)

    result = await db.execute(
        select(models.Campana)
        .filter(models.Campana.id == db_campana.id)
        .options(
            selectinload(models.Campana.analistas_asignados),
            selectinload(models.Campana.tareas),
            selectinload(models.Campana.comentarios),
            selectinload(models.Campana.avisos),
            selectinload(models.Campana.bitacora_entries),
            selectinload(models.Campana.bitacora_general_comment)
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
            selectinload(models.Campana.avisos),
            selectinload(models.Campana.bitacora_entries),
            selectinload(models.Campana.bitacora_general_comment)
        )
    )
    campanas = result.scalars().unique().all()
    return campanas


@app.get("/campanas/{campana_id}", response_model=Campana, summary="Obtener Campana por ID (Protegido)")
async def obtener_campana_por_id(
    campana_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene una campana específica por su ID desde la base de datos.
    Requiere autenticación.
    Cualquier usuario autenticado puede ver los detalles de cualquier campana.
    """
    result = await db.execute(
        select(models.Campana)
        .filter(models.Campana.id == campana_id)
        .options(
            selectinload(models.Campana.analistas_asignados),
            selectinload(models.Campana.tareas),
            selectinload(models.Campana.comentarios),
            selectinload(models.Campana.avisos),
            selectinload(models.Campana.bitacora_entries),
            selectinload(models.Campana.bitacora_general_comment)
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
    
    # CORRECCIÓN: Asegurarse de que las fechas sean timezone-naive al actualizar
    if "fecha_inicio" in campana_data and campana_data["fecha_inicio"] is not None:
        campana_data["fecha_inicio"] = campana_data["fecha_inicio"].replace(tzinfo=None)
    if "fecha_fin" in campana_data and campana_data["fecha_fin"] is not None:
        campana_data["fecha_fin"] = campana_data["fecha_fin"].replace(tzinfo=None)

    for key, value in campana_data.items():
        setattr(campana_existente, key, value)

    try:
        await db.commit()
        await db.refresh(campana_existente)
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al actualizar campaña: {e}"
        )
    
    updated_campana_result = await db.execute(
        select(models.Campana)
        .filter(models.Campana.id == campana_id)
        .options(
            selectinload(models.Campana.analistas_asignados),
            selectinload(models.Campana.tareas),
            selectinload(models.Campana.comentarios),
            selectinload(models.Campana.avisos),
            selectinload(models.Campana.bitacora_entries),
            selectinload(models.Campana.bitacora_general_comment)
        )
    )
    updated_campana = updated_campana_result.scalars().first()
    if not updated_campana:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar la campaña después de la actualización.")
    
    return updated_campana


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
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al eliminar campaña: {e}"
        )
    return


# --- Endpoints para Tareas (Protegidos) ---

@app.post("/tareas/", response_model=Tarea, status_code=status.HTTP_201_CREATED, summary="Crear una nueva Tarea (Protegido)")
async def crear_tarea(
    tarea: TareaBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Crea una nueva tarea.
    - Supervisor/Responsable: Pueden crear tareas asignadas o sin asignar (estas últimas deben tener campaña).
    - Analista: Solo puede crear tareas para sí mismo y en campañas a las que esté asignado.
    """
    current_analista_id = current_analista.id
    current_analista_role_value = current_analista.role.value # Usamos .value para la comparación de strings

    # --- VALIDACIÓN DE EXISTENCIA (MODIFICADA PARA SER OPCIONAL) ---
    # 1. Si se proporciona un analista, verificar que existe.
    if tarea.analista_id:
        analista_result = await db.execute(select(models.Analista).filter(models.Analista.id == tarea.analista_id))
        if not analista_result.scalars().first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Analista con ID {tarea.analista_id} no encontrado.")

    # 2. Si se proporciona una campaña, verificar que existe.
    if tarea.campana_id:
        campana_result = await db.execute(select(models.Campana).filter(models.Campana.id == tarea.campana_id))
        if not campana_result.scalars().first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Campaña con ID {tarea.campana_id} no encontrada.")

    # --- LÓGICA DE PERMISOS (FUSIONADA) ---
    # 3. Mantenemos tu lógica original para el rol ANALISTA
    if current_analista_role_value == UserRole.ANALISTA.value:
        # Un analista DEBE asignarse la tarea a sí mismo
        if not tarea.analista_id or tarea.analista_id != current_analista_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Un Analista solo puede crear tareas para sí mismo.")
        
        # Si la tarea tiene campana_id, el analista debe estar asignado a esa campaña (TU LÓGICA ORIGINAL)
        if tarea.campana_id:
            is_assigned_to_campaign_result = await db.execute(
                select(models.analistas_campanas.c.campana_id)
                .where(models.analistas_campanas.c.analista_id == current_analista_id)
                .where(models.analistas_campanas.c.campana_id == tarea.campana_id)
            )
            if not is_assigned_to_campaign_result.scalars().first():
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para crear tareas en esta campaña. No estás asignado a ella.")
    
    # 4. Agregamos la nueva regla para SUPERVISOR/RESPONSABLE
    elif current_analista_role_value in [UserRole.SUPERVISOR.value, UserRole.RESPONSABLE.value]:
        # Si crean una tarea sin analista, DEBE tener una campaña.
        if not tarea.analista_id and not tarea.campana_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Una tarea sin analista asignado debe estar asociada a una campaña.")

    # --- El resto de la función se mantiene igual que la tuya ---
    tarea_data_dict = tarea.model_dump()
    if tarea_data_dict.get("fecha_vencimiento") is not None:
        tarea_data_dict["fecha_vencimiento"] = tarea_data_dict["fecha_vencimiento"].replace(tzinfo=None)

    db_tarea = models.Tarea(**tarea_data_dict)
    db.add(db_tarea)
    
    try:
        await db.commit()
        await db.refresh(db_tarea)
        new_tarea_id = db_tarea.id
        new_tarea_progreso = db_tarea.progreso
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error inesperado al crear tarea: {e}")

    # Registrar el estado inicial de la tarea
    historial_entry = models.HistorialEstadoTarea(
        old_progreso=None,
        new_progreso=new_tarea_progreso,
        changed_by_analista_id=current_analista_id,
        tarea_campana_id=new_tarea_id
    )
    db.add(historial_entry)
    
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error al registrar el historial de la tarea: {e}")

    result = await db.execute(
        select(models.Tarea)
        .options(
            selectinload(models.Tarea.analista),
            selectinload(models.Tarea.campana),
            selectinload(models.Tarea.checklist_items),
            selectinload(models.Tarea.historial_estados).selectinload(models.HistorialEstadoTarea.changed_by_analista)
        )
        .filter(models.Tarea.id == new_tarea_id)
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
    )

    if current_analista.role == UserRole.ANALISTA.value:
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
            selectinload(models.Tarea.checklist_items),
            selectinload(models.Tarea.historial_estados).selectinload(models.HistorialEstadoTarea.changed_by_analista) # Cargar historial con el analista que hizo el cambio
        )
    )
    tarea = result.scalars().first()
    
    if not tarea:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada.")
    
    if current_analista.role == UserRole.ANALISTA.value and tarea.analista_id != current_analista.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver esta tarea.")

    return tarea


@app.put("/tareas/{tarea_id}", response_model=Tarea, summary="Actualizar una Tarea existente (Protegido)")
async def actualizar_tarea(
    tarea_id: int,
    tarea_update: TareaUpdate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    current_analista_id = current_analista.id

    db_tarea_result = await db.execute(
        select(models.Tarea).filter(models.Tarea.id == tarea_id)
    )
    tarea_existente = db_tarea_result.scalars().first()

    if tarea_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada")

    update_data = tarea_update.model_dump(exclude_unset=True)
    old_progreso = tarea_existente.progreso

# --- 👇 PEGA ESTE NUEVO BLOQUE COMPLETO 👇 ---
    if current_analista.role.value == UserRole.ANALISTA.value:
        is_owner = tarea_existente.analista_id == current_analista.id
        is_unassigned = tarea_existente.analista_id is None

        # Caso 1: Analista está tomando una tarea del pool
        if is_unassigned and "analista_id" in update_data and update_data["analista_id"] == current_analista.id:
            tarea_existente.analista_id = current_analista.id
            # Opcional: Cambiar automáticamente el progreso a "EN PROGRESO"
            if tarea_existente.progreso == ProgresoTarea.PENDIENTE.value:
                tarea_existente.progreso = ProgresoTarea.EN_PROGRESO.value

        # Caso 2: Analista es dueño de la tarea y la está actualizando o liberando
        elif is_owner:
            # Subcaso 2.1: Liberando la tarea
            if "analista_id" in update_data and update_data["analista_id"] is None:
                tarea_existente.analista_id = None
                tarea_existente.progreso = ProgresoTarea.PENDIENTE.value # Revertir a pendiente

            # Subcaso 2.2: Actualizando el progreso (si no la está liberando)
            elif "progreso" in update_data:
                tarea_existente.progreso = update_data["progreso"]

            # Siempre puede actualizar la descripción
            if "descripcion" in update_data:
                tarea_existente.descripcion = update_data["descripcion"]

        # Caso 3: Intento no permitido
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para modificar esta tarea.")
    # --- 👆 FIN DEL NUEVO BLOQUE 👆 ---


    elif current_analista.role.value in [UserRole.SUPERVISOR.value, UserRole.RESPONSABLE.value]:
        for key, value in update_data.items():
            if key == "fecha_vencimiento" and value is not None:
                setattr(tarea_existente, key, value.replace(tzinfo=None))
            else:
                setattr(tarea_existente, key, value)
    # --- 👆 FIN DE LA CORRECCIÓN ---

    if tarea_existente.progreso != old_progreso:
        historial_entry = models.HistorialEstadoTarea(
            old_progreso=old_progreso,
            new_progreso=tarea_existente.progreso,
            changed_by_analista_id=current_analista_id,
            tarea_campana_id=tarea_existente.id
        )
        db.add(historial_entry)

        if tarea_existente.progreso in [ProgresoTarea.COMPLETADA, ProgresoTarea.CANCELADA]:
            tarea_existente.fecha_finalizacion = datetime.utcnow().replace(tzinfo=None)
        elif old_progreso in [ProgresoTarea.COMPLETADA, ProgresoTarea.CANCELADA] and \
             tarea_existente.progreso in [ProgresoTarea.PENDIENTE, ProgresoTarea.EN_PROGRESO]:
            tarea_existente.fecha_finalizacion = None
    
    try:
        await db.commit()
        await db.refresh(tarea_existente)
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al actualizar tarea: {e}"
        )
    
    result = await db.execute(
        select(models.Tarea)
        .filter(models.Tarea.id == tarea_existente.id)
        .options(
            selectinload(models.Tarea.analista),
            selectinload(models.Tarea.campana),
            selectinload(models.Tarea.checklist_items),
            selectinload(models.Tarea.historial_estados).selectinload(models.HistorialEstadoTarea.changed_by_analista)
        )
    )
    return result.scalars().first()

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
        # Opcional: Eliminar los historial_estados relacionados si no se hace en cascada a nivel de DB
        # await db.execute(delete(models.HistorialEstadoTarea).where(models.HistorialEstadoTarea.tarea_campana_id == tarea_id))
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al eliminar tarea: {e}"
        )
    return


# --- Endpoints para checklist tareas (Protegidos) ---

@app.post("/checklist_items/", response_model=ChecklistItem, status_code=status.HTTP_201_CREATED, summary="Crear un nuevo ChecklistItem (Protegido)")
async def crear_checklist_item(
    item: ChecklistItemBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Crea un nuevo elemento de checklist asociado a una tarea.
    Requiere autenticación.
    - Un Analista puede crear ítems para tareas a las que está asignado.
    - Un Supervisor o Responsable pueden crear ítems para cualquier tarea.
    """
    tarea_existente_result = await db.execute(
        select(models.Tarea)
        .filter(models.Tarea.id == item.tarea_id)
        .options(selectinload(models.Tarea.analista), selectinload(models.Tarea.campana))
    )
    tarea_existente = tarea_existente_result.scalars().first()
    if tarea_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada para asociar el ChecklistItem")

    # Lógica de permisos para Analistas
    if current_analista.role == UserRole.ANALISTA.value:
        if tarea_existente.analista_id != current_analista.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para crear ítems de checklist para esta tarea. Solo puedes crear ítems para tus propias tareas.")
    
    # Si es Supervisor o Responsable, no hay restricciones adicionales.

    db_item = models.ChecklistItem(**item.model_dump())
    db.add(db_item)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al crear checklist item: {e}"
        )
    await db.refresh(db_item)
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
    
    if current_analista.role == UserRole.ANALISTA.value:
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
    
    if current_analista.role == UserRole.ANALISTA.value:
        query = query.join(models.Tarea).where(models.Tarea.analista_id == current_analista.id)
        if tarea_id:
            query = query.where(models.ChecklistItem.tarea_id == tarea_id)
    else:
        if tarea_id:
            query = query.where(models.ChecklistItem.tarea_id == tarea_id)

    items = await db.execute(query)
    return items.scalars().all()

@app.put("/checklist_items/{item_id}", response_model=ChecklistItem, summary="Actualizar un ChecklistItem existente (Protegido)")
async def actualizar_checklist_item(
    item_id: int,
    item_update: ChecklistItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Actualiza la información de un elemento de checklist existente.
    Requiere autenticación.
    Un Analista solo puede cambiar el estado 'completado' de los ítems de sus propias tareas.
    Un Supervisor o Responsable pueden actualizar cualquier campo de cualquier ítem.
    """
    db_item_result = await db.execute(
        select(models.ChecklistItem)
        .filter(models.ChecklistItem.id == item_id)
        .options(selectinload(models.ChecklistItem.tarea))
    )
    item_existente = db_item_result.scalars().first()

    if item_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ChecklistItem no encontrado")

    update_data = item_update.model_dump(exclude_unset=True)

    if current_analista.role == UserRole.ANALISTA.value:
        if item_existente.tarea.analista_id != current_analista.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para actualizar este ítem de checklist. Solo puedes actualizar ítems de tus propias tareas.")
        
        if "completado" in update_data:
            item_existente.completado = update_data["completado"]
        else:
            pass # Si el analista intenta actualizar otra cosa, simplemente no se hace
            
    elif current_analista.role in [UserRole.SUPERVISOR.value, UserRole.RESPONSABLE.value]:
        if "tarea_id" in update_data and update_data["tarea_id"] != item_existente.tarea_id:
            nueva_tarea_existente_result = await db.execute(select(models.Tarea).where(models.Tarea.id == update_data["tarea_id"]))
            if nueva_tarea_existente_result.scalars().first() is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nueva Tarea no encontrada para reasignar el ChecklistItem")
            item_existente.tarea_id = update_data["tarea_id"]
        
        if "descripcion" in update_data:
            item_existente.descripcion = update_data["descripcion"]
        
        if "completado" in update_data:
            item_existente.completado = update_data["completado"]
    
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para actualizar ítems de checklist con tu rol actual.")

    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al actualizar checklist item: {e}"
        )
    await db.refresh(item_existente)
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
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al crear comentario de campaña: {e}"
        )
    await db.refresh(db_comentario)

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
    aviso: AvisoBase, # AvisoBase ahora incluye requiere_tarea y fecha_vencimiento_tarea
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    """
    Crea un nuevo aviso.
    Requiere autenticación y rol de SUPERVISOR o RESPONSABLE.
    Ahora puede especificar si el aviso requiere una tarea y su fecha de vencimiento.
    """
    creador_result = await db.execute(select(models.Analista).filter(models.Analista.id == aviso.creador_id))
    if creador_result.scalars().first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista creador no encontrado.")

    if aviso.campana_id:
        campana_result = await db.execute(select(models.Campana).filter(models.Campana.id == aviso.campana_id))
        if campana_result.scalars().first() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña asociada no encontrada.")

    # Validar que si requiere_tarea es True, fecha_vencimiento_tarea no sea nula
    if aviso.requiere_tarea and aviso.fecha_vencimiento_tarea is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Si 'requiere_tarea' es True, 'fecha_vencimiento_tarea' no puede ser nula."
        )
    
    # Asegurarse de que las fechas en el aviso sean timezone-naive
    aviso_data = aviso.model_dump()
    if aviso_data.get("fecha_vencimiento") is not None:
        aviso_data["fecha_vencimiento"] = aviso_data["fecha_vencimiento"].replace(tzinfo=None)
    if aviso_data.get("fecha_vencimiento_tarea") is not None:
        aviso_data["fecha_vencimiento_tarea"] = aviso_data["fecha_vencimiento_tarea"].replace(tzinfo=None)

    db_aviso = models.Aviso(**aviso_data)
    db.add(db_aviso)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al crear aviso: {e}"
        )
    await db.refresh(db_aviso)

    result = await db.execute(
        select(models.Aviso)
        .filter(models.Aviso.id == db_aviso.id)
        .options(
            selectinload(models.Aviso.creador),
            selectinload(models.Aviso.campana),
            selectinload(models.Aviso.acuses_recibo).selectinload(models.AcuseReciboAviso.analista),
            selectinload(models.Aviso.tareas_generadas) # NUEVO: Cargar tareas generadas
        )
    )
    aviso_to_return = result.scalars().first()
    if not aviso_to_return:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el aviso después de la creación.")
    return aviso_to_return

@app.get("/avisos/", response_model=List[AvisoListOutput], summary="Obtener Avisos (con filtros opcionales) (Protegido)")
async def obtener_avisos(
    db: AsyncSession = Depends(get_db),
    creador_id: Optional[int] = None,
    campana_id: Optional[int] = None,
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene todos los avisos, o filtra por ID del creador (analista) y/o ID de campaña.
    Requiere autenticación. Un analista normal solo ve avisos creados por él o asociados a sus campañas,
    o avisos que no tienen campaña asociada (generales).
    """
    query = select(models.Aviso).options(
        selectinload(models.Aviso.creador),
        selectinload(models.Aviso.campana)
    )

    if current_analista.role == UserRole.ANALISTA.value:
        # Un analista puede ver:
        # 1. Avisos creados por él
        # 2. Avisos sin campaña asociada (generales)
        # 3. Avisos asociados a campañas a las que está asignado
        query = query.filter(
            (models.Aviso.creador_id == current_analista.id) |
            (models.Aviso.campana_id.is_(None)) | # AHORA INCLUYE AVISOS GENERALES
            (models.Aviso.campana_id.in_(
                select(models.analistas_campanas.c.campana_id).where(models.analistas_campanas.c.analista_id == current_analista.id)
            ))
        )
    else: # Supervisores y Responsables ven todos los avisos
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
    Requiere autenticación. Un analista normal solo ve avisos que él creó o asociados a sus campañas,
    o avisos que no tienen campaña asociada (generales).
    """
    result = await db.execute(
        select(models.Aviso)
        .filter(models.Aviso.id == aviso_id)
        .options(
            selectinload(models.Aviso.creador),
            selectinload(models.Aviso.campana),
            selectinload(models.Aviso.acuses_recibo).selectinload(models.AcuseReciboAviso.analista),
            selectinload(models.Aviso.tareas_generadas) # NUEVO: Cargar tareas generadas
        )
    )
    aviso = result.scalars().first()
    if not aviso:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aviso no encontrado.")
    
    if current_analista.role == UserRole.ANALISTA.value:
        is_creator = aviso.creador_id == current_analista.id
        is_general_aviso = aviso.campana_id is None # NUEVO: Verificar si es un aviso general
        is_assigned_to_campaign = False
        if aviso.campana_id:
            assigned_campaigns_result = await db.execute(
                select(models.analistas_campanas.c.campana_id)
                .where(models.analistas_campanas.c.analista_id == current_analista.id)
            )
            assigned_campaign_ids = [c_id for (c_id,) in assigned_campaigns_result.all()]
            is_assigned_to_campaign = aviso.campana_id in assigned_campaign_ids
        
        if not is_creator and not is_general_aviso and not is_assigned_to_campaign:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver este aviso.")

    return aviso

@app.put("/avisos/{aviso_id}", response_model=Aviso, summary="Actualizar un Aviso existente (Protegido por Supervisor/Responsable)")
async def actualizar_aviso(
    aviso_id: int,
    aviso_update: AvisoBase, # AvisoBase ahora incluye requiere_tarea y fecha_vencimiento_tarea
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

    # Validar que si requiere_tarea es True, fecha_vencimiento_tarea no sea nula
    # Esto se aplica si se está intentando cambiar requiere_tarea a True o si ya es True
    if aviso_update.requiere_tarea and aviso_update.fecha_vencimiento_tarea is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Si 'requiere_tarea' es True, 'fecha_vencimiento_tarea' no puede ser nula."
        )

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
    # Asegurarse de que las fechas en el aviso sean timezone-naive al actualizar
    if "fecha_vencimiento" in aviso_data and aviso_data["fecha_vencimiento"] is not None:
        aviso_data["fecha_vencimiento"] = aviso_data["fecha_vencimiento"].replace(tzinfo=None)
    if "fecha_vencimiento_tarea" in aviso_data and aviso_data["fecha_vencimiento_tarea"] is not None:
        aviso_data["fecha_vencimiento_tarea"] = aviso_data["fecha_vencimiento_tarea"].replace(tzinfo=None)

    for key, value in aviso_data.items():
        if key not in ['creador_id', 'campana_id']:
            setattr(aviso_existente, key, value)

    try:
        await db.commit()
        await db.refresh(aviso_existente)
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
            selectinload(models.Aviso.acuses_recibo).selectinload(models.AcuseReciboAviso.analista),
            selectinload(models.Aviso.tareas_generadas) # NUEVO: Cargar tareas generadas
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
    Si el aviso requiere una tarea, se genera una nueva tarea para el analista.
    """
    # Guardar el ID del analista actual antes de cualquier commit que pueda expirarlo
    current_analista_id = current_analista.id

    analista_id = acuse_data.analista_id

    if current_analista.role == UserRole.ANALISTA.value and analista_id != current_analista.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para registrar un acuse de recibo para otro analista.")

    analista_result = await db.execute(select(models.Analista).filter(models.Analista.id == analista_id))
    analista_existente = analista_result.scalars().first()
    if analista_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado.")

    # Cargar el aviso con la relación tareas_generadas para verificar si ya existe una tarea
    aviso_result = await db.execute(
        select(models.Aviso)
        .options(selectinload(models.Aviso.creador), selectinload(models.Aviso.campana), selectinload(models.Aviso.tareas_generadas)) # NUEVO
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

    # --- Lógica para generar tarea si el aviso lo requiere ---
    if aviso_existente.requiere_tarea:
        # Verificar si ya existe una tarea generada por este aviso para este analista
        existing_generated_task_result = await db.execute(
            select(models.TareaGeneradaPorAviso)
            .filter(
                models.TareaGeneradaPorAviso.aviso_origen_id == aviso_id,
                models.TareaGeneradaPorAviso.analista_asignado_id == analista_id
            )
        )
        if not existing_generated_task_result.scalars().first(): # Si no existe, crearla
            new_generated_task = models.TareaGeneradaPorAviso(
                titulo=f"Tarea de Aviso: {aviso_existente.titulo}",
                descripcion=f"Realizar la acción solicitada en el aviso: {aviso_existente.contenido}",
                # CORRECCIÓN: Asegurarse de que fecha_vencimiento_tarea sea timezone-naive
                fecha_vencimiento=aviso_existente.fecha_vencimiento_tarea.replace(tzinfo=None) if aviso_existente.fecha_vencimiento_tarea else None,
                progreso=ProgresoTarea.PENDIENTE.value,
                analista_asignado_id=analista_id,
                aviso_origen_id=aviso_id
            )
            db.add(new_generated_task)
            print(f"Tarea generada para analista {analista_id} por aviso {aviso_id}") # Para depuración
            
            # Registrar el estado inicial de la tarea generada
            historial_entry = models.HistorialEstadoTarea(
                new_progreso=new_generated_task.progreso,
                changed_by_analista_id=current_analista_id, # El analista que acusa recibo es quien "crea" la tarea generada
                tarea_generada_id=new_generated_task.id # El ID de la tarea generada aún no está disponible aquí
            )
            db.add(historial_entry)

        else:
            print(f"Tarea ya existe para analista {analista_id} por aviso {aviso_id}. No se crea duplicado.") # Para depuración


    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al registrar acuse de recibo o generar tarea: {e}"
        )
    await db.refresh(db_acuse)

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
    
    # Un analista solo puede ver los acuses de recibo de avisos que él creó, o avisos generales, o avisos de sus campañas
    if current_analista.role == UserRole.ANALISTA.value:
        is_creator = aviso_existente.creador_id == current_analista.id
        is_general_aviso = aviso_existente.campana_id is None
        is_assigned_to_campaign = False
        if aviso_existente.campana_id:
            assigned_campaigns_result = await db.execute(
                select(models.analistas_campanas.c.campana_id)
                .where(models.analistas_campanas.c.analista_id == current_analista.id)
            )
            assigned_campaign_ids = [c_id for (c_id,) in assigned_campaigns_result.all()]
            is_assigned_to_campaign = aviso_existente.campana_id in assigned_campaign_ids
        
        if not is_creator and not is_general_aviso and not is_assigned_to_campaign:
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
    
    if current_analista.role == UserRole.ANALISTA.value and analista_id != current_analista.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver los acuses de recibo de otro analista.")


    query = select(models.AcuseReciboAviso).options(
        selectinload(models.AcuseReciboAviso.analista),
        selectinload(models.AcuseReciboAviso.aviso).selectinload(models.Aviso.creador),
        selectinload(models.AcuseReciboAviso.aviso).selectinload(models.Aviso.campana)
    ).where(models.AcuseReciboAviso.analista_id == analista_id)

    acuses = await db.execute(query)
    return acuses.scalars().unique().all()


# --- ENDPOINTS DE BITÁCORA (MODIFICADOS PARA FECHA Y TIPO DE INCIDENCIA) ---

@app.get("/campanas/{campana_id}/bitacora", response_model=List[BitacoraEntry], summary="Obtener Entradas de Bitácora por Campaña y Fecha (Protegido)")
async def get_campana_bitacora_by_date(
    campana_id: int,
    fecha: date = Query(..., description="Fecha de la bitácora en formato YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene las entradas de bitácora para una campana específica y una fecha dada.
    Cualquier usuario autenticado puede ver la bitácora de cualquier campaña a la que esté asignado.
    Supervisores y Responsables pueden ver la bitácora de cualquier campaña.
    """
    campana_existente_result = await db.execute(select(models.Campana).filter(models.Campana.id == campana_id))
    campana_existente = campana_existente_result.scalars().first()
    if not campana_existente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada.")

    if current_analista.role == UserRole.ANALISTA.value:
        analista_with_campanas_result = await db.execute(
            select(models.Analista)
            .filter(models.Analista.id == current_analista.id)
            .options(selectinload(models.Analista.campanas_asignadas))
        )
        analista_with_campanas = analista_with_campanas_result.scalars().first()
        if not analista_with_campanas or campana_existente not in analista_with_campanas.campanas_asignadas:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver la bitácora de esta campana.")

    result = await db.execute(
        select(models.BitacoraEntry)
        .filter(models.BitacoraEntry.campana_id == campana_id, models.BitacoraEntry.fecha == fecha)
        .order_by(models.BitacoraEntry.hora)
    )
    entries = result.scalars().all()
    return entries

@app.post("/bitacora_entries/", response_model=BitacoraEntry, status_code=status.HTTP_201_CREATED, summary="Crear una nueva Entrada de Bitácora (Protegido)")
async def create_bitacora_entry(
    entry: BitacoraEntryBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Crea una nueva entrada de bitácora para una campana en una fecha y hora específicas.
    Puede ser una entrada de bitácora general o una incidencia.
    Un Analista solo puede crear entradas para campañas a las que está asignado.
    Un Supervisor o Responsable pueden crear entradas para cualquier campaña.
    """
    campana_existente_result = await db.execute(select(models.Campana).filter(models.Campana.id == entry.campana_id))
    campana_existente = campana_existente_result.scalars().first()
    if not campana_existente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada.")

    if current_analista.role == UserRole.ANALISTA.value:
        analista_with_campanas_result = await db.execute(
            select(models.Analista)
            .filter(models.Analista.id == current_analista.id)
            .options(selectinload(models.Analista.campanas_asignadas))
        )
        analista_with_campanas = analista_with_campanas_result.scalars().first()
        if not analista_with_campanas or campana_existente not in analista_with_campanas.campanas_asignadas:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para crear entradas de bitácora en esta campana.")
    
    existing_entry_result = await db.execute(
        select(models.BitacoraEntry)
        .filter(models.BitacoraEntry.campana_id == entry.campana_id)
        .filter(models.BitacoraEntry.fecha == entry.fecha)
        .filter(models.BitacoraEntry.hora == entry.hora)
    )
    if existing_entry_result.scalars().first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe una entrada de bitácora para esta fecha y hora en esta campana. Por favor, actualiza la existente.")

    # Crear la entrada de bitácora, incluyendo los campos de incidencia si se proporcionan
    db_entry = models.BitacoraEntry(
        campana_id=entry.campana_id,
        fecha=entry.fecha,
        hora=entry.hora,
        comentario=entry.comentario,
        es_incidencia=entry.es_incidencia,
        tipo_incidencia=entry.tipo_incidencia,
        comentario_incidencia=entry.comentario_incidencia
    )
    db.add(db_entry)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al crear entrada de bitácora: {e}"
        )
    await db.refresh(db_entry)
    return db_entry

@app.put("/bitacora_entries/{entry_id}", response_model=BitacoraEntry, summary="Actualizar una Entrada de Bitácora (Protegido)")
async def update_bitacora_entry(
    entry_id: int,
    entry_update: BitacoraEntryUpdate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Actualiza una entrada de bitácora existente.
    Un Analista solo puede actualizar entradas de bitácora de campanas a las que está asignado.
    Un Supervisor o Responsable pueden actualizar cualquier entrada.
    """
    db_entry_result = await db.execute(
        select(models.BitacoraEntry)
        .filter(models.BitacoraEntry.id == entry_id)
        .options(selectinload(models.BitacoraEntry.campana))
    )
    db_entry = db_entry_result.scalars().first()
    if not db_entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entrada de bitácora no encontrada.")

    if current_analista.role == UserRole.ANALISTA.value:
        analista_with_campanas_result = await db.execute(
            select(models.Analista)
            .filter(models.Analista.id == current_analista.id)
            .options(selectinload(models.Analista.campanas_asignadas))
        )
        analista_with_campanas = analista_with_campanas_result.scalars().first()
        if not analista_with_campanas or db_entry.campana not in analista_with_campanas.campanas_asignadas:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para actualizar esta entrada de bitácora.")

    update_data = entry_update.model_dump(exclude_unset=True)

    if ("fecha" in update_data and update_data["fecha"] != db_entry.fecha) or \
       ("hora" in update_data and update_data["hora"] != db_entry.hora):
        
        new_fecha = update_data.get("fecha", db_entry.fecha)
        new_hora = update_data.get("hora", db_entry.hora)

        existing_entry_at_new_time_result = await db.execute(
            select(models.BitacoraEntry)
            .filter(
                models.BitacoraEntry.campana_id == db_entry.campana_id,
                models.BitacoraEntry.fecha == new_fecha,
                models.BitacoraEntry.hora == new_hora,
                models.BitacoraEntry.id != entry_id
            )
        )
        if existing_entry_at_new_time_result.scalars().first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe una entrada de bitácora para la nueva fecha y hora en esta campana.")

    for field, value in update_data.items():
        setattr(db_entry, field, value)
    
    db_entry.fecha_ultima_actualizacion = func.now()

    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al actualizar entrada de bitácora: {e}"
        )
    await db.refresh(db_entry)
    return db_entry

@app.delete("/bitacora_entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar una Entrada de Bitácora (Protegido)")
async def delete_bitacora_entry(
    entry_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Elimina una entrada de bitácora existente.
    Un Analista solo puede eliminar entradas de bitácora de campanas a las que está asignado.
    Un Supervisor o Responsable pueden eliminar cualquier entrada.
    """
    db_entry_result = await db.execute(
        select(models.BitacoraEntry)
        .filter(models.BitacoraEntry.id == entry_id)
        .options(selectinload(models.BitacoraEntry.campana))
    )
    db_entry = db_entry_result.scalars().first()
    if not db_entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entrada de bitácora no encontrada.")

    if current_analista.role == UserRole.ANALISTA.value:
        analista_with_campanas_result = await db.execute(
            select(models.Analista)
            .filter(models.Analista.id == current_analista.id)
            .options(selectinload(models.Analista.campanas_asignadas))
        )
        analista_with_campanas = analista_with_campanas_result.scalars().first()
        if not analista_with_campanas or db_entry.campana not in analista_with_campanas.campanas_asignadas:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para eliminar esta entrada de bitácora.")

    await db.delete(db_entry)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al eliminar entrada de bitácora: {e}"
        )
    return {"message": "Entrada de bitácora eliminada exitosamente."}

@app.get("/campanas/{campana_id}/bitacora_general_comment", response_model=Optional[BitacoraGeneralComment], summary="Obtener Comentario General de Bitácora (Protegido)")
async def get_bitacora_general_comment(
    campana_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene el comentario general de la bitácora para una campana específica.
    Cualquier usuario autenticado puede ver el comentario general de cualquier campaña a la que esté asignado.
    Supervisores y Responsables pueden ver el comentario de cualquier campaña.
    """
    campana_existente_result = await db.execute(select(models.Campana).filter(models.Campana.id == campana_id))
    campana_existente = campana_existente_result.scalars().first()
    if not campana_existente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada.")

    if current_analista.role == UserRole.ANALISTA.value:
        analista_with_campanas_result = await db.execute(
            select(models.Analista)
            .filter(models.Analista.id == current_analista.id)
            .options(selectinload(models.Analista.campanas_asignadas))
        )
        analista_with_campanas = analista_with_campanas_result.scalars().first()
        if not analista_with_campanas or campana_existente not in analista_with_campanas.campanas_asignadas:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver el comentario general de esta campana.")

    db_comment_result = await db.execute(
        select(models.BitacoraGeneralComment)
        .filter(models.BitacoraGeneralComment.campana_id == campana_id)
    )
    db_comment = db_comment_result.scalars().first()
    return db_comment # Retorna None si no existe, lo cual es manejado por Optional[BitacoraGeneralComment]

@app.put("/campanas/{campana_id}/bitacora_general_comment", response_model=BitacoraGeneralComment, summary="Crear/Actualizar Comentario General de Bitácora (Solo Supervisor/Responsable)")
async def upsert_bitacora_general_comment(
    campana_id: int,
    comment_update: BitacoraGeneralCommentUpdate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    """
    Crea o actualiza el comentario general de la bitácora para una campana.
    Requiere autenticación y rol de SUPERVISOR o RESPONSABLE.
    """
    campana_existente_result = await db.execute(select(models.Campana).filter(models.Campana.id == campana_id))
    campana_existente = campana_existente_result.scalars().first()
    if not campana_existente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada.")

    db_comment_result = await db.execute(
        select(models.BitacoraGeneralComment)
        .filter(models.BitacoraGeneralComment.campana_id == campana_id)
    )
    db_comment = db_comment_result.scalars().first()

    if db_comment:
        for field, value in comment_update.model_dump(exclude_unset=True).items():
            setattr(db_comment, field, value)
        db_comment.fecha_ultima_actualizacion = func.now()
    else:
        db_comment = models.BitacoraGeneralComment(campana_id=campana_id, comentario=comment_update.comentario)
        db.add(db_comment)
    
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al guardar comentario general de bitácora: {e}"
        )
    await db.refresh(db_comment)
    return db_comment

# --- ENDPOINT PARA OBTENER SOLO INCIDENCIAS (FILTRANDO LA BITÁCORA) ---
@app.get("/incidencias/", response_model=List[BitacoraEntry], summary="Obtener Incidencias (filtradas de la Bitácora) (Protegido)")
async def get_incidencias_filtered(
    db: AsyncSession = Depends(get_db),
    analista_id: Optional[int] = None,
    tipo_incidencia: Optional[TipoIncidencia] = None, # Usar el Enum TipoIncidencia
    fecha: Optional[date] = None, # Opcional para filtrar por fecha específica
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene una lista de entradas de bitácora que están marcadas como incidencias.
    Requiere autenticación.
    Un analista normal solo puede ver las incidencias de las campañas a las que está asignado.
    Un Supervisor o Responsable pueden ver todas las incidencias y filtrarlas.
    """
    query = select(models.BitacoraEntry).options(
        selectinload(models.BitacoraEntry.campana) # Cargar la campaña para mostrar su nombre
    ).filter(models.BitacoraEntry.es_incidencia == True) # Solo entradas marcadas como incidencia

    if current_analista.role == UserRole.ANALISTA.value:
        # Filtrar por campañas asignadas al analista actual
        assigned_campaign_ids_result = await db.execute(
            select(models.analistas_campanas.c.campana_id)
            .where(models.analistas_campanas.c.analista_id == current_analista.id)
        )
        assigned_campaign_ids = [c_id for (c_id,) in assigned_campaigns_result.all()]
        query = query.filter(models.BitacoraEntry.campana_id.in_(assigned_campaign_ids))
    else: # Supervisor o Responsable
        if analista_id:
            # Si se filtra por analista, necesitamos unir con la tabla de campañas y analistas
            # para verificar si el analista está asignado a la campaña de la incidencia.
            # Sin embargo, dado que `BitacoraEntry` no tiene una relación directa con `Analista`,
            # y la incidencia es solo un tipo de entrada, el filtro por `analista_id`
            # en este contexto es más complejo si queremos saber "quién la registró".
            # Por simplicidad, lo dejamos sin filtro por analista_id aquí.
            pass
        
    if tipo_incidencia:
        query = query.filter(models.BitacoraEntry.tipo_incidencia == tipo_incidencia)
    
    if fecha:
        query = query.filter(models.BitacoraEntry.fecha == fecha)

    query = query.order_by(models.BitacoraEntry.fecha.desc(), models.BitacoraEntry.hora.desc())

    incidencias = await db.execute(query)
    return incidencias.scalars().unique().all() # Usamos unique() para evitar duplicados si hay joins


# --- NUEVOS ENDPOINTS PARA TAREAS GENERADAS POR AVISOS ---

@app.post("/tareas_generadas_por_avisos/", response_model=TareaGeneradaPorAviso, status_code=status.HTTP_201_CREATED, summary="Crear una Tarea Generada por Aviso (Protegido por Supervisor/Responsable)")
async def create_tarea_generada_por_aviso(
    tarea: TareaGeneradaPorAvisoBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    """
    Crea una nueva tarea que puede ser generada por un aviso.
    Requiere autenticación y rol de SUPERVISOR o RESPONSABLE.
    """
    # Guardar el ID del analista actual antes de cualquier commit que pueda expirarlo
    current_analista_id = current_analista.id

    analista_existente_result = await db.execute(select(models.Analista).filter(models.Analista.id == tarea.analista_asignado_id))
    if not analista_existente_result.scalars().first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista asignado no encontrado.")

    if tarea.aviso_origen_id:
        aviso_existente_result = await db.execute(select(models.Aviso).filter(models.Aviso.id == tarea.aviso_origen_id))
        if not aviso_existente_result.scalars().first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aviso de origen no encontrado.")

    # Asegurarse de que las fechas en la tarea generada sean timezone-naive
    tarea_data = tarea.model_dump()
    if tarea_data.get("fecha_vencimiento") is not None:
        tarea_data["fecha_vencimiento"] = tarea_data["fecha_vencimiento"].replace(tzinfo=None)

    db_tarea = models.TareaGeneradaPorAviso(**tarea_data)
    db.add(db_tarea)
    try:
        await db.commit()
        await db.refresh(db_tarea) # Refresh para obtener el ID generado y otros valores por defecto

        # Capturar el ID y el progreso como escalares después del primer commit y refresh
        new_tarea_id = db_tarea.id
        new_tarea_progreso = db_tarea.progreso

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al crear tarea generada por aviso: {e}"
        )
    
    # Registrar el estado inicial de la tarea generada
    historial_entry = models.HistorialEstadoTarea(
        old_progreso=None, # El primer estado no tiene un estado anterior
        new_progreso=new_tarea_progreso, # Usar la variable escalar capturada
        changed_by_analista_id=current_analista_id, # Usar la variable local
        tarea_generada_id=new_tarea_id # Usar la variable local
    )
    db.add(historial_entry)
    try:
        await db.commit() # Este commit podría expirar db_tarea nuevamente
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al registrar el historial de la tarea generada: {e}"
        )

    # Cargar relaciones para la respuesta
    result = await db.execute(
        select(models.TareaGeneradaPorAviso)
        .filter(models.TareaGeneradaPorAviso.id == new_tarea_id) # Usar la variable escalar capturada
        .options(
            selectinload(models.TareaGeneradaPorAviso.analista_asignado),
            selectinload(models.TareaGeneradaPorAviso.aviso_origen),
            selectinload(models.TareaGeneradaPorAviso.historial_estados) # Cargar historial para la respuesta
        )
    )
    tarea_to_return = result.scalars().first()
    if not tarea_to_return:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar la tarea generada después de la creación.")
    return tarea_to_return


@app.get("/tareas_generadas_por_avisos/", response_model=List[TareaGeneradaPorAviso], summary="Obtener todas las Tareas Generadas por Avisos (Protegido)")
async def get_all_tareas_generadas_por_avisos(
    db: AsyncSession = Depends(get_db),
    analista_id: Optional[int] = None,
    aviso_origen_id: Optional[int] = None,
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene todas las tareas generadas por avisos, con filtros opcionales.
    Requiere autenticación.
    Un analista normal solo ve las tareas asignadas a él.
    Supervisores y Responsables pueden ver todas las tareas.
    """
    query = select(models.TareaGeneradaPorAviso).options(
        selectinload(models.TareaGeneradaPorAviso.analista_asignado),
        selectinload(models.TareaGeneradaPorAviso.aviso_origen),
        selectinload(models.TareaGeneradaPorAviso.historial_estados)
    )

    if current_analista.role == UserRole.ANALISTA.value:
        query = query.filter(models.TareaGeneradaPorAviso.analista_asignado_id == current_analista.id)
    else:
        if analista_id:
            query = query.filter(models.TareaGeneradaPorAviso.analista_asignado_id == analista_id)
        if aviso_origen_id:
            query = query.filter(models.TareaGeneradaPorAviso.aviso_origen_id == aviso_origen_id)
    
    tareas = await db.execute(query)
    return tareas.scalars().unique().all()


@app.get("/tareas_generadas_por_avisos/{tarea_id}", response_model=TareaGeneradaPorAviso, summary="Obtener Tarea Generada por Aviso por ID (Protegido)")
async def get_tarea_generada_por_aviso_by_id(
    tarea_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene una tarea generada por aviso específica por su ID.
    Requiere autenticación.
    Un analista normal solo ve las tareas asignadas a él.
    """
    result = await db.execute(
        select(models.TareaGeneradaPorAviso)
        .filter(models.TareaGeneradaPorAviso.id == tarea_id)
        .options(
            selectinload(models.TareaGeneradaPorAviso.analista_asignado),
            selectinload(models.TareaGeneradaPorAviso.aviso_origen),
            selectinload(models.TareaGeneradaPorAviso.historial_estados).selectinload(models.HistorialEstadoTarea.changed_by_analista) # Cargar historial con el analista que hizo el cambio
        )
    )
    tarea = result.scalars().first()
    if not tarea:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea generada por aviso no encontrada.")
    
    if current_analista.role == UserRole.ANALISTA.value and tarea.analista_asignado_id != current_analista.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver esta tarea.")

    return tarea


@app.put("/tareas_generadas_por_avisos/{tarea_id}", response_model=TareaGeneradaPorAviso, summary="Actualizar una Tarea Generada por Aviso (Protegido)")
async def update_tarea_generada_por_aviso(
    tarea_id: int,
    tarea_update: TareaGeneradaPorAvisoUpdate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    current_analista_id = current_analista.id

    db_tarea_result = await db.execute(
        select(models.TareaGeneradaPorAviso)
        .filter(models.TareaGeneradaPorAviso.id == tarea_id)
        .options(
            selectinload(models.TareaGeneradaPorAviso.analista_asignado),
            selectinload(models.TareaGeneradaPorAviso.aviso_origen),
            selectinload(models.TareaGeneradaPorAviso.historial_estados)
        )
    )
    tarea_existente = db_tarea_result.scalars().first()

    if tarea_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea generada por aviso no encontrada.")

    update_data = tarea_update.model_dump(exclude_unset=True)
    old_progreso = tarea_existente.progreso

    # --- 👇 AQUÍ ESTÁ LA CORRECCIÓN, IGUAL QUE EN LA OTRA FUNCIÓN ---
    # Comparamos los valores de texto (.value) para ser 100% seguros
    if current_analista.role.value == UserRole.ANALISTA.value:
        if tarea_existente.analista_asignado_id != current_analista.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo puedes actualizar tus propias tareas generadas.")
        
        # Un analista solo puede actualizar el progreso
        if "progreso" in update_data:
            tarea_existente.progreso = update_data["progreso"]
        else:
            # Si el payload no incluye 'progreso', no se permite la actualización para un Analista.
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Los analistas solo pueden actualizar el progreso de sus tareas generadas.")

    elif current_analista.role.value in [UserRole.SUPERVISOR.value, UserRole.RESPONSABLE.value]:
        for key, value in update_data.items():
            if key == "fecha_vencimiento" and value is not None:
                setattr(tarea_existente, key, value.replace(tzinfo=None))
            else:
                setattr(tarea_existente, key, value)
    # --- 👆 FIN DE LA CORRECCIÓN ---
    
    else:
        # Este else se activaba incorrectamente antes de la corrección
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para actualizar tareas generadas con tu rol actual.")

    if "progreso" in update_data and tarea_existente.progreso != old_progreso:
        historial_entry = models.HistorialEstadoTarea(
            old_progreso=old_progreso,
            new_progreso=tarea_existente.progreso,
            changed_by_analista_id=current_analista_id,
            tarea_generada_id=tarea_existente.id
        )
        db.add(historial_entry)

        if tarea_existente.progreso in [ProgresoTarea.COMPLETADA, ProgresoTarea.CANCELADA]:
            tarea_existente.fecha_finalizacion = datetime.utcnow().replace(tzinfo=None)
        elif old_progreso in [ProgresoTarea.COMPLETADA, ProgresoTarea.CANCELADA] and \
             tarea_existente.progreso in [ProgresoTarea.PENDIENTE, ProgresoTarea.EN_PROGRESO]:
            tarea_existente.fecha_finalizacion = None

    try:
        await db.commit()
        await db.refresh(tarea_existente)
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al actualizar tarea generada: {e}"
        )
    
    result = await db.execute(
        select(models.TareaGeneradaPorAviso)
        .filter(models.TareaGeneradaPorAviso.id == tarea_existente.id)
        .options(
            selectinload(models.TareaGeneradaPorAviso.analista_asignado),
            selectinload(models.TareaGeneradaPorAviso.aviso_origen),
            selectinload(models.TareaGeneradaPorAviso.historial_estados).selectinload(models.HistorialEstadoTarea.changed_by_analista)
        )
    )
    return result.scalars().first()

@app.delete("/tareas_generadas_por_avisos/{tarea_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar una Tarea Generada por Aviso (Protegido por Supervisor)")
async def delete_tarea_generada_por_aviso(
    tarea_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR]))
):
    """
    Elimina una tarea generada por aviso existente.
    Requiere autenticación y rol de SUPERVISOR.
    """
    db_tarea_result = await db.execute(select(models.TareaGeneradaPorAviso).where(models.TareaGeneradaPorAviso.id == tarea_id))
    tarea_a_eliminar = db_tarea_result.scalars().first()

    if tarea_a_eliminar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea generada por aviso no encontrada.")

    try:
        await db.delete(tarea_a_eliminar)
        # Opcional: Eliminar los historial_estados relacionados si no se hace en cascada a nivel de DB
        # await db.execute(delete(models.HistorialEstadoTarea).where(models.HistorialEstadoTarea.tarea_generada_id == tarea_id))
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al eliminar tarea generada: {e}"
        )
    return

# NUEVO ENDPOINT: Obtener historial de estados para una tarea específica
@app.get("/tareas/{tarea_id}/historial_estados", response_model=List[HistorialEstadoTarea], summary="Obtener Historial de Estados de una Tarea (Protegido)")
async def get_tarea_historial_estados(
    tarea_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene el historial de cambios de estado para una tarea de campaña específica.
    Requiere autenticación. Un analista normal solo ve el historial de sus propias tareas.
    """
    tarea_existente_result = await db.execute(select(models.Tarea).filter(models.Tarea.id == tarea_id))
    tarea_existente = tarea_existente_result.scalars().first()
    if not tarea_existente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada.")

    # Permiso para ver el historial:
    # Supervisor/Responsable: pueden ver cualquier historial
    # Analista: solo si la tarea le pertenece
    if current_analista.role == UserRole.ANALISTA.value and tarea_existente.analista_id != current_analista.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver el historial de esta tarea.")

    result = await db.execute(
        select(models.HistorialEstadoTarea)
        .filter(models.HistorialEstadoTarea.tarea_campana_id == tarea_id)
        .options(selectinload(models.HistorialEstadoTarea.changed_by_analista)) # Cargar el analista que hizo el cambio
        .order_by(models.HistorialEstadoTarea.timestamp) # Ordenar por fecha para ver la secuencia
    )
    historial = result.scalars().unique().all()
    return historial

# NUEVO ENDPOINT: Obtener historial de estados para una tarea generada por aviso específica
@app.get("/tareas_generadas_por_avisos/{tarea_id}/historial_estados", response_model=List[HistorialEstadoTarea], summary="Obtener Historial de Estados de una Tarea Generada por Aviso (Protegido)")
async def get_tarea_generada_historial_estados(
    tarea_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene el historial de cambios de estado para una tarea generada por aviso específica.
    Requiere autenticación. Un analista normal solo ve el historial de sus propias tareas.
    """
    tarea_existente_result = await db.execute(select(models.TareaGeneradaPorAviso).filter(models.TareaGeneradaPorAviso.id == tarea_id))
    tarea_existente = tarea_existente_result.scalars().first()
    if not tarea_existente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea generada por aviso no encontrada.")

    # Permiso para ver el historial:
    # Supervisor/Responsable: pueden ver cualquier historial
    # Analista: solo si la tarea le pertenece
    if current_analista.role == UserRole.ANALISTA.value and tarea_existente.analista_asignado_id != current_analista.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver el historial de esta tarea.")

    result = await db.execute(
        select(models.HistorialEstadoTarea)
        .filter(models.HistorialEstadoTarea.tarea_generada_id == tarea_id)
        .options(selectinload(models.HistorialEstadoTarea.changed_by_analista)) # Cargar el analista que hizo el cambio
        .order_by(models.HistorialEstadoTarea.timestamp) # Ordenar por fecha para ver la secuencia
    )
    historial = result.scalars().unique().all()
    return historial
