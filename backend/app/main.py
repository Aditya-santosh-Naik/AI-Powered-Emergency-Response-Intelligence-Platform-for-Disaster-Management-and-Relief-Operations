"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.auth import router as auth_router
from app.api.v1.donors import router as donors_router
from app.api.v1.events import router as events_router
from app.api.v1.field_ops import router as field_ops_router
from app.api.v1.ingestion import router as ingestion_router
from app.api.v1.inventory import router as inventory_router
from app.api.v1.predictions import router as predictions_router
from app.api.v1.reports import router as reports_router
from app.api.v1.zones import router as zones_router

from app.config import settings
from app.db import Base, engine
from app.scheduler import shutdown_scheduler, start_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables exist and start background ingestion scheduler
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as exc:
        logger.warning("Could not auto-create tables on startup (PostGIS might not be ready): %s", exc)

    start_scheduler()
    yield
    # Shutdown
    shutdown_scheduler()


app = FastAPI(
    title="Emergency Response Intelligence Platform API",
    description="Backend services for Weeks 1–2: Disaster Data Ingestion & Geospatial Impact Assessment.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS configuration
origins = settings.cors_origin_list
if not origins:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Mount API v1 routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(events_router, prefix="/api/v1")
app.include_router(ingestion_router, prefix="/api/v1")
app.include_router(zones_router, prefix="/api/v1")
app.include_router(inventory_router, prefix="/api/v1")
app.include_router(field_ops_router, prefix="/api/v1")
app.include_router(donors_router, prefix="/api/v1")
app.include_router(predictions_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")


@app.get("/api/v1/health", tags=["health"])
async def health_check():
    """Simple health check endpoint to verify backend status."""
    return {
        "status": "ok",
        "version": "0.2.0",
        "module": "Weeks 1–2: Ingestion & Impact Assessment; Weeks 3–4: Resource Demand Prediction Engine",
    }


