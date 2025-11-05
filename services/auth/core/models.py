from django.db import models


class ServiceKey(models.Model):
    kid = models.CharField(max_length=100, unique=True)
    private_pem = models.TextField()
    public_jwk = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    # When not null and in the past, key considered expired but may remain published during grace
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['kid']),
            models.Index(fields=['created_at']),
        ]

