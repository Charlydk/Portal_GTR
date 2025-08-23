# /backend/services/geovictoria_service.py
import httpx
import os
import pandas as pd
from datetime import datetime, timedelta

GEOVICTORIA_USER = os.getenv("GEOVICTORIA_USER")
GEOVICTORIA_PASSWORD = os.getenv("GEOVICTORIA_PASSWORD")
GEOVICTORIA_LOGIN_URL = "https://customerapi.geovictoria.com/api/v1/Login"
GEOVICTORIA_ATTENDANCE_URL = "https://customerapi.geovictoria.com/api/v1/AttendanceBook"


async def obtener_token_geovictoria():
    if not GEOVICTORIA_USER or not GEOVICTORIA_PASSWORD:
        print("ERROR: Faltan las credenciales de GeoVictoria en las variables de entorno.")
        return None

    payload = {"User": GEOVICTORIA_USER, "Password": GEOVICTORIA_PASSWORD}
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(GEOVICTORIA_LOGIN_URL, json=payload)
            response.raise_for_status()
            return response.json().get("token")
    except httpx.RequestError as exc:
        print(f"Error de conexión al obtener token de GeoVictoria: {exc}")
        return None
    
def hhmm_to_decimal(time_str):
    if not time_str or not isinstance(time_str, str) or ':' not in time_str: return 0
    parts = time_str.split(':')
    try:
        return int(parts[0]) + (int(parts[1]) / 60)
    except (ValueError, IndexError):
        return 0

async def obtener_datos_completos_periodo(token: str, rut_limpio: str, fecha_inicio_dt: datetime, fecha_fin_dt: datetime):
    """
    Obtiene los datos de marcajes y turnos de un empleado para un período.
    """
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    payload = {
        "StartDate": fecha_inicio_dt.strftime("%Y%m%d%H%M%S"),
        "EndDate":   fecha_fin_dt.strftime("%Y%m%d%H%M%S"),
        "UserIds":   rut_limpio
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client: # Aumentamos el timeout por si la API externa tarda
            response = await client.post(GEOVICTORIA_ATTENDANCE_URL, json=payload, headers=headers)
            response.raise_for_status()
            respuesta_gv = response.json()

        dias_procesados = []
        usuarios = respuesta_gv.get("Users", [])
        if not usuarios: 
            return []

        # El resto de esta lógica de pandas no necesita "await" y puede quedar igual
        intervalos_por_fecha = {
            pd.to_datetime(intervalo.get("Date", ""), format="%Y%m%d%H%M%S").strftime('%Y-%m-%d'): intervalo
            for intervalo in usuarios[0].get("PlannedInterval", [])
        }
        current_date = fecha_inicio_dt.date()
        while current_date <= fecha_fin_dt.date():
            fecha_actual_str = current_date.strftime('%Y-%m-%d')
            intervalo_diario = intervalos_por_fecha.get(fecha_actual_str)

            datos_dia = {
                "fecha": fecha_actual_str,
                "nombre_apellido": f"{usuarios[0].get('Name', '')} {usuarios[0].get('LastName', '')}".strip(),
                "campaña": usuarios[0].get('GroupDescription'),
                "inicio_turno_teorico": None, "fin_turno_teorico": None,
                "marca_real_inicio": None, "marca_real_fin": None,
                "hhee_autorizadas_antes_gv": 0, "hhee_autorizadas_despues_gv": 0
            }
            if intervalo_diario:
                marcas = intervalo_diario.get("Punches", [])
                entradas = [pd.to_datetime(p['Date'], format='%Y%m%d%H%M%S') for p in marcas if p.get('ShiftPunchType') == 'Entrada']
                salidas = [pd.to_datetime(p['Date'], format='%Y%m%d%H%M%S') for p in marcas if p.get('ShiftPunchType') == 'Salida']
                turno = intervalo_diario.get("Shifts", [{}])[0]
                datos_dia.update({
                    "inicio_turno_teorico": turno.get('StartTime'),
                    "fin_turno_teorico": turno.get('ExitTime'),
                    "marca_real_inicio": min(entradas).strftime('%H:%M') if entradas else None,
                    "marca_real_fin": max(salidas).strftime('%H:%M') if salidas else None,
                    "hhee_autorizadas_antes_gv": hhmm_to_decimal(intervalo_diario.get("AuthorizedOvertimeBefore")),
                    "hhee_autorizadas_despues_gv": hhmm_to_decimal(intervalo_diario.get("AuthorizedOvertimeAfter"))
                })
            dias_procesados.append(datos_dia)
            current_date += timedelta(days=1)
        return dias_procesados
    except httpx.RequestError as exc:
        print(f"Error al llamar a /AttendanceBook: {exc}")
        return []
