from pydantic_settings import BaseSettings
from pydantic import computed_field
from typing import List


class Settings(BaseSettings):
    # Environment
    environment: str = "development"

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""
    database_url: str = ""

    # Security
    secret_key: str = "dev-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # CORS - stored as comma-separated string to avoid pydantic-settings JSON parsing
    cors_origins: str = "http://localhost:3001,http://127.0.0.1:3001"

    @computed_field
    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    # Stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    # Google Maps
    google_maps_api_key: str = ""

    # Resend
    resend_api_key: str = ""
    email_from: str = "NMB Media <onboarding@resend.dev>"
    frontend_url: str = "http://localhost:3001"

    # Twilio
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""

    model_config = {"env_file": ".env", "case_sensitive": False}


settings = Settings()
