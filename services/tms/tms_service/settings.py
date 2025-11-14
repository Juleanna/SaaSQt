import os
from pathlib import Path
import environ

BASE_DIR = Path(__file__).resolve().parent.parent
env = environ.Env(
    DEBUG=(bool, False),
)
environ.Env.read_env(env_file=BASE_DIR.parent.parent / '.env') if (BASE_DIR.parent.parent / '.env').exists() else None

DEBUG = env('DEBUG')
SECRET_KEY = env('DJANGO_SECRET_KEY', default='dev-secret')
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['*'])

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'drf_spectacular',
    'django_filters',
    'core',
]

MIDDLEWARE = [
    'core.middleware.TenantMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'tms_service.urls'

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

WSGI_APPLICATION = 'tms_service.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'HOST': env('DB_HOST', default='localhost'),
        'PORT': env('DB_PORT', default='5432'),
        'NAME': env('DB_NAME', default='tms_db'),
        'USER': env('DB_USER', default='postgres'),
        'PASSWORD': env('DB_PASSWORD', default='postgres'),
    }
}

REST_FRAMEWORK = {
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'core.auth.ExternalJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.OrderingFilter',
        'rest_framework.filters.SearchFilter',
    ),
    'DEFAULT_PAGINATION_CLASS': 'core.pagination.DefaultCursorPagination',
    'DEFAULT_THROTTLE_CLASSES': [
        'core.throttle.JWTUserOrIPRateThrottle',
        'rest_framework.throttling.AnonRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'user': env('THROTTLE_USER', default='200/minute'),
        'anon': env('THROTTLE_ANON', default='50/minute'),
    },
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'TMS Service API',
    'VERSION': '0.1.0',
}

STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

CORS_ALLOW_ALL_ORIGINS = env.bool('CORS_ALLOW_ALL_ORIGINS', default=True)

# Redis cache for throttling/shared state
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': env('REDIS_URL', default='redis://localhost:6379/0'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}

TEST_MANAGER_IMPORT_ROOT = env('TEST_MANAGER_IMPORT_ROOT', default=str(BASE_DIR / 'test_manager_imports'))
TEST_MANAGER_EXPORT_ROOT = env('TEST_MANAGER_EXPORT_ROOT', default=str(BASE_DIR / 'test_manager_exports'))

# Inter-service config
ORGS_BASE_URL = env('ORGS_BASE_URL', default='http://orgs:8000/api')
ORGS_SERVICE_TOKEN = env('ORGS_SERVICE_TOKEN', default=None)
SERVICES_JWT_SECRET = env('SERVICES_JWT_SECRET', default=None)
SERVICES_JWT_ISSUER = env('SERVICES_JWT_ISSUER', default='tms')
SERVICES_JWT_AUDIENCE = env('SERVICES_JWT_AUDIENCE', default='orgs')
AUTH_BASE_URL = env('AUTH_BASE_URL', default='http://auth:8000/api')
