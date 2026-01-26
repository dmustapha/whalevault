from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    solana_rpc_url: str = "https://api.devnet.solana.com"
    program_id: str = "F3NLgP6kebPXSbH2GxGF39cR6uVdbzFD1V7iTgg7Htp4"
    cors_origins: str = "http://localhost:3000,http://localhost:3001"
    debug: bool = True

    # Relayer configuration
    relayer_keypair_path: str = "relayer-keypair.json"
    relayer_fee_bps: int = 30  # 0.3% fee
    relayer_enabled: bool = True

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()
