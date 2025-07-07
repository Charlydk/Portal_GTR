from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select # Asegúrate de que esta línea esté presente
from typing import Optional, List # Asegúrate de que estas líneas estén presente
from sql_app import models

# Importa los modelos Pydantic (tus esquemas para la API)
from schemas.models import (
    AnalistaBase, Analista,
    CampanaBase, Campana,
    TareaBase, Tarea,
    # Asegúrate de incluir todos los modelos Pydantic que uses, como ProgresoTarea si lo usas directamente
    # ProgresoTarea,
    ChecklistItemBase, ChecklistItem,
    ComentarioCampanaBase, ComentarioCampana,
    AvisoBase, Aviso
)

from database import get_db

app = FastAPI()

# Importamos los modelos de Pydantic (para la API)
from schemas.models import (
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

    # Actualizar los campos. Pydantic ya validó los datos entrantes.
    campana_existente.nombre = campana.nombre
    campana_existente.descripcion = campana.descripcion
    campana_existente.fecha_inicio = campana.fecha_inicio
    campana_existente.fecha_fin = campana.fecha_fin

    await db.commit()
    await db.refresh(campana_existente) # Refresca el objeto para obtener los datos actualizados de la DB
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

    # Si hay relaciones que impiden el borrado (ej. tareas asociadas),
    # podrías manejarlo aquí o dejar que la base de datos lance un error (FOREIGN KEY constraint).
    # Para este ejemplo, asumimos que no hay restricciones que impidan el borrado directo
    # o que la base de datos está configurada con CASCADE DELETE si es el caso.
    # En un sistema real, querrías una lógica más robusta para evitar borrar algo con dependencias.

    await db.delete(campana_a_eliminar)
    await db.commit()
    # No hay necesidad de refresh si el objeto se va a eliminar.
    return {"message": "Campaña eliminada exitosamente"} # Retorna un mensaje si es necesario, o un 204 No Content

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


@app.get("/tareas/", response_model=List[Tarea], summary="Obtener Tareas (con filtros opcionales)")
async def obtener_tareas(
    db: AsyncSession = Depends(get_db),
    analista_id: Optional[int] = None, # Parámetro opcional para filtrar por analista
    campana_id: Optional[int] = None   # Parámetro opcional para filtrar por campaña
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


@app.put("/tareas/{tarea_id}", response_model=Tarea, summary="Actualizar una Tarea existente")
async def actualizar_tarea(
    tarea_id: int,
    tarea_update: TareaBase, # Usamos TareaBase para los datos de entrada
    db: AsyncSession = Depends(get_db)
):
    """
    Actualiza la información de una tarea existente.

    - **tarea_id**: El ID de la tarea a actualizar.
    - **tarea_update**: Objeto TareaBase con los datos actualizados.
                      (Nota: analista_id y campana_id no se actualizan aquí directamente).
    """
    db_tarea = await db.execute(select(models.Tarea).where(models.Tarea.id == tarea_id))
    tarea_existente = db_tarea.scalar_one_or_none()

    if tarea_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada")

    # Actualizar los campos que pueden ser modificados
    tarea_existente.titulo = tarea_update.titulo
    tarea_existente.descripcion = tarea_update.descripcion
    tarea_existente.fecha_vencimiento = tarea_update.fecha_vencimiento
    tarea_existente.progreso = tarea_update.progreso # ¡Aquí se actualiza el progreso!

    # No permitimos actualizar analista_id o campana_id directamente con este PUT,
    # ya que eso podría tener implicaciones de negocio más complejas.
    # Si fuera necesario, se crearía un endpoint específico o se manejaría con otra lógica.

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

    # Consideración: si hay ChecklistItems asociados a esta tarea,
    # la base de datos podría impedir el borrado si no hay ON DELETE CASCADE.
    # Si quieres que se borren automáticamente, asegúrate de que tu modelo SQLAlchemy
    # y la tabla de la DB estén configuradas para ON DELETE CASCADE.

    await db.delete(tarea_a_eliminar)
    await db.commit()
    # No devolvemos contenido para 204 No Content, pero FastAPI manejará esto correctamente.
    return # No es necesario retornar un diccionario, el status_code 204 indica éxito sin contenido

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
    # Opcional: Verificar si la tarea_id existe
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
    tarea_id: Optional[int] = None # Filtro opcional por tarea
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
    item_update: ChecklistItemBase, # Usamos ChecklistItemBase para los datos de entrada
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

    # Si se intenta cambiar la tarea_id, verificamos que la nueva tarea exista
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
    return # Retorna 204 No Content

@app.post("/comentarios_campana/", response_model=ComentarioCampana, status_code=status.HTTP_201_CREATED, summary="Crear un nuevo Comentario de Campaña")
async def crear_comentario_campana(
    comentario: ComentarioCampanaBase,
    db: AsyncSession = Depends(get_db)
):
    """
    Crea un nuevo comentario asociado a una campaña y a un analista.

    - **comentario**: Objeto ComentarioCampanaBase con el contenido, y los IDs del analista y la campaña.
    """
    # Verificar si el analista_id existe
    analista_existente = await db.execute(select(models.Analista).where(models.Analista.id == comentario.analista_id))
    if analista_existente.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado.")

    # Verificar si la campana_id existe
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
    campana_id: Optional[int] = None,   # Filtro opcional por campaña
    analista_id: Optional[int] = None   # Filtro opcional por analista
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
    return # Retorna 204 No Content


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
    # Verificar si el creador_id (analista) existe
    creador_existente = await db.execute(select(models.Analista).where(models.Analista.id == aviso.creador_id))
    if creador_existente.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista creador no encontrado.")

    # Verificar si la campana_id existe, si se proporciona
    if aviso.campana_id:
        campana_existente = await db.execute(select(models.Campana).where(models.Campana.id == aviso.campana_id))
        if campana_existente.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña asociada no encontrada.")

    db_aviso = models.Aviso(**aviso.model_dump())
    db.add(db_aviso)
    await db.commit()
    await db.refresh(db_aviso)
    return db_aviso

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
    # Verificar si el creador_id (analista) existe
    creador_existente = await db.execute(select(models.Analista).where(models.Analista.id == aviso.creador_id))
    if creador_existente.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista creador no encontrado.")

    # Verificar si la campana_id existe, si se proporciona
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
    creador_id: Optional[int] = None,   # Filtro opcional por analista creador
    campana_id: Optional[int] = None    # Filtro opcional por campaña asociada
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
    aviso_update: AvisoBase, # Usamos AvisoBase para los datos de entrada
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

    # Si se intenta cambiar el creador_id, verificamos que el nuevo creador exista
    if aviso_update.creador_id != aviso_existente.creador_id:
        nuevo_creador_existente = await db.execute(select(models.Analista).where(models.Analista.id == aviso_update.creador_id))
        if nuevo_creador_existente.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nuevo Analista creador no encontrado para reasignar el Aviso.")
        aviso_existente.creador_id = aviso_update.creador_id

    # Si se intenta cambiar campana_id y se proporciona, verificamos que la nueva campaña exista
    if aviso_update.campana_id != aviso_existente.campana_id:
        if aviso_update.campana_id: # Si se está asignando a una campaña
            nueva_campana_existente = await db.execute(select(models.Campana).where(models.Campana.id == aviso_update.campana_id))
            if nueva_campana_existente.scalar_one_or_none() is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nueva Campaña no encontrada para reasignar el Aviso.")
        aviso_existente.campana_id = aviso_update.campana_id # Se puede asignar a None también

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
    return # Retorna 204 No Content