# En el nuevo archivo backend/routers/hhee_router.py

from fastapi import APIRouter
# ... aquí irán otros imports más adelante ...

router = APIRouter(
    prefix="/hhee",      # Todas las rutas de este archivo empezarán con /hhee
    tags=["Portal HHEE"] # Etiqueta para agruparlas en la documentación
)

# Aquí es donde "traduciremos" tus rutas de Flask

@router.get("/")
async def raiz_hhee():
    return {"mensaje": "Bienvenido al API del Portal HHEE"}