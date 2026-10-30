from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    postgres_user: str = "erp"
    postgres_password: str = "changeme"
    postgres_db: str = "emergency_response"
    postgres_host: str = "localhost"
    postgres_port: int = 5432

    database_url_override: str | None = Field(default=None, alias="DATABASE_URL")
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000"
    ingestion_interval_minutes: int = 30
    firms_map_key: str = ""

    # Auth & JWT configuration
    jwt_secret_key: str = "emergency_response_secret_key_change_in_production_2026"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 1440  # 24 hours

    # Provisioned accounts for demonstration & mentor review
    initial_admin_email: str = "admin@emergency.gov"
    initial_admin_password: str = "Admin@1234"
    initial_demo_reporter_email: str = "reporter@emergency.gov"
    initial_demo_reporter_password: str = "Reporter@1234"


    # Grid classification defaults
    grid_cell_size_deg: float = 0.05  # ~5.5km at equator
    severity_weight_hazard: float = 0.4
    severity_weight_population: float = 0.35
    severity_weight_buildings: float = 0.25
    severity_threshold_low: float = 25.0
    severity_threshold_moderate: float = 50.0
    severity_threshold_high: float = 75.0

    @property
    def database_url(self) -> str:
        if self.database_url_override:
            return self.database_url_override
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def sync_database_url(self) -> str:
        """For Alembic and sync seed scripts."""
        if self.database_url_override:
            if "sqlite+aiosqlite" in self.database_url_override:
                return self.database_url_override.replace("sqlite+aiosqlite", "sqlite")
            return self.database_url_override
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    model_config = {"env_file": [".env", "../.env"], "extra": "ignore", "populate_by_name": True}


settings = Settings()
