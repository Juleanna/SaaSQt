from django.db import models


class Project(models.Model):
    tenant_id = models.BigIntegerField()
    key = models.CharField(max_length=20)
    name = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('tenant_id', 'key')
        indexes = [
            models.Index(fields=['tenant_id']),
            models.Index(fields=['tenant_id', 'key']),
        ]


class TestCase(models.Model):
    STATUS_CHOICES = (
        ('active', 'Active'),
        ('archived', 'Archived'),
    )
    project = models.ForeignKey(Project, related_name='test_cases', on_delete=models.CASCADE)
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True, default='')
    steps = models.JSONField(default=list, blank=True)
    tags = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    version = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # Automation linkage
    is_automated = models.BooleanField(default=False)
    automation_type = models.CharField(max_length=50, blank=True, default='')
    automation_ref = models.CharField(max_length=200, blank=True, default='')
    class Meta:
        indexes = [
            models.Index(fields=['project']),
            models.Index(fields=['status']),
            models.Index(fields=['project', 'status']),
        ]


class Suite(models.Model):
    project = models.ForeignKey(Project, related_name='suites', on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        indexes = [
            models.Index(fields=['project']),
        ]


class SuiteCase(models.Model):
    suite = models.ForeignKey(Suite, related_name='suite_cases', on_delete=models.CASCADE)
    test_case = models.ForeignKey(TestCase, related_name='in_suites', on_delete=models.CASCADE)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ('suite', 'test_case')
        indexes = [
            models.Index(fields=['suite', 'order']),
            models.Index(fields=['test_case']),
        ]


class Release(models.Model):
    project = models.ForeignKey(Project, related_name='releases', on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    version = models.CharField(max_length=50, blank=True, default='')
    due_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('project', 'name')
        indexes = [
            models.Index(fields=['project']),
            models.Index(fields=['project', 'name']),
        ]


class TestCaseVersion(models.Model):
    testcase = models.ForeignKey(TestCase, related_name='versions', on_delete=models.CASCADE)
    version = models.IntegerField()
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True, default='')
    steps = models.JSONField(default=list, blank=True)
    expected = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('testcase', 'version')
        indexes = [
            models.Index(fields=['testcase', 'version']),
        ]


class TestPlan(models.Model):
    project = models.ForeignKey(Project, related_name='plans', on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    release = models.ForeignKey(Release, related_name='plans', on_delete=models.SET_NULL, null=True, blank=True)
    created_by_user_id = models.BigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['project']),
            models.Index(fields=['project', 'name']),
        ]


class PlanItem(models.Model):
    plan = models.ForeignKey(TestPlan, related_name='items', on_delete=models.CASCADE)
    testcase = models.ForeignKey(TestCase, related_name='plan_items', on_delete=models.CASCADE)
    testcase_version = models.ForeignKey(TestCaseVersion, related_name='plan_items', on_delete=models.SET_NULL, null=True, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ('plan', 'testcase')
        indexes = [
            models.Index(fields=['plan', 'order']),
        ]


class TestRun(models.Model):
    STATUS_CHOICES = (
        ('planned', 'Planned'),
        ('running', 'Running'),
        ('paused', 'Paused'),
        ('completed', 'Completed'),
        ('canceled', 'Canceled'),
    )
    project = models.ForeignKey(Project, related_name='runs', on_delete=models.CASCADE)
    plan = models.ForeignKey(TestPlan, related_name='runs', on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='planned')
    scheduled_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    is_automation = models.BooleanField(default=False)
    created_by_user_id = models.BigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['project']),
            models.Index(fields=['status']),
            models.Index(fields=['project', 'status']),
        ]


class TestInstance(models.Model):
    STATUS_CHOICES = (
        ('not_started', 'Not Started'),
        ('in_progress', 'In Progress'),
        ('blocked', 'Blocked'),
        ('passed', 'Passed'),
        ('failed', 'Failed'),
        ('skipped', 'Skipped'),
    )
    run = models.ForeignKey(TestRun, related_name='instances', on_delete=models.CASCADE)
    testcase = models.ForeignKey(TestCase, related_name='instances', on_delete=models.CASCADE)
    testcase_version = models.ForeignKey(TestCaseVersion, related_name='instances', on_delete=models.SET_NULL, null=True, blank=True)
    assignee_user_id = models.BigIntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='not_started')
    actual_result = models.TextField(blank=True, default='')
    defects = models.JSONField(default=list, blank=True)
    duration_seconds = models.IntegerField(null=True, blank=True)
    automation_ref = models.CharField(max_length=200, blank=True, default='')
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        indexes = [
            models.Index(fields=['run']),
            models.Index(fields=['status']),
            models.Index(fields=['run', 'status']),
            models.Index(fields=['automation_ref']),
        ]
