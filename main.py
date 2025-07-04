from fastapi import FastAPI, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional # Asegúrate de importar Optional

# Importamos los modelos de Pydantic (para la API)
from models import (
    AnalistaBase, Analista,
    CampanaBase, Campana,
    TareaBase, Tarea, # <-- NUEVAS IMPORTACIONES
    ChecklistItemBase, ChecklistItem,
    ComentarioCampanaBase, ComentarioCampana,
    AvisoBase, Aviso,
    ProgresoTarea # Importa el Enum
)

# Importamos los modelos de SQLAlchemy (para la DB)
from sql_app import models as sql_models

# Importamos la función para obtener la sesión de la DB
from database import get_db, engine


app = FastAPI()

@app.on_event("startup")
async def startup_event():
    async with engine.begin() as conn:
        await conn.run_sync(sql_models.Base.metadata.create_all)
    print("Base de datos y tablas verificadas/creadas al iniciar la aplicación.")



# --- Endpoints para Analistas ---

@app.post("/analistas/", response_model=Analista, status_code=status.HTTP_201_CREATED)
async def crear_analista(analista: AnalistaBase, db: AsyncSession = Depends(get_db)):
    """
    Crea un nuevo analista en el sistema y lo guarda en la base de datos.
    """
    # 1. Verificar si el bms_id ya existe en la DB
    # CAMBIO AQUÍ: Usamos select() y db.execute()
    result = await db.execute(select(sql_models.Analista).filter(sql_models.Analista.bms_id == analista.bms_id))
    existing_analista = result.scalars().first() # scalars() para obtener los objetos del modelo

    if existing_analista:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El BMS ID ya existe.")

    # 2. Crear una instancia del modelo de SQLAlchemy
    db_analista = sql_models.Analista(
        nombre=analista.nombre,
        apellido=analista.apellido,
        email=analista.email,
        bms_id=analista.bms_id
    )

    # 3. Añadir a la sesión y hacer commit
    db.add(db_analista)
    await db.commit()
    await db.refresh(db_analista)

    # 4. Devolver el modelo de Pydantic desde el objeto de DB
    return Analista.model_validate(db_analista)


@app.get("/analistas/", response_model=List[Analista])
async def obtener_analistas(db: AsyncSession = Depends(get_db)):
    """
    Obtiene la lista de todos los analistas desde la base de datos.
    """
    # CAMBIO AQUÍ: Usamos select() y db.execute()
    result = await db.execute(select(sql_models.Analista))
    analistas = result.scalars().all() # scalars() para obtener los objetos del modelo

    return [Analista.model_validate(ana) for ana in analistas]


@app.get("/analistas/{analista_id}", response_model=Analista)
async def obtener_analista_por_id(analista_id: int, db: AsyncSession = Depends(get_db)):
    """
    Obtiene un analista específico por su ID interno desde la base de datos.
    """
    # CAMBIO AQUÍ: Usamos select() y db.execute()
    result = await db.execute(select(sql_models.Analista).filter(sql_models.Analista.id == analista_id))
    analista = result.scalars().first()

    if not analista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado.")
    return Analista.model_validate(analista)


@app.get("/analistas/bms/{bms_id}", response_model=Analista)
async def obtener_analista_por_bms_id(bms_id: int, db: AsyncSession = Depends(get_db)):
    """
    Obtiene un analista específico por su BMS ID (legajo) desde la base de datos.
    """
    # CAMBIO AQUÍ: Usamos select() y db.execute()
    result = await db.execute(select(sql_models.Analista).filter(sql_models.Analista.bms_id == bms_id))
    analista = result.scalars().first()

    if not analista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado por BMS ID.")
    return Analista.model_validate(analista)


# --- Endpoints para Campañas ---

@app.post("/campanas/", response_model=Campana, status_code=status.HTTP_201_CREATED)
async def crear_campana(campana: CampanaBase, db: AsyncSession = Depends(get_db)):
    """
    Crea una nueva campaña en el sistema y la guarda en la base de datos.
    """
    db_campana = sql_models.Campana(
        nombre=campana.nombre,
        descripcion=campana.descripcion,
        fecha_inicio=campana.fecha_inicio,
        fecha_fin=campana.fecha_fin
    )
    db.add(db_campana)
    await db.commit()
    await db.refresh(db_campana)
    return Campana.model_validate(db_campana)


@app.get("/campanas/", response_model=List[Campana])
async def obtener_campanas(db: AsyncSession = Depends(get_db)):
    """
    Obtiene la lista de todas las campañas desde la base de datos.
    """
    # CAMBIO AQUÍ: Usamos select() y db.execute()
    result = await db.execute(select(sql_models.Campana))
    campanas = result.scalars().all()

    return [Campana.model_validate(cam) for cam in campanas]


@app.get("/campanas/{campana_id}", response_model=Campana)
async def obtener_campana_por_id(campana_id: int, db: AsyncSession = Depends(get_db)):
    """
    Obtiene una campaña específica por su ID desde la base de datos.
    """
    # CAMBIO AQUÍ: Usamos select() y db.execute()
    result = await db.execute(select(sql_models.Campana).filter(sql_models.Campana.id == campana_id))
    campana = result.scalars().first()

    if not campana:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada.")
    return Campana.model_validate(campana)

# --- Endpoints para Tareas ---

@app.post("/tareas/", response_model=Tarea, status_code=status.HTTP_201_CREATED)
async def crear_tarea(tarea: TareaBase, db: AsyncSession = Depends(get_db)):
    """
    Crea una nueva tarea en el sistema y la guarda en la base de datos.
    Verifica que el analista y la campaña existan.
    """
    # 1. Verificar que el analista_id exista
    result_analista = await db.execute(select(sql_models.Analista).filter(sql_models.Analista.id == tarea.analista_id))
    analista_existente = result_analista.scalars().first()
    if not analista_existente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Analista con ID {tarea.analista_id} no encontrado.")

    # 2. Verificar que el campana_id exista
    result_campana = await db.execute(select(sql_models.Campana).filter(sql_models.Campana.id == tarea.campana_id))
    campana_existente = result_campana.scalars().first()
    if not campana_existente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Campaña con ID {tarea.campana_id} no encontrada.")

    # 3. Crear una instancia del modelo de SQLAlchemy
    db_tarea = sql_models.Tarea(
        titulo=tarea.titulo,
        descripcion=tarea.descripcion,
        fecha_vencimiento=tarea.fecha_vencimiento,
        progreso=tarea.progreso,
        analista_id=tarea.analista_id,
        campana_id=tarea.campana_id
    )

    # 4. Añadir a la sesión y hacer commit
    db.add(db_tarea)
    await db.commit()
    await db.refresh(db_tarea) # Recarga el objeto para obtener el ID y la fecha de creación

    # 5. Devolver el modelo de Pydantic desde el objeto de DB
    return Tarea.model_validate(db_tarea)


@app.get("/tareas/", response_model=List[Tarea])
async def obtener_tareas(db: AsyncSession = Depends(get_db)):
    """
    Obtiene la lista de todas las tareas desde la base de datos.
    """
    result = await db.execute(select(sql_models.Tarea))
    tareas = result.scalars().all()
    return [Tarea.model_validate(tar) for tar in tareas]


@app.get("/tareas/{tarea_id}", response_model=Tarea)
async def obtener_tarea_por_id(tarea_id: int, db: AsyncSession = Depends(get_db)):
    """
    Obtiene una tarea específica por su ID desde la base de datos.
    """
    result = await db.execute(select(sql_models.Tarea).filter(sql_models.Tarea.id == tarea_id))
    tarea = result.scalars().first()
    if not tarea:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada.")
    return Tarea.model_validate(tarea)
