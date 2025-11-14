from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.utils import timezone
import uuid
from .models import Tenant, Role, Membership, Invitation, ProjectRole, ProjectMembership
from .pagination import CreatedAtCursorPagination
from .serializers import (
    TenantSerializer, RoleSerializer, MembershipSerializer,
    InvitationSerializer, ProjectRoleSerializer, ProjectMembershipSerializer,
)


class TenantViewSet(viewsets.ModelViewSet):
    queryset = Tenant.objects.all().order_by('id')
    serializer_class = TenantSerializer
    permission_classes = [IsAuthenticated]
    throttle_classes = []
    pagination_class = CreatedAtCursorPagination

    def perform_create(self, serializer):
        user_id = getattr(self.request.user, 'id', None)
        with transaction.atomic():
            tenant = serializer.save(owner_user_id=user_id)
            default_roles = [
                {"key": "owner", "name": "Owner", "description": "Повний доступ", "is_system": True},
                {"key": "admin", "name": "Admin", "description": "Адміністрування без прав власника", "is_system": True},
                {"key": "member", "name": "Member", "description": "Звичайний учасник", "is_system": True},
            ]
            role_map = {}
            for data in default_roles:
                role, _ = Role.objects.get_or_create(
                    tenant=tenant,
                    key=data["key"],
                    defaults={
                        "name": data["name"],
                        "description": data.get("description", ""),
                        "is_system": data.get("is_system", False),
                    },
                )
                role_map[data["key"]] = role
            if user_id:
                owner_role = role_map.get("owner")
                Membership.objects.get_or_create(tenant=tenant, user_id=user_id, defaults={"role": owner_role})
        return tenant

    @action(detail=True, methods=['post'])
    def seed_roles(self, request, pk=None):
        tenant = self.get_object()
        defaults = [
            {"key": "owner", "name": "Owner", "is_system": True},
            {"key": "admin", "name": "Admin", "is_system": True},
            {"key": "member", "name": "Member", "is_system": True},
        ]
        created = []
        with transaction.atomic():
            for d in defaults:
                r, _ = Role.objects.get_or_create(tenant=tenant, key=d["key"], defaults=d)
                created.append(r)
        return Response(RoleSerializer(created, many=True).data)


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.select_related('tenant').all().order_by('id')
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated]
    throttle_classes = []


class MembershipViewSet(viewsets.ModelViewSet):
    queryset = Membership.objects.select_related('tenant', 'role').all().order_by('id')
    serializer_class = MembershipSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['tenant', 'user_id', 'role']

    def get_queryset(self):
        qs = super().get_queryset()
        q = self.request.query_params
        tenant = q.get('tenant')
        user_id = q.get('user_id')
        role = q.get('role')
        if tenant:
            qs = qs.filter(tenant_id=tenant)
        if user_id:
            qs = qs.filter(user_id=user_id)
        if role:
            qs = qs.filter(role_id=role)
        return qs
    throttle_classes = []
    pagination_class = CreatedAtCursorPagination


class InvitationViewSet(viewsets.ModelViewSet):
    queryset = Invitation.objects.select_related('tenant', 'role').all().order_by('-created_at')
    serializer_class = InvitationSerializer
    permission_classes = [IsAuthenticated]
    throttle_classes = []
    pagination_class = CreatedAtCursorPagination

    def perform_create(self, serializer):
        token = uuid.uuid4().hex
        invited_by = getattr(self.request.user, 'id', None)
        expires = timezone.now() + timezone.timedelta(days=14)
        serializer.save(token=token, invited_by_user_id=invited_by, expires_at=expires)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        invite = self.get_object()
        if invite.status != 'pending':
            return Response({'detail': 'Invitation is not pending'}, status=status.HTTP_400_BAD_REQUEST)
        if invite.expires_at and invite.expires_at < timezone.now():
            invite.status = 'expired'
            invite.save(update_fields=['status'])
            return Response({'detail': 'Invitation expired'}, status=status.HTTP_400_BAD_REQUEST)
        user_id = getattr(request.user, 'id', None)
        # Validate email matches token claim if present
        token = getattr(request, 'auth', {})
        token_email = None
        try:
            token_email = token.get('email') if isinstance(token, dict) else None
        except Exception:
            token_email = None
        if token_email and token_email.lower() != invite.email.lower():
            return Response({'detail': 'Email does not match invitation', 'code': 'email_mismatch'}, status=status.HTTP_400_BAD_REQUEST)
        if not user_id:
            return Response({'detail': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)
        with transaction.atomic():
            if invite.role:
                role = invite.role
            else:
                role, _ = Role.objects.get_or_create(tenant=invite.tenant, key='member', defaults={'name': 'Member', 'is_system': True})
            Membership.objects.get_or_create(tenant=invite.tenant, user_id=user_id, defaults={'role': role})
            invite.status = 'accepted'
            invite.accepted_by_user_id = user_id
            invite.save(update_fields=['status', 'accepted_by_user_id'])
        return Response({'detail': 'Accepted'})

    @action(detail=True, methods=['post'])
    def resend(self, request, pk=None):
        invite = self.get_object()
        if invite.status not in ('pending',):
            return Response({'detail': 'Only pending invitations can be resent'}, status=status.HTTP_400_BAD_REQUEST)
        # regenerate token and extend expiration
        new_token = uuid.uuid4().hex
        invite.token = new_token
        invite.expires_at = timezone.now() + timezone.timedelta(days=14)
        invite.save(update_fields=['token', 'expires_at'])
        # In production, send email here.
        return Response({'detail': 'Resent', 'token': new_token, 'expires_at': invite.expires_at})


class ProjectRoleViewSet(viewsets.ModelViewSet):
    queryset = ProjectRole.objects.select_related('tenant').all().order_by('id')
    serializer_class = ProjectRoleSerializer
    permission_classes = [IsAuthenticated]
    throttle_classes = []


class ProjectMembershipViewSet(viewsets.ModelViewSet):
    queryset = ProjectMembership.objects.select_related('tenant', 'role').all().order_by('id')
    serializer_class = ProjectMembershipSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['tenant', 'project_id', 'user_id', 'role']

    def get_queryset(self):
        qs = super().get_queryset()
        q = self.request.query_params
        tenant = q.get('tenant')
        project_id = q.get('project_id')
        user_id = q.get('user_id')
        role = q.get('role')
        if tenant:
            qs = qs.filter(tenant_id=tenant)
        if project_id:
            qs = qs.filter(project_id=project_id)
        if user_id:
            qs = qs.filter(user_id=user_id)
        if role:
            qs = qs.filter(role_id=role)
        return qs
    throttle_classes = []
    pagination_class = CreatedAtCursorPagination
