# /backend/main.py (Versión Final y Limpia)

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from datetime import timedelta
from typing import Optional, List

# --- IMPORTS ESENCIALES PARA MAIN.PY ---
from database import get_db
from sql_app import models
from enums import UserRole
from schemas.models import Token, TokenData, Analista, AnalistaCreate, AnalistaMe
from security import verify_password, get_password_hash, create_access_token, decode_access_token, ACCESS_TOKEN_EXPIRE_MINUTES

# --- IMPORTAMOS NUESTROS ROUTERS ---
from routers import gtr_router, hhee_router

# --- CREACIÓN Y CONFIGURACIÓN DE LA APP ---
app = FastAPI(
    title="Portal Unificado API",
    description="API para los portales GTR y HHEE."
)

origins = [
    "http://localhost", "http://localhost:3000",
    "http://127.0.0.1:5173", "http://localhost:5173",
    "http://127.0.0.1:8000", "https://portal-gtr.onrender.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# --- INCLUSIÓN DE ROUTERS ---
app.include_router(gtr_router.router)
app.include_router(hhee_router.router)


# --- DEPENDENCIAS Y ENDPOINTS GLOBALES (AUTENTICACIÓN) ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@app.on_event("startup")
async def startup_event():
    print("Evento de inicio de la aplicación ejecutado (creación de tablas desactivada).")

async def get_analista_by_email(email: str, db: AsyncSession) -> Optional[models.Analista]:
    result = await db.execute(select(models.Analista).filter(models.Analista.email == email))
    return result.scalars().first()

async def get_current_analista(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> models.Analista:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        if payload is None: raise credentials_exception
        email: str = payload.get("sub")
        if email is None: raise credentials_exception
        token_data = TokenData(email=email)
    except Exception:
        raise credentials_exception
    
    # NOTA: Simplifiqué la carga aquí. Las relaciones detalladas se cargarán en los endpoints que las necesiten.
    result = await db.execute(
        select(models.Analista).filter(models.Analista.email == token_data.email)
        .options(selectinload(models.Analista.campanas_asignadas))
    )
    analista = result.scalars().first()
    if analista is None:
        raise credentials_exception
    return analista

def require_role(required_roles: List[UserRole]):
    def role_checker(current_analista: models.Analista = Depends(get_current_analista)):
        if current_analista.role.value not in [r.value for r in required_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para realizar esta acción."
            )
        return current_analista
    return role_checker

@app.post("/register/", response_model=Analista, status_code=status.HTTP_201_CREATED, summary="Registrar un nuevo Analista")
async def register_analista(analista: AnalistaCreate, db: AsyncSession = Depends(get_db)):
    # (Tu endpoint de registro completo va aquí)
    # (El código que ya tenías para esta función es correcto)
    existing_analista_by_email = await get_analista_by_email(analista.email, db)
    if existing_analista_by_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El email ya está registrado.")
    result_bms = await db.execute(select(models.Analista).filter(models.Analista.bms_id == analista.bms_id))
    if result_bms.scalars().first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El BMS ID ya existe.")
    hashed_password = get_password_hash(analista.password)
    db_analista = models.Analista(
        nombre=analista.nombre, apellido=analista.apellido, email=analista.email,
        bms_id=analista.bms_id, role=analista.role.value, hashed_password=hashed_password
    )
    db.add(db_analista)
    await db.commit()
    await db.refresh(db_analista)
    return db_analista

@app.post("/token", response_model=Token, summary="Obtener Token de Acceso (Login)")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    # (Tu endpoint de login completo va aquí)
    # (El código que ya tenías para esta función es correcto)
    analista = await get_analista_by_email(form_data.username, db)
    if not analista or not verify_password(form_data.password, analista.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email o contraseña incorrectos", headers={"WWW-Authenticate": "Bearer"})
    if not analista.esta_activo:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Usuario inactivo. Contacte al administrador.")
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": analista.email, "role": analista.role.value}, expires_delta=access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me/", response_model=AnalistaMe, summary="Obtener información del Analista actual")
async def read_users_me(current_analista: models.Analista = Depends(get_current_analista)):
    return current_analista