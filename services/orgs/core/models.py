from django.db import models


class Tenant(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    owner_user_id = models.BigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.slug})"
    class Meta:
        indexes = [
            models.Index(fields=['slug']),
        ]


class Role(models.Model):
    tenant = models.ForeignKey(Tenant, related_name='roles', on_delete=models.CASCADE)
    key = models.CharField(max_length=50)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default='')
    is_system = models.BooleanField(default=False)

    class Meta:
        unique_together = ('tenant', 'key')
        indexes = [
            models.Index(fields=['tenant', 'key']),
        ]

    def __str__(self):
        return f"{self.tenant.slug}:{self.key}"


class Membership(models.Model):
    tenant = models.ForeignKey(Tenant, related_name='memberships', on_delete=models.CASCADE)
    user_id = models.BigIntegerField()
    role = models.ForeignKey(Role, related_name='members', on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('tenant', 'user_id')
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['tenant','user_id']),
        ]

    def __str__(self):
        return f"user:{self.user_id}@{self.tenant.slug}"


class Invitation(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('expired', 'Expired'),
        ('revoked', 'Revoked'),
    )
    tenant = models.ForeignKey(Tenant, related_name='invitations', on_delete=models.CASCADE)
    email = models.EmailField()
    role = models.ForeignKey(Role, related_name='invitations', on_delete=models.PROTECT, null=True, blank=True)
    token = models.CharField(max_length=64, unique=True)
    invited_by_user_id = models.BigIntegerField(null=True, blank=True)
    accepted_by_user_id = models.BigIntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"invite:{self.email}@{self.tenant.slug}"
    class Meta:
        indexes = [
            models.Index(fields=['tenant','email']),
            models.Index(fields=['token']),
        ]


class ProjectRole(models.Model):
    tenant = models.ForeignKey(Tenant, related_name='project_roles', on_delete=models.CASCADE)
    project_id = models.BigIntegerField()
    key = models.CharField(max_length=50)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default='')
    is_system = models.BooleanField(default=False)

    class Meta:
        unique_together = ('tenant', 'project_id', 'key')
        indexes = [
            models.Index(fields=['tenant','project_id']),
            models.Index(fields=['tenant','project_id','key']),
        ]


class ProjectMembership(models.Model):
    tenant = models.ForeignKey(Tenant, related_name='project_memberships', on_delete=models.CASCADE)
    project_id = models.BigIntegerField()
    user_id = models.BigIntegerField()
    role = models.ForeignKey(ProjectRole, related_name='members', on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('tenant', 'project_id', 'user_id')
        indexes = [
            models.Index(fields=['tenant','project_id']),
            models.Index(fields=['tenant','project_id','user_id']),
        ]
