# main.py

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware # para CORS
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional, List
# from datetime import datetime, date # No es necesario importar datetime/date aquí si solo usas Pydantic

# Importamos los modelos de SQLAlchemy (para la DB)
from sql_app import models # Usaremos 'models' para referirnos a sql_app/models.py

# Importa los modelos Pydantic (tus esquemas para la API)
from schemas.models import (
    AnalistaBase, Analista,
    CampanaBase, Campana,
    TareaBase, Tarea,
    ChecklistItemBase, ChecklistItem,
    ComentarioCampanaBase, ComentarioCampana,
    AvisoBase, Aviso,
    AcuseReciboAvisoBase, AcuseReciboAviso, # Asegúrate de que estén importados
    ProgresoTarea # Importa el Enum
)

# Importamos la función para obtener la sesión de la DB y el engine
from database import get_db, engine

app = FastAPI(
    title="Portal GTR API",
    description="API para la gestión de analistas, campañas, tareas, avisos y acuses de recibo."
)

#----para CORS----#
origins = [
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)




@app.on_event("startup")
async def startup_event():
    async with engine.begin() as conn:
        # Asegúrate de que Base.metadata.create_all se refiere a la Base correcta de sql_app.models
        await conn.run_sync(models.Base.metadata.create_all)
    print("Base de datos y tablas verificadas/creadas al iniciar la aplicación.")


# --- Endpoints para Analistas ---

@app.post("/analistas/", response_model=Analista, status_code=status.HTTP_201_CREATED, summary="Crear un nuevo Analista")
async def crear_analista(analista: AnalistaBase, db: AsyncSession = Depends(get_db)):
    """
    Crea un nuevo analista en el sistema y lo guarda en la base de datos.
    """
    result = await db.execute(select(models.Analista).filter(models.Analista.bms_id == analista.bms_id))
    existing_analista = result.scalars().first()
    if existing_analista:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El BMS ID ya existe.")

    db_analista = models.Analista(**analista.model_dump()) # Uso más directo de model_dump()
    db.add(db_analista)
    await db.commit()
    await db.refresh(db_analista)
    return db_analista


@app.get("/analistas/", response_model=List[Analista], summary="Obtener todos los Analistas")
async def obtener_analistas(db: AsyncSession = Depends(get_db)):
    """
    Obtiene la lista de todos los analistas desde la base de datos.
    """
    result = await db.execute(select(models.Analista))
    analistas = result.scalars().all()
    # Pydantic v2: model_validate se usa en lugar de from_orm
    return [Analista.model_validate(ana) for ana in analistas]


@app.get("/analistas/{analista_id}", response_model=Analista, summary="Obtener Analista por ID")
async def obtener_analista_por_id(analista_id: int, db: AsyncSession = Depends(get_db)):
    """
    Obtiene un analista específico por su ID interno desde la base de datos.
    """
    result = await db.execute(select(models.Analista).filter(models.Analista.id == analista_id))
    analista = result.scalars().first()
    if not analista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado.")
    return analista # SQLAlchemy objects can often be returned directly if schema Config.from_attributes = True


@app.get("/analistas/bms/{bms_id}", response_model=Analista, summary="Obtener Analista por BMS ID")
async def obtener_analista_por_bms_id(bms_id: int, db: AsyncSession = Depends(get_db)):
    """
    Obtiene un analista específico por su BMS ID (legajo) desde la base de datos.
    """
    result = await db.execute(select(models.Analista).filter(models.Analista.bms_id == bms_id))
    analista = result.scalars().first()
    if not analista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado por BMS ID.")
    return analista


# --- Endpoints para Campañas ---

@app.post("/campanas/", response_model=Campana, status_code=status.HTTP_201_CREATED, summary="Crear una nueva Campaña")
async def crear_campana(campana: CampanaBase, db: AsyncSession = Depends(get_db)):
    """
    Crea una nueva campaña en el sistema y la guarda en la base de datos.
    """
    db_campana = models.Campana(**campana.model_dump())
    db.add(db_campana)
    await db.commit()
    await db.refresh(db_campana)
    return db_campana


@app.get("/campanas/", response_model=List[Campana], summary="Obtener todas las Campañas")
async def obtener_campanas(db: AsyncSession = Depends(get_db)):
    """
    Obtiene la lista de todas las campañas desde la base de datos.
    """
    result = await db.execute(select(models.Campana))
    campanas = result.scalars().all()
    return campanas


@app.get("/campanas/{campana_id}", response_model=Campana, summary="Obtener Campaña por ID")
async def obtener_campana_por_id(campana_id: int, db: AsyncSession = Depends(get_db)):
    """
    Obtiene una campaña específica por su ID desde la base de datos.
    """
    result = await db.execute(select(models.Campana).filter(models.Campana.id == campana_id))
    campana = result.scalars().first()
    if not campana:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada.")
    return campana

@app.put("/campanas/{campana_id}", response_model=Campana, summary="Actualizar una Campaña existente")
async def actualizar_campana(campana_id: int, campana: CampanaBase, db: AsyncSession = Depends(get_db)):
    """
    Actualiza la información de una campaña existente.

    - **campana_id**: El ID de la campaña a actualizar.
    - **campana**: Objeto CampanaBase con los datos actualizados (nombre, descripción, fecha_inicio, fecha_fin).
    """
    db_campana = await db.execute(select(models.Campana).where(models.Campana.id == campana_id))
    campana_existente = db_campana.scalar_one_or_none()

    if campana_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada")

    campana_existente.nombre = campana.nombre
    campana_existente.descripcion = campana.descripcion
    campana_existente.fecha_inicio = campana.fecha_inicio
    campana_existente.fecha_fin = campana.fecha_fin

    await db.commit()
    await db.refresh(campana_existente)
    return campana_existente


@app.delete("/campanas/{campana_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar una Campaña")
async def eliminar_campana(campana_id: int, db: AsyncSession = Depends(get_db)):
    """
    Elimina una campaña existente.

    - **campana_id**: El ID de la campaña a eliminar.
    """
    db_campana = await db.execute(select(models.Campana).where(models.Campana.id == campana_id))
    campana_a_eliminar = db_campana.scalar_one_or_none()

    if campana_a_eliminar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada")

    await db.delete(campana_a_eliminar)
    await db.commit()
    return # Retorna un 204 No Content


# --- Endpoints para Tareas ---

@app.post("/tareas/", response_model=Tarea, status_code=status.HTTP_201_CREATED, summary="Crear una nueva Tarea")
async def crear_tarea(tarea: TareaBase, db: AsyncSession = Depends(get_db)):
    """
    Crea una nueva tarea en el sistema y la guarda en la base de datos.
    Verifica que el analista y la campaña existan.
    """
    result_analista = await db.execute(select(models.Analista).filter(models.Analista.id == tarea.analista_id))
    analista_existente = result_analista.scalars().first()
    if not analista_existente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Analista con ID {tarea.analista_id} no encontrado.")

    result_campana = await db.execute(select(models.Campana).filter(models.Campana.id == tarea.campana_id))
    campana_existente = result_campana.scalars().first()
    if not campana_existente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Campaña con ID {tarea.campana_id} no encontrada.")

    db_tarea = models.Tarea(**tarea.model_dump())
    db.add(db_tarea)
    await db.commit()
    await db.refresh(db_tarea)
    return db_tarea


@app.get("/tareas/", response_model=List[Tarea], summary="Obtener Tareas (con filtros opcionales)")
async def obtener_tareas(
    db: AsyncSession = Depends(get_db),
    analista_id: Optional[int] = None,
    campana_id: Optional[int] = None
):
    """
    Obtiene todas las tareas, o filtra por analista y/o campaña.

    - **analista_id**: ID del analista para filtrar tareas. (Opcional)
    - **campana_id**: ID de la campaña para filtrar tareas. (Opcional)
    """
    query = select(models.Tarea)
    if analista_id:
        query = query.where(models.Tarea.analista_id == analista_id)
    if campana_id:
        query = query.where(models.Tarea.campana_id == campana_id)

    tareas = await db.execute(query)
    return tareas.scalars().all()


@app.get("/tareas/{tarea_id}", response_model=Tarea, summary="Obtener Tarea por ID")
async def obtener_tarea_por_id(tarea_id: int, db: AsyncSession = Depends(get_db)):
    """
    Obtiene una tarea específica por su ID desde la base de datos.
    """
    result = await db.execute(select(models.Tarea).filter(models.Tarea.id == tarea_id))
    tarea = result.scalars().first()
    if not tarea:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada.")
    return tarea


@app.put("/tareas/{tarea_id}", response_model=Tarea, summary="Actualizar una Tarea existente")
async def actualizar_tarea(
    tarea_id: int,
    tarea_update: TareaBase,
    db: AsyncSession = Depends(get_db)
):
    """
    Actualiza la información de una tarea existente.

    - **tarea_id**: El ID de la tarea a actualizar.
    - **tarea_update**: Objeto TareaBase con los datos actualizados.
    """
    db_tarea = await db.execute(select(models.Tarea).where(models.Tarea.id == tarea_id))
    tarea_existente = db_tarea.scalar_one_or_none()

    if tarea_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada")

    tarea_existente.titulo = tarea_update.titulo
    tarea_existente.descripcion = tarea_update.descripcion
    tarea_existente.fecha_vencimiento = tarea_update.fecha_vencimiento
    tarea_existente.progreso = tarea_update.progreso

    await db.commit()
    await db.refresh(tarea_existente)
    return tarea_existente


@app.delete("/tareas/{tarea_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar una Tarea")
async def eliminar_tarea(tarea_id: int, db: AsyncSession = Depends(get_db)):
    """
    Elimina una tarea existente.

    - **tarea_id**: El ID de la tarea a eliminar.
    """
    db_tarea = await db.execute(select(models.Tarea).where(models.Tarea.id == tarea_id))
    tarea_a_eliminar = db_tarea.scalar_one_or_none()

    if tarea_a_eliminar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada")

    await db.delete(tarea_a_eliminar)
    await db.commit()
    return


# --- Endpoints para checklist tareas ---

@app.post("/checklist_items/", response_model=ChecklistItem, status_code=status.HTTP_201_CREATED, summary="Crear un nuevo ChecklistItem")
async def crear_checklist_item(
    item: ChecklistItemBase,
    db: AsyncSession = Depends(get_db)
):
    """
    Crea un nuevo elemento de checklist asociado a una tarea.

    - **item**: Objeto ChecklistItemBase con la descripción, estado de completado y el ID de la tarea a la que pertenece.
    """
    tarea_existente = await db.execute(select(models.Tarea).where(models.Tarea.id == item.tarea_id))
    if tarea_existente.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada para asociar el ChecklistItem")

    db_item = models.ChecklistItem(**item.model_dump())
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return db_item


@app.get("/checklist_items/", response_model=List[ChecklistItem], summary="Obtener ChecklistItems (con filtro opcional por tarea)")
async def obtener_checklist_items(
    db: AsyncSession = Depends(get_db),
    tarea_id: Optional[int] = None
):
    """
    Obtiene todos los elementos de checklist, o filtra por ID de tarea.

    - **tarea_id**: ID de la tarea para filtrar los elementos de checklist. (Opcional)
    """
    query = select(models.ChecklistItem)
    if tarea_id:
        query = query.where(models.ChecklistItem.tarea_id == tarea_id)

    items = await db.execute(query)
    return items.scalars().all()

@app.put("/checklist_items/{item_id}", response_model=ChecklistItem, summary="Actualizar un ChecklistItem existente")
async def actualizar_checklist_item(
    item_id: int,
    item_update: ChecklistItemBase,
    db: AsyncSession = Depends(get_db)
):
    """
    Actualiza la información de un elemento de checklist existente.

    - **item_id**: El ID del elemento de checklist a actualizar.
    - **item_update**: Objeto ChecklistItemBase con los datos actualizados (descripción, completado, tarea_id).
    """
    db_item = await db.execute(select(models.ChecklistItem).where(models.ChecklistItem.id == item_id))
    item_existente = db_item.scalar_one_or_none()

    if item_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ChecklistItem no encontrado")

    if item_update.tarea_id != item_existente.tarea_id:
        nueva_tarea_existente = await db.execute(select(models.Tarea).where(models.Tarea.id == item_update.tarea_id))
        if nueva_tarea_existente.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nueva Tarea no encontrada para reasignar el ChecklistItem")
        item_existente.tarea_id = item_update.tarea_id

    item_existente.descripcion = item_update.descripcion
    item_existente.completado = item_update.completado

    await db.commit()
    await db.refresh(item_existente)
    return item_existente

@app.delete("/checklist_items/{item_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar un ChecklistItem")
async def eliminar_checklist_item(item_id: int, db: AsyncSession = Depends(get_db)):
    """
    Elimina un elemento de checklist existente.

    - **item_id**: El ID del elemento de checklist a eliminar.
    """
    db_item = await db.execute(select(models.ChecklistItem).where(models.ChecklistItem.id == item_id))
    item_a_eliminar = db_item.scalar_one_or_none()

    if item_a_eliminar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ChecklistItem no encontrado")

    await db.delete(item_a_eliminar)
    await db.commit()
    return


@app.post("/comentarios_campana/", response_model=ComentarioCampana, status_code=status.HTTP_201_CREATED, summary="Crear un nuevo Comentario de Campaña")
async def crear_comentario_campana(
    comentario: ComentarioCampanaBase,
    db: AsyncSession = Depends(get_db)
):
    """
    Crea un nuevo comentario asociado a una campaña y a un analista.

    - **comentario**: Objeto ComentarioCampanaBase con el contenido, y los IDs del analista y la campaña.
    """
    analista_existente = await db.execute(select(models.Analista).where(models.Analista.id == comentario.analista_id))
    if analista_existente.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado.")

    campana_existente = await db.execute(select(models.Campana).where(models.Campana.id == comentario.campana_id))
    if campana_existente.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada.")

    db_comentario = models.ComentarioCampana(**comentario.model_dump())
    db.add(db_comentario)
    await db.commit()
    await db.refresh(db_comentario)
    return db_comentario

@app.get("/comentarios_campana/", response_model=List[ComentarioCampana], summary="Obtener Comentarios de Campaña (con filtros opcionales)")
async def obtener_comentarios_campana(
    db: AsyncSession = Depends(get_db),
    campana_id: Optional[int] = None,
    analista_id: Optional[int] = None
):
    """
    Obtiene todos los comentarios de campaña, o filtra por ID de campaña y/o ID de analista.

    - **campana_id**: ID de la campaña para filtrar comentarios. (Opcional)
    - **analista_id**: ID del analista para filtrar comentarios. (Opcional)
    """
    query = select(models.ComentarioCampana)
    if campana_id:
        query = query.where(models.ComentarioCampana.campana_id == campana_id)
    if analista_id:
        query = query.where(models.ComentarioCampana.analista_id == analista_id)

    comentarios = await db.execute(query)
    return comentarios.scalars().all()

@app.delete("/comentarios_campana/{comentario_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar un Comentario de Campaña")
async def eliminar_comentario_campana(comentario_id: int, db: AsyncSession = Depends(get_db)):
    """
    Elimina un comentario de campaña existente.

    - **comentario_id**: El ID del comentario a eliminar.
    """
    db_comentario = await db.execute(select(models.ComentarioCampana).where(models.ComentarioCampana.id == comentario_id))
    comentario_a_eliminar = db_comentario.scalar_one_or_none()

    if comentario_a_eliminar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comentario de Campaña no encontrado.")

    await db.delete(comentario_a_eliminar)
    await db.commit()
    return


# --- Endpoints para Avisos ---

# ¡ADVERTENCIA! Tienes este endpoint POST /avisos/ duplicado en tu main.py
# Elimina una de las dos definiciones. Dejo la primera y elimino la segunda para el ejemplo.
@app.post("/avisos/", response_model=Aviso, status_code=status.HTTP_201_CREATED, summary="Crear un nuevo Aviso")
async def crear_aviso(
    aviso: AvisoBase,
    db: AsyncSession = Depends(get_db)
):
    """
    Crea un nuevo aviso.

    - **aviso**: Objeto AvisoBase con el título, contenido, fecha de vencimiento (opcional),
                  ID del creador (analista) y ID de la campaña (opcional).
    """
    creador_existente = await db.execute(select(models.Analista).where(models.Analista.id == aviso.creador_id))
    if creador_existente.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista creador no encontrado.")

    if aviso.campana_id:
        campana_existente = await db.execute(select(models.Campana).where(models.Campana.id == aviso.campana_id))
        if campana_existente.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña asociada no encontrada.")

    db_aviso = models.Aviso(**aviso.model_dump())
    db.add(db_aviso)
    await db.commit()
    await db.refresh(db_aviso)
    return db_aviso

@app.get("/avisos/", response_model=List[Aviso], summary="Obtener Avisos (con filtros opcionales)")
async def obtener_avisos(
    db: AsyncSession = Depends(get_db),
    creador_id: Optional[int] = None,
    campana_id: Optional[int] = None
):
    """
    Obtiene todos los avisos, o filtra por ID del creador (analista) y/o ID de campaña.

    - **creador_id**: ID del analista que creó el aviso para filtrar. (Opcional)
    - **campana_id**: ID de la campaña asociada al aviso para filtrar. (Opcional)
    """
    query = select(models.Aviso)
    if creador_id:
        query = query.where(models.Aviso.creador_id == creador_id)
    if campana_id:
        query = query.where(models.Aviso.campana_id == campana_id)

    avisos = await db.execute(query)
    return avisos.scalars().all()

@app.put("/avisos/{aviso_id}", response_model=Aviso, summary="Actualizar un Aviso existente")
async def actualizar_aviso(
    aviso_id: int,
    aviso_update: AvisoBase,
    db: AsyncSession = Depends(get_db)
):
    """
    Actualiza la información de un aviso existente.

    - **aviso_id**: El ID del aviso a actualizar.
    - **aviso_update**: Objeto AvisoBase con los datos actualizados.
    """
    db_aviso = await db.execute(select(models.Aviso).where(models.Aviso.id == aviso_id))
    aviso_existente = db_aviso.scalar_one_or_none()

    if aviso_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aviso no encontrado.")

    if aviso_update.creador_id != aviso_existente.creador_id:
        nuevo_creador_existente = await db.execute(select(models.Analista).where(models.Analista.id == aviso_update.creador_id))
        if nuevo_creador_existente.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nuevo Analista creador no encontrado para reasignar el Aviso.")
        aviso_existente.creador_id = aviso_update.creador_id

    if aviso_update.campana_id != aviso_existente.campana_id:
        if aviso_update.campana_id:
            nueva_campana_existente = await db.execute(select(models.Campana).where(models.Campana.id == aviso_update.campana_id))
            if nueva_campana_existente.scalar_one_or_none() is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nueva Campaña no encontrada para reasignar el Aviso.")
        aviso_existente.campana_id = aviso_update.campana_id

    aviso_existente.titulo = aviso_update.titulo
    aviso_existente.contenido = aviso_update.contenido
    aviso_existente.fecha_vencimiento = aviso_update.fecha_vencimiento

    await db.commit()
    await db.refresh(aviso_existente)
    return aviso_existente

@app.delete("/avisos/{aviso_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar un Aviso")
async def eliminar_aviso(aviso_id: int, db: AsyncSession = Depends(get_db)):
    """
    Elimina un aviso existente.

    - **aviso_id**: El ID del aviso a eliminar.
    """
    db_aviso = await db.execute(select(models.Aviso).where(models.Aviso.id == aviso_id))
    aviso_a_eliminar = db_aviso.scalar_one_or_none()

    if aviso_a_eliminar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aviso no encontrado.")

    await db.delete(aviso_a_eliminar)
    await db.commit()
    return


@app.post("/avisos/{aviso_id}/acuse_recibo", response_model=AcuseReciboAviso, status_code=status.HTTP_201_CREATED, summary="Registrar acuse de recibo para un Aviso")
async def registrar_acuse_recibo(
    aviso_id: int,
    analista_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Registra que un analista ha visto y acusado un aviso específico.

    - **aviso_id**: ID del aviso al que se le da acuse de recibo.
    - **analista_id**: ID del analista que da el acuse de recibo.
    """
    db_aviso = await db.execute(select(models.Aviso).where(models.Aviso.id == aviso_id))
    aviso_existente = db_aviso.scalar_one_or_none()
    if aviso_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aviso no encontrado.")

    db_analista = await db.execute(select(models.Analista).where(models.Analista.id == analista_id))
    analista_existente = db_analista.scalar_one_or_none()
    if analista_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado.")

    existing_acuse = await db.execute(
        select(models.AcuseReciboAviso)
        .where(models.AcuseReciboAviso.aviso_id == aviso_id)
        .where(models.AcuseReciboAviso.analista_id == analista_id)
    )
    if existing_acuse.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este analista ya ha acusado este aviso.")

    db_acuse = models.AcuseReciboAviso(aviso_id=aviso_id, analista_id=analista_id)
    db.add(db_acuse)
    await db.commit()
    await db.refresh(db_acuse)
    return db_acuse

@app.get("/avisos/{aviso_id}/acuses_recibo", response_model=List[AcuseReciboAviso], summary="Obtener acuses de recibo para un Aviso")
async def obtener_acuses_recibo_por_aviso(
    aviso_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene todos los acuses de recibo para un aviso específico.

    - **aviso_id**: ID del aviso.
    """
    db_aviso = await db.execute(select(models.Aviso).where(models.Aviso.id == aviso_id))
    if db_aviso.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aviso no encontrado.")

    acuses = await db.execute(select(models.AcuseReciboAviso).where(models.AcuseReciboAviso.aviso_id == aviso_id))
    return acuses.scalars().all()

@app.get("/analistas/{analista_id}/acuses_recibo_avisos", response_model=List[AcuseReciboAviso], summary="Obtener acuses de recibo dados por un Analista")
async def obtener_acuses_recibo_por_analista(
    analista_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene todos los acuses de recibo dados por un analista específico.

    - **analista_id**: ID del analista.
    """
    db_analista = await db.execute(select(models.Analista).where(models.Analista.id == analista_id))
    if db_analista.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado.")

    acuses = await db.execute(select(models.AcuseReciboAviso).where(models.AcuseReciboAviso.analista_id == analista_id))
    return acuses.scalars().all()