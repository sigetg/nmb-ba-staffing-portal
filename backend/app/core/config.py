from pydantic import computed_field
from pydantic_settings import BaseSettings


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
    cors_origins: str = "http://localhost:3007,http://127.0.0.1:3007"

    @computed_field
    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    # Stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    # Google Maps
    google_maps_api_key: str = ""

    # Resend
    resend_api_key: str = ""
    email_from: str = "NMB Media <onboarding@resend.dev>"
    frontend_url: str = "http://localhost:3007"

    # Twilio
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""

    # Dropbox
    dropbox_app_key: str = ""
    dropbox_app_secret: str = ""
    dropbox_refresh_token: str = ""

    # W-9 / payout encryption (pgcrypto pgp_sym_encrypt key)
    w9_encryption_key: str = ""

    # PayPal Payouts + Log In with PayPal
    paypal_client_id: str = ""
    paypal_client_secret: str = ""
    paypal_webhook_id: str = ""
    paypal_mode: str = "sandbox"  # 'sandbox' | 'live'
    # Optional override; defaults to {frontend_url}/api/profile/paypal/callback
    paypal_login_redirect_uri: str = ""

    # QuickBooks Online
    qbo_client_id: str = ""
    qbo_client_secret: str = ""
    qbo_redirect_uri: str = ""
    qbo_environment: str = "sandbox"  # 'sandbox' | 'production'

    # Business platform info (used on W-9 PDF as the payer / on 1099-NECs)
    payer_business_name: str = "NMB Media"
    payer_address_line1: str = ""
    payer_city: str = ""
    payer_state: str = ""
    payer_zip: str = ""
    payer_ein: str = ""

    model_config = {"env_file": ".env", "case_sensitive": False}


settings = Settings()
