"""Database engine, session management, and Base model definition."""

from geoalchemy2 import Geometry
from geoalchemy2.admin.dialects import sqlite as g_sqlite
from shapely import wkt
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


# When running under SQLite (local standalone / test mode), compile Geometry as TEXT
# and safely disable SpatiaLite DDL hooks so tables create cleanly without requiring C extensions.
@compiles(Geometry, "sqlite")
def _compile_geometry_sqlite(type_, compiler, **kw):
    return "TEXT"


g_sqlite.after_create = lambda *args, **kwargs: None
g_sqlite.before_create = lambda *args, **kwargs: None

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


def _to_wkb(val):
    if not val:
        return None
    try:
        if isinstance(val, (bytes, memoryview)):
            return bytes(val)
        clean = str(val).split(";", 1)[-1].strip()
        return wkt.loads(clean).wkb
    except Exception:
        return None


@event.listens_for(engine.sync_engine, "connect")
def _register_sqlite_spatial_functions(dbapi_conn, connection_record):
    """Provide lightweight Python fallbacks for SpatiaLite functions when running on SQLite."""
    if hasattr(dbapi_conn, "cursor"):
        try:
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA busy_timeout=30000")
            cursor.close()
        except Exception:
            pass
    if hasattr(dbapi_conn, "create_function"):
        dbapi_conn.create_function("AsEWKB", 1, _to_wkb)
        dbapi_conn.create_function("AsBinary", 1, _to_wkb)
        dbapi_conn.create_function("GeomFromEWKT", 1, lambda g: g)
        dbapi_conn.create_function("GeomFromWKB", -1, lambda *a: a[0] if a else None)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:  # type: ignore[misc]
    async with async_session() as session:
        yield session
