import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

# Cargar variables de entorno del archivo .env
load_dotenv()

# Obtener la URL de la base de datos de las variables de entorno
DATABASE_URL = os.getenv("DATABASE_URL")

# Verificar si la URL de la base de datos está cargada
if not DATABASE_URL:
    raise ValueError("La variable de entorno DATABASE_URL no está configurada. Asegúrate de tener un archivo .env válido.")

# Configuración del motor de la base de datos
# echo=True es útil para depuración, muestra las queries SQL en la terminal
engine = create_async_engine(DATABASE_URL, echo=True)

# Sesión asíncrona para interactuar con la base de datos
AsyncSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=AsyncSession, # Usamos AsyncSession para soporte asíncrono
    expire_on_commit=False  # <-- ESTA ES LA LÍNEA CLAVE DE LA SOLUCIÓN
)

# Base declarativa para tus modelos ORM
# Los modelos de SQLAlchemy que crearemos luego heredarán de esta clase
Base = declarative_base()

# Dependencia para obtener una sesión de base de datos
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
