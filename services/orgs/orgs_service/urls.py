from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import health
from core.viewsets import TenantViewSet, RoleViewSet, MembershipViewSet, InvitationViewSet, ProjectRoleViewSet, ProjectMembershipViewSet
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

router = DefaultRouter()
router.register(r'tenants', TenantViewSet, basename='tenant')
router.register(r'roles', RoleViewSet, basename='role')
router.register(r'memberships', MembershipViewSet, basename='membership')
router.register(r'invitations', InvitationViewSet, basename='invitation')
router.register(r'project-roles', ProjectRoleViewSet, basename='projectrole')
router.register(r'project-memberships', ProjectMembershipViewSet, basename='projectmembership')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health', health),
    path('api/', include(router.urls)),
    path('api/schema', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs', SpectacularSwaggerView.as_view(url_name='schema')),
]
