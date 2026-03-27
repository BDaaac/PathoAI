from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = 'django-insecure-fv(ca4hl3rj_f$3j7k6u2=%p4ej&+(v1$lslcv84+pirhb!1)6'

DEBUG = True

ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'classification',
    'segmentation',
    'analysis',
    'rag',
    'history',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'ru'
TIME_ZONE = 'Asia/Almaty'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# ML Models
ML_MODELS_DIR = BASE_DIR / 'ml_models'
CLASS_MODEL_PATH = ML_MODELS_DIR / 'convnext_large_best.pth'
SEG_MODEL_PATH = ML_MODELS_DIR / 'unetpp_effb5_best.pth'

# Anthropic API
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')

# Ollama API (local or remote)
OLLAMA_ENABLED = os.environ.get('OLLAMA_ENABLED', '1') == '1'
OLLAMA_BASE_URL = os.environ.get('OLLAMA_BASE_URL', 'http://127.0.0.1:11434')
OLLAMA_MODEL = os.environ.get('OLLAMA_MODEL', os.environ.get('RAG_MODEL_NAME', 'qwen2.5:3b'))
OLLAMA_API_KEY = os.environ.get('OLLAMA_API_KEY', '')
OLLAMA_MAX_TOKENS = int(os.environ.get('OLLAMA_MAX_TOKENS', '480'))
OLLAMA_TEMPERATURE = float(os.environ.get('OLLAMA_TEMPERATURE', '0.2'))
OLLAMA_TOP_P = float(os.environ.get('OLLAMA_TOP_P', '0.9'))
RAG_DISTANCE_THRESHOLD = float(os.environ.get('RAG_DISTANCE_THRESHOLD', '0.6'))

# Local lightweight model for RAG chat
LOCAL_LLM_ENABLED = os.environ.get('LOCAL_LLM_ENABLED', '0') == '1'
LOCAL_LLM_MODEL_ID = os.environ.get('LOCAL_LLM_MODEL_ID', 'Qwen/Qwen2.5-0.5B-Instruct')
LOCAL_LLM_MAX_NEW_TOKENS = int(os.environ.get('LOCAL_LLM_MAX_NEW_TOKENS', '480'))
LOCAL_LLM_TEMPERATURE = float(os.environ.get('LOCAL_LLM_TEMPERATURE', '0.2'))
LOCAL_LLM_TOP_P = float(os.environ.get('LOCAL_LLM_TOP_P', '0.9'))

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.MultiPartParser',
        'rest_framework.parsers.JSONParser',
    ]
}

# Class names for NCT-CRC-HE-100K dataset (12 classes)
CLASS_NAMES = {
    0: "Adipose Tissue",
    1: "Background / Artifact",
    2: "Debris",
    3: "Lymphocytes",
    4: "Mucus",
    5: "Smooth Muscle",
    6: "Normal Colon Mucosa",
    7: "Cancer-Associated Stroma",
    8: "Colorectal Adenocarcinoma Epithelium",
    9: "Serosa",
    10: "Complex Stroma",
    11: "Tumor Epithelium",
}

CLASS_NAMES_RU = {
    0: "Жировая ткань",
    1: "Фон / Артефакт",
    2: "Дебрис",
    3: "Лимфоциты",
    4: "Слизь",
    5: "Гладкая мускулатура",
    6: "Нормальная слизистая толстой кишки",
    7: "Строма, ассоциированная с раком",
    8: "Эпителий колоректальной аденокарциномы",
    9: "Серозная оболочка",
    10: "Комплексная строма",
    11: "Опухолевый эпителий",
}
