from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/moviesite"
    supabase_jwt_secret: str = "dev-secret-change-me"
    supabase_jwt_audience: str = "authenticated"
    tmdb_api_key: str = ""
    tmdb_base_url: str = "https://api.themoviedb.org/3"
    success_threshold: float = 4.0
    cors_origins: str = "http://localhost:5173,https://plotpost-jet.vercel.app,https://plotpostt.vercel.app"
    # Also allow any Vercel host (preview + production).
    cors_origin_regex: str = r"https://.*\.vercel\.app"
    max_page_size: int = 50
    default_page_size: int = 20

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
