from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Internal Model Hub"
    secret_key: str = "development-only-change-me"
    database_url: str = "sqlite:///./hub.db"
    cors_origins: str = "http://localhost:3000"
    gitea_mock: bool = True
    gitea_url: str = "http://localhost:3001"
    gitea_public_url: str = "http://localhost:3001"
    gitea_admin_username: str = "modelhub-admin"
    gitea_admin_token: str = ""
    mock_storage_root: str = "./mock-gitea"
    max_upload_size_bytes: int = 5 * 1024 * 1024 * 1024
    lfs_threshold_bytes: int = 10 * 1024 * 1024
    lfs_extensions: str = ".safetensors,.gguf,.bin,.pt,.pth,.onnx"
    git_executable: str = "git"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def lfs_extension_set(self) -> set[str]:
        return {
            item.strip().lower()
            for item in self.lfs_extensions.split(",")
            if item.strip()
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()
