from django.contrib import admin
from django.urls import path
from core.views import health
from core.auth_views import RegisterView, MeView, SwitchTenantView, ThrottledTokenObtainPairView, MyTokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenRefreshView
from core.service_views import jwks, issue_service_token, rotate_jwks
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health', health),
    # Auth endpoints
    path('api/auth/register', RegisterView.as_view()),
    path('api/auth/me', MeView.as_view()),
    path('api/auth/switch-tenant', SwitchTenantView.as_view()),
    path('api/auth/token', ThrottledTokenObtainPairView.as_view(serializer_class=MyTokenObtainPairSerializer), name='token_obtain_pair'),
    path('api/auth/token/refresh', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/schema', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs', SpectacularSwaggerView.as_view(url_name='schema')),
    # Service JWKS & token issuance
    path('api/service/jwks', jwks),
    path('api/service/token', issue_service_token),
    path('api/service/rotate', rotate_jwks),
]
