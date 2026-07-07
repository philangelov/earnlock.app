import os

from dotenv import load_dotenv

load_dotenv()


class Config:
    SUPABASE_JWT_SECRET = os.environ["SUPABASE_JWT_SECRET"]
    ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:8081").split(",")
    QUIZ_CORRECT_TARGET = int(os.getenv("QUIZ_CORRECT_TARGET", "5"))
    REWARD_SECONDS = int(os.getenv("REWARD_SECONDS", "900"))
    QUIZ_LEN_NORMAL = int(os.getenv("QUIZ_LEN_NORMAL", "5"))
    QUIZ_LEN_DEBT = int(os.getenv("QUIZ_LEN_DEBT", "7"))


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
