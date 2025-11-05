from rest_framework import serializers
from .models import Tenant, Role, Membership
from .models import Invitation, ProjectRole, ProjectMembership


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = [
            'id', 'tenant', 'key', 'name', 'description', 'is_system'
        ]


class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = ['id', 'name', 'slug', 'owner_user_id', 'created_at', 'updated_at']


class MembershipSerializer(serializers.ModelSerializer):
    role_key = serializers.CharField(source='role.key', read_only=True)
    class Meta:
        model = Membership
        fields = ['id', 'tenant', 'user_id', 'role', 'role_key', 'created_at']


class InvitationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invitation
        fields = [
            'id', 'tenant', 'email', 'role', 'token', 'status', 'invited_by_user_id', 'accepted_by_user_id', 'created_at', 'expires_at'
        ]
        read_only_fields = ('token', 'status', 'invited_by_user_id', 'accepted_by_user_id', 'created_at')


class ProjectRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectRole
        fields = ['id', 'tenant', 'project_id', 'key', 'name', 'description', 'is_system']


class ProjectMembershipSerializer(serializers.ModelSerializer):
    role_key = serializers.CharField(source='role.key', read_only=True)
    class Meta:
        model = ProjectMembership
        fields = ['id', 'tenant', 'project_id', 'user_id', 'role', 'role_key', 'created_at']
