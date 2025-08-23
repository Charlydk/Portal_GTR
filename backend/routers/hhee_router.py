# /backend/routers/hhee_router.py

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from services import geovictoria_service
from datetime import datetime, date
from typing import List

from database import get_db
from dependencies import get_current_analista
from sql_app import models
from pydantic import BaseModel

class ConsultaHHEE(BaseModel):
    rut: str
    fecha_inicio: date
    fecha_fin: date

router = APIRouter(
    prefix="/hhee",
    tags=["Portal HHEE"]
)

@router.post("/consultar-empleado")
async def consultar_empleado(
    consulta: ConsultaHHEE,
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(get_current_analista)
):
    token = await geovictoria_service.obtener_token_geovictoria()
    if not token:
        raise HTTPException(status_code=503, detail="No se pudo comunicar con el servicio externo (GeoVictoria).")

    rut_limpio_api = consulta.rut.replace('-', '').replace('.', '').upper()
    fecha_inicio_dt = datetime.combine(consulta.fecha_inicio, datetime.min.time())
    fecha_fin_dt = datetime.combine(consulta.fecha_fin, datetime.max.time())

    datos_gv = await geovictoria_service.obtener_datos_completos_periodo(
        token, rut_limpio_api, fecha_inicio_dt, fecha_fin_dt
    )

    if not datos_gv:
        raise HTTPException(status_code=404, detail="No se encontraron datos en GeoVictoria para el RUT y período seleccionados.")

    # --- LÓGICA DE CRUCE CON BASE DE DATOS (NUEVO) ---

    # 1. Obtener las validaciones ya guardadas para este RUT y período
    query_guardados = select(models.ValidacionHHEE).filter(
        models.ValidacionHHEE.rut == consulta.rut,
        models.ValidacionHHEE.fecha_hhee.between(consulta.fecha_inicio, consulta.fecha_fin)
    )
    result_guardados = await db.execute(query_guardados)
    validaciones_guardadas = result_guardados.scalars().all()

    # 2. Agruparlas por fecha para un acceso rápido
    datos_guardados_por_fecha = {}
    for v in validaciones_guardadas:
        fecha_str = v.fecha_hhee.strftime('%Y-%m-%d')
        if fecha_str not in datos_guardados_por_fecha:
            datos_guardados_por_fecha[fecha_str] = {}
        tipo = v.tipo_hhee or 'General'
        datos_guardados_por_fecha[fecha_str][tipo] = v

    # 3. Fusionar datos de GV con los datos guardados
    resultados_finales = []
    for datos_dia_gv in datos_gv:
        fecha = datos_dia_gv['fecha']
        registros_del_dia = datos_guardados_por_fecha.get(fecha, {})

        estado_general = 'No Guardado'
        if registros_del_dia:
            # Si cualquier registro del día está pendiente, el estado general es pendiente
            if any(r.estado == 'Pendiente por Corrección' for r in registros_del_dia.values()):
                estado_general = 'Pendiente por Corrección'
            # Si no hay pendientes pero al menos uno está validado, el estado es validado
            elif any(r.estado == 'Validado' for r in registros_del_dia.values()):
                estado_general = 'Validado'

        datos_dia_gv['estado_final'] = estado_general
        resultados_finales.append(datos_dia_gv)

    # --- FIN DE LA LÓGICA DE CRUCE ---

    nombre_agente = resultados_finales[0].get('nombre_apellido', 'No encontrado')

    return {
        "datos_periodo": resultados_finales,
        "nombre_agente": nombre_agente
    }