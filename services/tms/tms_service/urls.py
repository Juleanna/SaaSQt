from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import health
from core.viewsets import (
    ProjectViewSet, TestCaseViewSet, SuiteViewSet, SuiteCaseViewSet,
    ReleaseViewSet, TestCaseVersionViewSet, TestPlanViewSet, PlanItemViewSet,
    TestRunViewSet, TestInstanceViewSet,
)
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

router = DefaultRouter()
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'testcases', TestCaseViewSet, basename='testcase')
router.register(r'suites', SuiteViewSet, basename='suite')
router.register(r'suite-cases', SuiteCaseViewSet, basename='suitecase')
router.register(r'releases', ReleaseViewSet, basename='release')
router.register(r'testcase-versions', TestCaseVersionViewSet, basename='testcaseversion')
router.register(r'plans', TestPlanViewSet, basename='testplan')
router.register(r'plan-items', PlanItemViewSet, basename='planitem')
router.register(r'runs', TestRunViewSet, basename='testrun')
router.register(r'instances', TestInstanceViewSet, basename='testinstance')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health', health),
    path('api/', include(router.urls)),
    path('api/schema', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs', SpectacularSwaggerView.as_view(url_name='schema')),
]
