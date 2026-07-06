import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SUPABASE_JWT_SECRET = os.environ["SUPABASE_JWT_SECRET"]
    ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:8081").split(",")


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


configs = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
}

def get_config():
    env = os.getenv("FLASK_ENV", "development")
    return configs.get(env, DevelopmentConfig)
