from rest_framework import permissions
from django.conf import settings
import requests
from jose import jwt
import time


def _fetch_memberships(tenant_id: int, user_id: int):
    if not tenant_id:
        return []
    base = getattr(settings, 'ORGS_BASE_URL', 'http://orgs:8000/api')
    url = f"{base.rstrip('/')}/memberships/"
    headers = {}
    # Prefer RS256 token from Auth; fallback to HS or shared token
    try:
        auth_base = getattr(settings, 'AUTH_BASE_URL', 'http://auth:8000/api')
        svc = getattr(settings, 'ORGS_SERVICE_TOKEN', None)
        if svc and auth_base:
            import requests as _rq
            r = _rq.post(f"{auth_base.rstrip('/')}/service/token", json={'aud':'orgs','sub':'tms'}, headers={'Authorization': f'Service {svc}'}, timeout=3)
            if r.status_code == 200:
                token = r.json().get('token')
                if token:
                    headers['Authorization'] = f"ServiceBearer {token}"
    except Exception:
        pass
    if 'Authorization' not in headers:
        svc_secret = getattr(settings, 'SERVICES_JWT_SECRET', None)
        issuer = getattr(settings, 'SERVICES_JWT_ISSUER', 'tms')
        audience = getattr(settings, 'SERVICES_JWT_AUDIENCE', 'orgs')
        if svc_secret:
            claims = {'iss':issuer,'aud':audience,'sub':'tms','iat':int(time.time()),'exp':int(time.time())+60}
            token = jwt.encode(claims, svc_secret, algorithm='HS256')
            headers['Authorization'] = f"ServiceBearer {token}"
        else:
            svc = getattr(settings, 'ORGS_SERVICE_TOKEN', None)
            if svc:
                headers['Authorization'] = f"Service {svc}"
    try:
        params = {'tenant': tenant_id, 'user_id': user_id}
        resp = requests.get(url, params=params, headers=headers, timeout=3)
        if resp.status_code != 200:
            return []
        data = resp.json()
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            # DRF pagination style
            results = data.get('results')
            if isinstance(results, list):
                return results
            count = data.get('count')
            if isinstance(count, int):
                return [] if count == 0 else results or []
        return []
    except Exception:
        return []


def _has_membership(request, tenant_id: int) -> bool:
    user_id = getattr(request.user, 'id', None)
    if not tenant_id or not user_id:
        return False
    items = _fetch_memberships(tenant_id, user_id)
    # Ensure tenant match
    items = [it for it in items if isinstance(it, dict) and it.get('tenant') == tenant_id]
    return len(items) > 0


def _role_keys(request, tenant_id: int):
    user_id = getattr(request.user, 'id', None)
    items = _fetch_memberships(tenant_id, user_id)
    items = [it for it in items if isinstance(it, dict) and it.get('tenant') == tenant_id]
    keys = set()
    for it in items:
        rk = it.get('role_key') if isinstance(it, dict) else None
        if rk:
            keys.add(rk)
    return keys


class IsTenantMember(permissions.BasePermission):
    message = 'Tenant membership required.'

    def has_permission(self, request, view):
        if view.basename == 'project' and request.method in ('POST',):
            tenant_id = request.data.get('tenant_id')
            return _has_membership(request, tenant_id)
        managed_basenames = ('testcase', 'suite', 'suitecase', 'release', 'testplan', 'planitem',
                             'testrun', 'testinstance', 'section', 'testtag', 'requirement',
                             'importjob', 'exportjob')
        if view.basename in managed_basenames and request.method in ('POST',):
            # For create we need to resolve project -> tenant_id
            from .models import Project, TestPlan, TestRun
            project_id = request.data.get('project')
            if not project_id:
                # Try resolve via plan -> project
                plan_id = request.data.get('plan')
                if plan_id:
                    try:
                        pl = TestPlan.objects.get(id=plan_id)
                        return _has_membership(request, pl.project.tenant_id)
                    except TestPlan.DoesNotExist:
                        return False
                # Try resolve via run -> project (for instances)
                run_id = request.data.get('run')
                if run_id:
                    try:
                        r = TestRun.objects.select_related('project').get(id=run_id)
                        return _has_membership(request, r.project.tenant_id)
                    except TestRun.DoesNotExist:
                        return False
                return False
            try:
                p = Project.objects.get(id=project_id)
                return _has_membership(request, p.tenant_id)
            except Project.DoesNotExist:
                return False
        return True

    def has_object_permission(self, request, view, obj):
        # obj may be Project, TestCase, Suite, SuiteCase, Release, TestPlan, PlanItem, TestRun, TestInstance
        from .models import (
            Project, TestCase, Suite, SuiteCase, Release, TestPlan, PlanItem, TestRun, TestInstance,
            TestSection, TestTag, Requirement, TestImportJob, TestExportJob
        )
        tenant_id = None
        if isinstance(obj, Project):
            tenant_id = obj.tenant_id
        elif isinstance(obj, TestCase):
            tenant_id = obj.project.tenant_id
        elif isinstance(obj, Suite):
            tenant_id = obj.project.tenant_id
        elif isinstance(obj, SuiteCase):
            tenant_id = obj.suite.project.tenant_id
        elif isinstance(obj, Release):
            tenant_id = obj.project.tenant_id
        elif isinstance(obj, TestPlan):
            tenant_id = obj.project.tenant_id
        elif isinstance(obj, PlanItem):
            tenant_id = obj.plan.project.tenant_id
        elif isinstance(obj, TestRun):
            tenant_id = obj.project.tenant_id
        elif isinstance(obj, TestInstance):
            tenant_id = obj.run.project.tenant_id
        elif isinstance(obj, TestSection):
            tenant_id = obj.project.tenant_id
        elif isinstance(obj, TestTag):
            tenant_id = obj.project.tenant_id
        elif isinstance(obj, Requirement):
            tenant_id = obj.project.tenant_id
        elif isinstance(obj, TestImportJob):
            tenant_id = obj.project.tenant_id
        elif isinstance(obj, TestExportJob):
            tenant_id = obj.project.tenant_id
        return _has_membership(request, tenant_id)


class TenantRBACPermission(permissions.BasePermission):
    message = 'Insufficient role.'

    def has_permission(self, request, view):
        method = request.method.upper()
        if request.method in permissions.SAFE_METHODS:
            # Allow listing/reads; data still scoped by tenant middleware.
            return True
        # Determine tenant context
        tenant_id = getattr(request, 'tenant_id', None)
        if view.basename == 'project' and method in ('POST',):
            tenant_id = tenant_id or request.data.get('tenant_id')
        elif view.basename in ('testcase', 'suite', 'suitecase', 'section', 'testtag', 'requirement', 'importjob', 'exportjob') and method in ('POST',):
            project_id = request.data.get('project')
            if project_id:
                from .models import Project
                try:
                    p = Project.objects.get(id=project_id)
                    tenant_id = tenant_id or p.tenant_id
                    # Prefer project-level roles if available
                    proj_roles = _project_role_keys(request, tenant_id, p.id)
                    if proj_roles:
                        action = getattr(view, 'action', None)
                        allowed = None
                        if action and hasattr(view, 'allowed_roles_actions'):
                            allowed = view.allowed_roles_actions.get(action)
                        if not allowed:
                            if method == 'POST':
                                allowed = getattr(view, 'allowed_roles_create', getattr(view, 'allowed_roles_write', ('owner', 'admin')))
                            elif method in ('PUT', 'PATCH'):
                                allowed = getattr(view, 'allowed_roles_update', getattr(view, 'allowed_roles_write', ('owner', 'admin')))
                            elif method == 'DELETE':
                                allowed = getattr(view, 'allowed_roles_delete', getattr(view, 'allowed_roles_write', ('owner', 'admin')))
                            else:
                                allowed = getattr(view, 'allowed_roles_write', ('owner', 'admin'))
                        return any(r in proj_roles for r in allowed)
                except Project.DoesNotExist:
                    return False
        if not tenant_id:
            return False
        # Action-specific override
        allowed = None
        action = getattr(view, 'action', None)
        if action and hasattr(view, 'allowed_roles_actions'):
            allowed = view.allowed_roles_actions.get(action)
        if not allowed:
            if method == 'POST':
                allowed = getattr(view, 'allowed_roles_create', getattr(view, 'allowed_roles_write', ('owner', 'admin')))
            elif method in ('PUT', 'PATCH'):
                allowed = getattr(view, 'allowed_roles_update', getattr(view, 'allowed_roles_write', ('owner', 'admin')))
            elif method == 'DELETE':
                allowed = getattr(view, 'allowed_roles_delete', getattr(view, 'allowed_roles_write', ('owner', 'admin')))
            else:
                allowed = getattr(view, 'allowed_roles_write', ('owner', 'admin'))
        roles = _role_keys(request, tenant_id)
        return any(r in roles for r in allowed)

    def has_object_permission(self, request, view, obj):
        from .models import (
            Project, TestCase, Suite, SuiteCase,
            Release, TestPlan, PlanItem, TestRun, TestInstance,
            TestSection, TestTag, Requirement, TestImportJob, TestExportJob
        )
        tenant_id = None
        if isinstance(obj, Project):
            tenant_id = obj.tenant_id
        elif isinstance(obj, TestCase):
            tenant_id = obj.project.tenant_id
        elif isinstance(obj, Suite):
            tenant_id = obj.project.tenant_id
        elif isinstance(obj, SuiteCase):
            tenant_id = obj.suite.project.tenant_id
        elif isinstance(obj, Release):
            tenant_id = obj.project.tenant_id
        elif isinstance(obj, TestPlan):
            tenant_id = obj.project.tenant_id
        elif isinstance(obj, PlanItem):
            tenant_id = obj.plan.project.tenant_id
        elif isinstance(obj, TestRun):
            tenant_id = obj.project.tenant_id
        elif isinstance(obj, TestInstance):
            tenant_id = obj.run.project.tenant_id
        elif isinstance(obj, TestSection):
            tenant_id = obj.project.tenant_id
        elif isinstance(obj, TestTag):
            tenant_id = obj.project.tenant_id
        elif isinstance(obj, Requirement):
            tenant_id = obj.project.tenant_id
        elif isinstance(obj, TestImportJob):
            tenant_id = obj.project.tenant_id
        elif isinstance(obj, TestExportJob):
            tenant_id = obj.project.tenant_id
        if not tenant_id:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        method = request.method.upper()
        allowed = None
        action = getattr(view, 'action', None)
        if action and hasattr(view, 'allowed_roles_actions'):
            allowed = view.allowed_roles_actions.get(action)
        if not allowed:
            if method == 'POST':
                allowed = getattr(view, 'allowed_roles_create', getattr(view, 'allowed_roles_write', ('owner', 'admin')))
            elif method in ('PUT', 'PATCH'):
                allowed = getattr(view, 'allowed_roles_update', getattr(view, 'allowed_roles_write', ('owner', 'admin')))
            elif method == 'DELETE':
                allowed = getattr(view, 'allowed_roles_delete', getattr(view, 'allowed_roles_write', ('owner', 'admin')))
            else:
                allowed = getattr(view, 'allowed_roles_write', ('owner', 'admin'))
        # Prefer project-level roles on object if available
        proj_roles = set()
        if isinstance(obj, Project):
            proj_roles = _project_role_keys(request, tenant_id, obj.id)
        elif isinstance(obj, TestCase):
            proj_roles = _project_role_keys(request, tenant_id, obj.project_id)
        elif isinstance(obj, Suite):
            proj_roles = _project_role_keys(request, tenant_id, obj.project_id)
        elif isinstance(obj, SuiteCase):
            proj_roles = _project_role_keys(request, tenant_id, obj.suite.project_id)
        elif isinstance(obj, Release):
            proj_roles = _project_role_keys(request, tenant_id, obj.project_id)
        elif isinstance(obj, TestPlan):
            proj_roles = _project_role_keys(request, tenant_id, obj.project_id)
        elif isinstance(obj, PlanItem):
            proj_roles = _project_role_keys(request, tenant_id, obj.plan.project_id)
        elif isinstance(obj, TestRun):
            proj_roles = _project_role_keys(request, tenant_id, obj.project_id)
        elif isinstance(obj, TestInstance):
            proj_roles = _project_role_keys(request, tenant_id, obj.run.project_id)
        elif isinstance(obj, TestSection):
            proj_roles = _project_role_keys(request, tenant_id, obj.project_id)
        elif isinstance(obj, TestTag):
            proj_roles = _project_role_keys(request, tenant_id, obj.project_id)
        elif isinstance(obj, Requirement):
            proj_roles = _project_role_keys(request, tenant_id, obj.project_id)
        elif isinstance(obj, TestImportJob):
            proj_roles = _project_role_keys(request, tenant_id, obj.project_id)
        elif isinstance(obj, TestExportJob):
            proj_roles = _project_role_keys(request, tenant_id, obj.project_id)
        if proj_roles:
            return any(r in proj_roles for r in allowed)
        roles = _role_keys(request, tenant_id)
        return any(r in roles for r in allowed)
