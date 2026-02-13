from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

    # Database
    database_url: str = "postgresql+asyncpg://root:dontwastetime@localhost:5432/myapp"

    # OpenAI
    openai_api_key: str = ""

    # Email (Gmail SMTP)
    email_address: str = ""
    email_password: str = ""
    recipient_email: str = ""

    # Scheduler
    review_email_hour: int = 8

    # Logging
    log_level: str = "INFO"


settings = Settings()
