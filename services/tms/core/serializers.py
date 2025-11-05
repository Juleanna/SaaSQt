from rest_framework import serializers
from .models import (
    Project,
    TestCase,
    Suite,
    SuiteCase,
    Release,
    TestCaseVersion,
    TestPlan,
    PlanItem,
    TestRun,
    TestInstance,
)


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ['id', 'tenant_id', 'key', 'name', 'created_at', 'updated_at']


class TestCaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestCase
        fields = ['id', 'project', 'title', 'description', 'steps', 'tags', 'status', 'version', 'created_at', 'updated_at']


class SuiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Suite
        fields = ['id', 'project', 'name', 'created_at', 'updated_at']


class SuiteCaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = SuiteCase
        fields = ['id', 'suite', 'test_case', 'order']


class ReleaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Release
        fields = ['id', 'project', 'name', 'version', 'due_date', 'created_at', 'updated_at']


class TestCaseVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestCaseVersion
        fields = ['id', 'testcase', 'version', 'title', 'description', 'steps', 'expected', 'created_at']
        read_only_fields = ['version', 'created_at']


class TestPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestPlan
        fields = [
            'id', 'project', 'name', 'description', 'release', 'created_by_user_id', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_by_user_id', 'created_at', 'updated_at']


class PlanItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanItem
        fields = ['id', 'plan', 'testcase', 'testcase_version', 'order']
        read_only_fields = ['order']


class TestRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestRun
        fields = [
            'id', 'project', 'plan', 'name', 'status', 'scheduled_at', 'started_at', 'finished_at',
            'is_automation', 'created_by_user_id', 'created_at'
        ]
        read_only_fields = ['status', 'started_at', 'finished_at', 'created_by_user_id', 'created_at']


class TestInstanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestInstance
        fields = [
            'id', 'run', 'testcase', 'testcase_version', 'assignee_user_id', 'status', 'actual_result',
            'defects', 'duration_seconds', 'automation_ref', 'started_at', 'finished_at', 'order'
        ]
        read_only_fields = ['duration_seconds', 'started_at', 'finished_at', 'order']
