from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .permissions import IsTenantMember, TenantRBACPermission
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db import transaction
from django.db.models import Max
from .models import (
    Project, TestCase, Suite, SuiteCase,
    Release, TestCaseVersion, TestPlan, PlanItem, TestRun, TestInstance
)
from .serializers import (
    ProjectSerializer, TestCaseSerializer, SuiteSerializer, SuiteCaseSerializer,
    ReleaseSerializer, TestCaseVersionSerializer, TestPlanSerializer,
    PlanItemSerializer, TestRunSerializer, TestInstanceSerializer
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


class TestCaseViewSet(viewsets.ModelViewSet):
    queryset = TestCase.objects.select_related('project').all().order_by('id')
    serializer_class = TestCaseSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantRBACPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['project', 'status']
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

    @action(detail=True, methods=['post'])
    def skip(self, request, pk=None):
        inst = self.get_object()
        self._finish(inst, 'skipped')
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
