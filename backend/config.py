from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = Field(..., alias="DATABASE_URL")
    webhook_secret: str | None = Field(None, alias="WEBHOOK_SECRET")

    enable_hevy: bool = Field(False, alias="ENABLE_HEVY")
    hevy_api_key: str | None = Field(None, alias="HEVY_API_KEY")

    enable_coaching: bool = Field(False, alias="ENABLE_COACHING")
    anthropic_api_key: str | None = Field(None, alias="ANTHROPIC_API_KEY")
    claude_model: str | None = Field(None, alias="CLAUDE_MODEL")


settings = Settings()
