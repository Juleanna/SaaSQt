import csv
import json
from pathlib import Path

from django.conf import settings
from rest_framework import viewsets, mixins
from rest_framework.permissions import IsAuthenticated
from .permissions import IsTenantMember, TenantRBACPermission
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db import transaction
from django.db.models import Max
from .models import (
    Project, TestCase, Suite, SuiteCase,
    Release, TestCaseVersion, TestPlan, PlanItem, TestRun, TestInstance,
    TestSection, TestTag, Requirement, TestImportJob, TestExportJob
)
from .serializers import (
    ProjectSerializer, TestCaseSerializer, SuiteSerializer, SuiteCaseSerializer,
    ReleaseSerializer, TestCaseVersionSerializer, TestPlanSerializer,
    PlanItemSerializer, TestRunSerializer, TestInstanceSerializer,
    TestSectionSerializer, TestTagSerializer, RequirementSerializer,
    TestImportJobSerializer, TestExportJobSerializer
)
from .pagination import CreatedAtCursorPagination
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all().order_by('id')
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantRBACPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['tenant_id', 'key', 'name']
    search_fields = ['key', 'name']
    ordering_fields = ['id', 'key', 'name', 'created_at']
    # RBAC: allowed roles for write actions
    allowed_roles_write = ('owner', 'admin')
    allowed_roles_create = ('owner', 'admin')
    allowed_roles_update = ('owner', 'admin')
    allowed_roles_delete = ('owner', 'admin')

    def get_queryset(self):
        qs = super().get_queryset()
        tenant_id = getattr(self.request, 'tenant_id', None)
        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)
        return qs
    pagination_class = CreatedAtCursorPagination


class TestSectionViewSet(viewsets.ModelViewSet):
    queryset = TestSection.objects.select_related('project', 'parent').all().order_by('order', 'id')
    serializer_class = TestSectionSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantRBACPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['project', 'parent']
    search_fields = ['name']
    ordering_fields = ['order', 'name', 'id']
    allowed_roles_write = ('owner', 'admin')
    allowed_roles_create = ('owner', 'admin', 'member')
    allowed_roles_update = ('owner', 'admin')
    allowed_roles_delete = ('owner', 'admin')

    def get_queryset(self):
        qs = super().get_queryset()
        tenant_id = getattr(self.request, 'tenant_id', None)
        if tenant_id:
            qs = qs.filter(project__tenant_id=tenant_id)
        return qs

    def perform_create(self, serializer):
        project = serializer.validated_data['project']
        parent = serializer.validated_data.get('parent')
        max_order = TestSection.objects.filter(project=project, parent=parent).aggregate(Max('order'))['order__max'] or 0
        serializer.save(order=max_order + 1)


class TestTagViewSet(viewsets.ModelViewSet):
    queryset = TestTag.objects.select_related('project').all().order_by('name')
    serializer_class = TestTagSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantRBACPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['project', 'name']
    search_fields = ['name']
    ordering_fields = ['name', 'id']
    allowed_roles_write = ('owner', 'admin')
    allowed_roles_create = ('owner', 'admin', 'member')
    allowed_roles_update = ('owner', 'admin')
    allowed_roles_delete = ('owner', 'admin')

    def get_queryset(self):
        qs = super().get_queryset()
        tenant_id = getattr(self.request, 'tenant_id', None)
        if tenant_id:
            qs = qs.filter(project__tenant_id=tenant_id)
        return qs


class RequirementViewSet(viewsets.ModelViewSet):
    queryset = Requirement.objects.select_related('project').all().order_by('-updated_at')
    serializer_class = RequirementSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantRBACPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['project', 'status', 'external_id']
    search_fields = ['title', 'description', 'external_id']
    ordering_fields = ['updated_at', 'title', 'status']
    allowed_roles_write = ('owner', 'admin')
    allowed_roles_create = ('owner', 'admin', 'member')
    allowed_roles_update = ('owner', 'admin', 'member')
    allowed_roles_delete = ('owner', 'admin')

    def get_queryset(self):
        qs = super().get_queryset()
        tenant_id = getattr(self.request, 'tenant_id', None)
        if tenant_id:
            qs = qs.filter(project__tenant_id=tenant_id)
        return qs


class TestCaseViewSet(viewsets.ModelViewSet):
    queryset = TestCase.objects.select_related('project', 'section').prefetch_related('labels', 'requirements').all().order_by('id')
    serializer_class = TestCaseSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantRBACPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['project', 'status', 'section', 'priority', 'labels', 'requirements']
    search_fields = ['title', 'description']
    ordering_fields = ['id', 'title', 'updated_at']
    allowed_roles_write = ('owner', 'admin')
    # Member can create, but not delete
    allowed_roles_create = ('owner', 'admin', 'member')
    allowed_roles_update = ('owner', 'admin')
    allowed_roles_delete = ('owner', 'admin')
    allowed_roles_actions = {
        'archive': ('owner', 'admin'),
        'unarchive': ('owner', 'admin'),
    }

    def get_queryset(self):
        qs = super().get_queryset()
        tenant_id = getattr(self.request, 'tenant_id', None)
        if tenant_id:
            qs = qs.filter(project__tenant_id=tenant_id)
        return qs
    pagination_class = CreatedAtCursorPagination

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        obj = self.get_object()
        obj.status = 'archived'
        obj.save(update_fields=['status'])
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=['post'])
    def unarchive(self, request, pk=None):
        obj = self.get_object()
        obj.status = 'active'
        obj.save(update_fields=['status'])
        return Response(self.get_serializer(obj).data)

    def perform_update(self, serializer):
        instance = serializer.save()
        with transaction.atomic():
            instance.version = (instance.version or 1) + 1
            instance.save(update_fields=['version'])
            # Ensure we snapshot the new version
            TestCaseVersion.objects.create(
                testcase=instance,
                version=instance.version,
                title=instance.title,
                description=instance.description,
                steps=instance.steps,
                expected=[],
            )


class SuiteViewSet(viewsets.ModelViewSet):
    queryset = Suite.objects.select_related('project').all().order_by('id')
    serializer_class = SuiteSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantRBACPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['project', 'name']
    search_fields = ['name']
    ordering_fields = ['id', 'name']
    allowed_roles_write = ('owner', 'admin')
    allowed_roles_create = ('owner', 'admin', 'member')
    allowed_roles_update = ('owner', 'admin')
    allowed_roles_delete = ('owner', 'admin')

    def get_queryset(self):
        qs = super().get_queryset()
        tenant_id = getattr(self.request, 'tenant_id', None)
        if tenant_id:
            qs = qs.filter(project__tenant_id=tenant_id)
        return qs
    pagination_class = CreatedAtCursorPagination


class SuiteCaseViewSet(viewsets.ModelViewSet):
    queryset = SuiteCase.objects.select_related('suite', 'test_case').all().order_by('id')
    serializer_class = SuiteCaseSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantRBACPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['suite', 'test_case']
    ordering_fields = ['order', 'id']
    allowed_roles_write = ('owner', 'admin')
    allowed_roles_create = ('owner', 'admin', 'member')
    allowed_roles_update = ('owner', 'admin', 'member')
    allowed_roles_delete = ('owner', 'admin')
    allowed_roles_actions = {
        'move': ('owner', 'admin', 'member'),
    }

    def get_queryset(self):
        qs = super().get_queryset()
        tenant_id = getattr(self.request, 'tenant_id', None)
        if tenant_id:
            qs = qs.filter(suite__project__tenant_id=tenant_id)
        return qs

    @action(detail=True, methods=['post'])
    def move(self, request, pk=None):
        from django.db import transaction
        obj = self.get_object()
        try:
            new_pos = int(request.data.get('order'))
        except Exception:
            return Response({'detail': 'Invalid order'}, status=status.HTTP_400_BAD_REQUEST)
        if new_pos < 1:
            new_pos = 1
        with transaction.atomic():
            items = list(self.get_queryset().filter(suite_id=obj.suite_id).order_by('order', 'id'))
            # Remove current
            items = [it for it in items if it.id != obj.id]
            # Clamp position
            if new_pos > len(items) + 1:
                new_pos = len(items) + 1
            # Insert at new position (1-based)
            items.insert(new_pos - 1, obj)
            # Reindex
            for idx, it in enumerate(items, start=1):
                if it.order != idx:
                    it.order = idx
                    it.save(update_fields=['order'])
        obj.refresh_from_db()
        return Response(self.get_serializer(obj).data)


class ReleaseViewSet(viewsets.ModelViewSet):
    queryset = Release.objects.select_related('project').all().order_by('id')
    serializer_class = ReleaseSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantRBACPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['project', 'name']
    search_fields = ['name', 'version']
    ordering_fields = ['id', 'name', 'created_at']
    allowed_roles_write = ('owner', 'admin')
    allowed_roles_create = ('owner', 'admin', 'member')
    allowed_roles_update = ('owner', 'admin')
    allowed_roles_delete = ('owner', 'admin')
    pagination_class = CreatedAtCursorPagination

    def get_queryset(self):
        qs = super().get_queryset()
        tenant_id = getattr(self.request, 'tenant_id', None)
        if tenant_id:
            qs = qs.filter(project__tenant_id=tenant_id)
        return qs


class TestCaseVersionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TestCaseVersion.objects.select_related('testcase').all().order_by('-created_at')
    serializer_class = TestCaseVersionSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantRBACPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['testcase', 'version']
    ordering_fields = ['version', 'created_at', 'id']
    pagination_class = CreatedAtCursorPagination

    def get_queryset(self):
        qs = super().get_queryset()
        tenant_id = getattr(self.request, 'tenant_id', None)
        if tenant_id:
            qs = qs.filter(testcase__project__tenant_id=tenant_id)
        return qs


class TestPlanViewSet(viewsets.ModelViewSet):
    queryset = TestPlan.objects.select_related('project', 'release').all().order_by('id')
    serializer_class = TestPlanSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantRBACPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['project', 'release', 'name']
    search_fields = ['name', 'description']
    ordering_fields = ['id', 'name', 'created_at']
    allowed_roles_write = ('owner', 'admin')
    allowed_roles_create = ('owner', 'admin', 'member')
    allowed_roles_update = ('owner', 'admin')
    allowed_roles_delete = ('owner', 'admin')
    allowed_roles_actions = {
        'clone': ('owner', 'admin', 'member'),
    }
    pagination_class = CreatedAtCursorPagination

    def get_queryset(self):
        qs = super().get_queryset()
        tenant_id = getattr(self.request, 'tenant_id', None)
        if tenant_id:
            qs = qs.filter(project__tenant_id=tenant_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by_user_id=getattr(self.request.user, 'id', None))

    @action(detail=True, methods=['post'])
    def clone(self, request, pk=None):
        plan = self.get_object()
        name = request.data.get('name') or f"{plan.name} (Clone)"
        with transaction.atomic():
            new_plan = TestPlan.objects.create(
                project=plan.project,
                name=name,
                description=plan.description,
                release=plan.release,
                created_by_user_id=getattr(request.user, 'id', None),
            )
            items = list(plan.items.select_related('testcase_version').order_by('order', 'id'))
            for idx, it in enumerate(items, start=1):
                PlanItem.objects.create(
                    plan=new_plan,
                    testcase=it.testcase,
                    testcase_version=it.testcase_version,
                    order=idx,
                )
        return Response(TestPlanSerializer(new_plan).data, status=201)


class PlanItemViewSet(viewsets.ModelViewSet):
    queryset = PlanItem.objects.select_related('plan', 'testcase', 'testcase_version').all().order_by('id')
    serializer_class = PlanItemSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantRBACPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['plan', 'testcase']
    ordering_fields = ['order', 'id']
    allowed_roles_write = ('owner', 'admin')
    allowed_roles_create = ('owner', 'admin', 'member')
    allowed_roles_update = ('owner', 'admin', 'member')
    allowed_roles_delete = ('owner', 'admin')
    allowed_roles_actions = {
        'move': ('owner', 'admin', 'member'),
    }

    def get_queryset(self):
        qs = super().get_queryset()
        tenant_id = getattr(self.request, 'tenant_id', None)
        if tenant_id:
            qs = qs.filter(plan__project__tenant_id=tenant_id)
        return qs

    def perform_create(self, serializer):
        data = serializer.validated_data
        testcase = data['testcase']
        testcase_version = data.get('testcase_version')
        if not testcase_version:
            # Ensure snapshot for current version exists
            ver = testcase.version
            vobj = TestCaseVersion.objects.filter(testcase=testcase, version=ver).first()
            if not vobj:
                vobj = TestCaseVersion.objects.create(
                    testcase=testcase,
                    version=ver,
                    title=testcase.title,
                    description=testcase.description,
                    steps=testcase.steps,
                    expected=[],
                )
            testcase_version = vobj
        # Assign order to end of list
        plan = data['plan']
        max_order = PlanItem.objects.filter(plan=plan).aggregate(m=Max('order'))['m'] or 0
        serializer.save(testcase_version=testcase_version, order=max_order + 1)

    @action(detail=True, methods=['post'])
    def move(self, request, pk=None):
        obj = self.get_object()
        try:
            new_pos = int(request.data.get('order'))
        except Exception:
            return Response({'detail': 'Invalid order'}, status=status.HTTP_400_BAD_REQUEST)
        if new_pos < 1:
            new_pos = 1
        with transaction.atomic():
            items = list(self.get_queryset().filter(plan_id=obj.plan_id).order_by('order', 'id'))
            items = [it for it in items if it.id != obj.id]
            if new_pos > len(items) + 1:
                new_pos = len(items) + 1
            items.insert(new_pos - 1, obj)
            for idx, it in enumerate(items, start=1):
                if it.order != idx:
                    it.order = idx
                    it.save(update_fields=['order'])
        obj.refresh_from_db()
        return Response(self.get_serializer(obj).data)


class TestRunViewSet(viewsets.ModelViewSet):
    queryset = TestRun.objects.select_related('project', 'plan').all().order_by('id')
    serializer_class = TestRunSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantRBACPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['project', 'plan', 'status', 'is_automation']
    search_fields = ['name']
    ordering_fields = ['id', 'name', 'created_at', 'started_at']
    allowed_roles_write = ('owner', 'admin')
    allowed_roles_create = ('owner', 'admin', 'member')
    allowed_roles_update = ('owner', 'admin')
    allowed_roles_delete = ('owner', 'admin')
    allowed_roles_actions = {
        'schedule': ('owner', 'admin', 'member'),
        'start': ('owner', 'admin', 'member'),
        'finish': ('owner', 'admin'),
        'cancel': ('owner', 'admin'),
        'results': ('owner', 'admin', 'member'),
    }
    pagination_class = CreatedAtCursorPagination

    def get_queryset(self):
        qs = super().get_queryset()
        tenant_id = getattr(self.request, 'tenant_id', None)
        if tenant_id:
            qs = qs.filter(project__tenant_id=tenant_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by_user_id=getattr(self.request.user, 'id', None))

    def _ensure_instances(self, run: TestRun):
        if run.instances.exists():
            return
        items = []
        if run.plan_id:
            items = list(PlanItem.objects.filter(plan_id=run.plan_id).select_related('testcase', 'testcase_version').order_by('order', 'id'))
        with transaction.atomic():
            for idx, it in enumerate(items, start=1):
                tc = it.testcase
                vobj = it.testcase_version
                if not vobj:
                    ver = tc.version
                    vobj = TestCaseVersion.objects.filter(testcase=tc, version=ver).first()
                    if not vobj:
                        vobj = TestCaseVersion.objects.create(
                            testcase=tc,
                            version=ver,
                            title=tc.title,
                            description=tc.description,
                            steps=tc.steps,
                            expected=[],
                        )
                TestInstance.objects.create(
                    run=run,
                    testcase=tc,
                    testcase_version=vobj,
                    order=idx,
                    automation_ref=(tc.automation_ref or ''),
                )

    @action(detail=True, methods=['post'])
    def schedule(self, request, pk=None):
        run = self.get_object()
        when = request.data.get('scheduled_at')
        if when:
            try:
                # Let DRF parse? fallback to now
                run.scheduled_at = when
            except Exception:
                run.scheduled_at = timezone.now()
        else:
            run.scheduled_at = timezone.now()
        run.save(update_fields=['scheduled_at'])
        return Response(self.get_serializer(run).data)

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        run = self.get_object()
        if run.status not in ('planned', 'paused'):
            return Response({'detail': 'Invalid status transition'}, status=400)
        self._ensure_instances(run)
        run.status = 'running'
        run.started_at = timezone.now()
        run.save(update_fields=['status', 'started_at'])
        return Response(self.get_serializer(run).data)

    @action(detail=True, methods=['post'])
    def finish(self, request, pk=None):
        run = self.get_object()
        if run.status not in ('running', 'paused', 'planned'):
            return Response({'detail': 'Invalid status transition'}, status=400)
        run.status = 'completed'
        run.finished_at = timezone.now()
        run.save(update_fields=['status', 'finished_at'])
        return Response(self.get_serializer(run).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        run = self.get_object()
        if run.status in ('completed', 'canceled'):
            return Response({'detail': 'Already finished'}, status=400)
        run.status = 'canceled'
        run.finished_at = timezone.now()
        run.save(update_fields=['status', 'finished_at'])
        return Response(self.get_serializer(run).data)

    @action(detail=True, methods=['post'])
    def results(self, request, pk=None):
        run = self.get_object()
        results = request.data.get('results')
        if not isinstance(results, list):
            return Response({'detail': 'results must be a list'}, status=400)
        updated = 0
        for item in results:
            if not isinstance(item, dict):
                continue
            aref = item.get('automation_ref')
            if not aref:
                continue
            inst = run.instances.filter(automation_ref=aref).first()
            if not inst:
                continue
            status_val = item.get('status')
            if status_val in ('in_progress', 'blocked', 'passed', 'failed', 'skipped'):
                inst.status = status_val
            ar = item.get('actual_result')
            if isinstance(ar, str):
                inst.actual_result = ar
            defects = item.get('defects')
            if isinstance(defects, list):
                inst.defects = defects
            now = timezone.now()
            if inst.status in ('passed', 'failed', 'skipped', 'blocked'):
                if not inst.started_at:
                    inst.started_at = now
                inst.finished_at = now
                inst.duration_seconds = int((inst.finished_at - inst.started_at).total_seconds())
            inst.save()
            updated += 1
        return Response({'updated': updated})


class TestInstanceViewSet(viewsets.ModelViewSet):
    queryset = TestInstance.objects.select_related('run', 'testcase', 'testcase_version').all().order_by('id')
    serializer_class = TestInstanceSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantRBACPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['run', 'status', 'assignee_user_id', 'testcase']
    ordering_fields = ['order', 'id', 'started_at']
    allowed_roles_write = ('owner', 'admin')
    allowed_roles_create = ('owner', 'admin', 'member')
    allowed_roles_update = ('owner', 'admin', 'member')
    allowed_roles_delete = ('owner', 'admin')
    allowed_roles_actions = {
        'assign': ('owner', 'admin', 'member'),
        'unassign': ('owner', 'admin', 'member'),
        'start': ('owner', 'admin', 'member'),
        'pass_case': ('owner', 'admin', 'member'),
        'fail_case': ('owner', 'admin', 'member'),
        'block': ('owner', 'admin', 'member'),
        'skip': ('owner', 'admin', 'member'),
        'link_defect': ('owner', 'admin', 'member'),
    }

    def get_queryset(self):
        qs = super().get_queryset()
        tenant_id = getattr(self.request, 'tenant_id', None)
        if tenant_id:
            qs = qs.filter(run__project__tenant_id=tenant_id)
        return qs

    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        inst = self.get_object()
        uid = request.data.get('assignee_user_id')
        try:
            uid = int(uid)
        except Exception:
            return Response({'detail': 'assignee_user_id required'}, status=400)
        inst.assignee_user_id = uid
        inst.save(update_fields=['assignee_user_id'])
        return Response(self.get_serializer(inst).data)

    @action(detail=True, methods=['post'])
    def unassign(self, request, pk=None):
        inst = self.get_object()
        inst.assignee_user_id = None
        inst.save(update_fields=['assignee_user_id'])
        return Response(self.get_serializer(inst).data)

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        inst = self.get_object()
        now = timezone.now()
        inst.status = 'in_progress'
        inst.started_at = inst.started_at or now
        inst.save(update_fields=['status', 'started_at'])
        return Response(self.get_serializer(inst).data)

    def _finish(self, inst: TestInstance, status_val: str):
        now = timezone.now()
        inst.status = status_val
        if not inst.started_at:
            inst.started_at = now
        inst.finished_at = now
        inst.duration_seconds = int((inst.finished_at - inst.started_at).total_seconds())
        inst.save(update_fields=['status', 'finished_at', 'started_at', 'duration_seconds'])

    @action(detail=True, methods=['post'])
    def pass_case(self, request, pk=None):
        inst = self.get_object()
        self._finish(inst, 'passed')
        return Response(self.get_serializer(inst).data)

    @action(detail=True, methods=['post'])
    def fail_case(self, request, pk=None):
        inst = self.get_object()
        ar = request.data.get('actual_result')
        if isinstance(ar, str):
            inst.actual_result = ar
            inst.save(update_fields=['actual_result'])
        self._finish(inst, 'failed')
        return Response(self.get_serializer(inst).data)

    @action(detail=True, methods=['post'])
    def block(self, request, pk=None):
        inst = self.get_object()
        self._finish(inst, 'blocked')
        return Response(self.get_serializer(inst).data)


class TestImportJobViewSet(mixins.CreateModelMixin,
                           mixins.ListModelMixin,
                           mixins.RetrieveModelMixin,
                           viewsets.GenericViewSet):
    queryset = TestImportJob.objects.select_related('project').all().order_by('-created_at')
    serializer_class = TestImportJobSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantRBACPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['project', 'status']
    ordering_fields = ['created_at', 'status']
    allowed_roles_create = ('owner', 'admin')
    allowed_roles_write = ('owner', 'admin')

    def get_queryset(self):
        qs = super().get_queryset()
        tenant_id = getattr(self.request, 'tenant_id', None)
        if tenant_id:
            qs = qs.filter(project__tenant_id=tenant_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by_user_id=getattr(self.request.user, 'id', None))
        # TODO: enqueue Celery task to process the import file


class TestExportJobViewSet(mixins.CreateModelMixin,
                           mixins.ListModelMixin,
                           mixins.RetrieveModelMixin,
                           viewsets.GenericViewSet):
    queryset = TestExportJob.objects.select_related('project').all().order_by('-created_at')
    serializer_class = TestExportJobSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantRBACPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['project', 'status']
    ordering_fields = ['created_at', 'status']
    allowed_roles_create = ('owner', 'admin')
    allowed_roles_write = ('owner', 'admin')

    def get_queryset(self):
        qs = super().get_queryset()
        tenant_id = getattr(self.request, 'tenant_id', None)
        if tenant_id:
            qs = qs.filter(project__tenant_id=tenant_id)
        return qs

    def perform_create(self, serializer):
        job = serializer.save(created_by_user_id=getattr(self.request.user, 'id', None))
        _process_export_job(job)


def _resolve_path(base_setting, default_subdir, provided_path=None):
    root = Path(getattr(settings, base_setting, Path(settings.BASE_DIR) / default_subdir))
    root.mkdir(parents=True, exist_ok=True)
    if provided_path:
        path = Path(provided_path)
        if not path.is_absolute():
            path = root / path
        return path
    return root


def _parse_steps(raw_value):
    if not raw_value:
        return []
    if isinstance(raw_value, list):
        return raw_value
    try:
        parsed = json.loads(raw_value)
        if isinstance(parsed, list):
            return parsed
    except Exception:
        pass
    steps = [text.strip() for text in str(raw_value).splitlines() if text.strip()]
    return [{'order': idx + 1, 'action': step, 'expected': ''} for idx, step in enumerate(steps)]


def _ensure_section(project, section_name):
    if not section_name:
        return None
    section_name = section_name.strip()
    if not section_name:
        return None
    section, _ = TestSection.objects.get_or_create(project=project, parent=None, name=section_name)
    return section


def _process_import_job(job: TestImportJob):
    job.status = 'processing'
    job.error_message = ''
    job.total_records = 0
    job.processed_records = 0
    job.save(update_fields=['status', 'error_message', 'total_records', 'processed_records'])
    path = _resolve_path('TEST_MANAGER_IMPORT_ROOT', 'imports', job.file_path)
    try:
        project = job.project
        if not path.exists():
            raise FileNotFoundError(f'Import file not found: {path}')
        with path.open(newline='', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            total = 0
            processed = 0
            for row in reader:
                total += 1
                title = (row.get('title') or '').strip()
                if not title:
                    continue
                priority = (row.get('priority') or 'medium').lower()
                if priority not in dict(TestCase.PRIORITY_CHOICES):
                    priority = 'medium'
                section = _ensure_section(project, row.get('section'))
                steps_payload = _parse_steps(row.get('steps') or row.get('steps_json'))
                description = row.get('description') or ''
                tags = [tag.strip() for tag in (row.get('tags') or '').split(',') if tag.strip()]
                testcase = TestCase.objects.create(
                    project=project,
                    section=section,
                    title=title,
                    description=description,
                    priority=priority,
                    steps=steps_payload,
                    tags=tags,
                )
                processed += 1
            job.total_records = total
            job.processed_records = processed
            job.status = 'completed'
            job.finished_at = timezone.now()
            job.save(update_fields=['total_records', 'processed_records', 'status', 'finished_at'])
    except Exception as exc:
        job.status = 'failed'
        job.error_message = str(exc)
        job.finished_at = timezone.now()
        job.save(update_fields=['status', 'error_message', 'finished_at'])


def _process_export_job(job: TestExportJob):
    job.status = 'processing'
    job.error_message = ''
    job.save(update_fields=['status', 'error_message'])
    try:
        qs = TestCase.objects.filter(project=job.project).select_related('section')
        filters = job.query or {}
        section = filters.get('section')
        if section:
            qs = qs.filter(section_id=section)
        status_filter = filters.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        priority = filters.get('priority')
        if priority:
            qs = qs.filter(priority=priority)

        export_root = _resolve_path('TEST_MANAGER_EXPORT_ROOT', 'exports')
        filename = job.file_path or f'testcases_export_{job.id}.csv'
        path = _resolve_path('TEST_MANAGER_EXPORT_ROOT', 'exports', filename)
        with path.open('w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(['title', 'description', 'priority', 'status', 'section', 'steps'])
            for testcase in qs.order_by('id'):
                steps_serialized = json.dumps(testcase.steps)
                writer.writerow([
                    testcase.title,
                    testcase.description,
                    testcase.priority,
                    testcase.status,
                    testcase.section.name if testcase.section else '',
                    steps_serialized,
                ])
        job.file_path = str(path)
        job.status = 'completed'
        job.finished_at = timezone.now()
        job.save(update_fields=['file_path', 'status', 'finished_at'])
    except Exception as exc:
        job.status = 'failed'
        job.error_message = str(exc)
        job.finished_at = timezone.now()
        job.save(update_fields=['status', 'error_message', 'finished_at'])

    @action(detail=True, methods=['post'])
    def skip(self, request, pk=None):
        inst = self.get_object()
        self._finish(inst, 'skipped')
        return Response(self.get_serializer(inst).data)

    @action(detail=True, methods=['post'])
    def link_defect(self, request, pk=None):
        inst = self.get_object()
        bug_url = request.data.get('url') or request.data.get('bug_url')
        if not bug_url:
            return Response({'detail': 'url or bug_url required'}, status=400)
        defect_entry = {
            'url': bug_url,
            'title': request.data.get('title', ''),
            'note': request.data.get('note', ''),
            'linked_at': timezone.now().isoformat(),
        }
        defects = inst.defects or []
        defects.append(defect_entry)
        inst.defects = defects
        inst.save(update_fields=['defects'])
        return Response(self.get_serializer(inst).data)

    @action(detail=True, methods=['post'])
    def link_defect(self, request, pk=None):
        inst = self.get_object()
        defect = request.data.get('defect')
        if not defect:
            return Response({'detail': 'defect required'}, status=400)
        defects = list(inst.defects or [])
        defects.append(defect)
        inst.defects = defects
        inst.save(update_fields=['defects'])
        return Response(self.get_serializer(inst).data)
