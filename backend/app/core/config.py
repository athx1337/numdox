import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    APP_NAME: str = "NUMDOX"
    APP_VERSION: str = "0.1.0"
    APP_DESCRIPTION: str = "Phone Number OSINT & Intelligence Framework"
    
    # Environment
    ENV: str = "development"
    DEBUG: bool = True
    
    # Database
    DATABASE_URL: str = "sqlite:///./numdox.db"
    
    # External APIs (Optional)
    NUMVERIFY_API_KEY: str = ""
    ABSTRACT_API_KEY: str = ""
    TRUECALLER_AUTH_TOKEN: str = ""
    RAPIDAPI_TRUECALLER_KEY: str = ""
    OPENCAGE_API_KEY: str = ""
    ABUSEIPDB_API_KEY: str = ""
    GREYNOISE_API_KEY: str = ""
    OTX_API_KEY: str = ""
    HIBP_API_KEY: str = ""
    GITHUB_TOKEN: str = ""
    GEMINI_API_KEY: str = ""
    
    # Rate Limiting & Timeouts
    REQUEST_TIMEOUT_SECONDS: float = 8.0
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
