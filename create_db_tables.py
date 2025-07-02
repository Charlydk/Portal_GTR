import asyncio
from database import engine, Base
from sql_app import models # Importa tus modelos de SQLAlchemy

async def create_db_and_tables():
    async with engine.begin() as conn:
        # Primero, intenta borrar todas las tablas que SQLAlchemy conoce
        # CUIDADO: Esto borrará todos los datos en esas tablas
        await conn.run_sync(Base.metadata.drop_all)
        # Luego, crea todas las tablas
        await conn.run_sync(Base.metadata.create_all)
    print("Tablas de la base de datos recreadas (o creadas) en Supabase.")

if __name__ == "__main__":
    asyncio.run(create_db_and_tables())