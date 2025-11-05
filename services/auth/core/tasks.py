from celery import shared_task
from .service_keys import rotate
from .models import ServiceKey
from django.utils import timezone
import os


@shared_task(name='core.tasks.rotate_jwks_task')
def rotate_jwks_task():
    return rotate()


@shared_task(name='core.tasks.cleanup_jwks_task')
def cleanup_jwks_task():
    # Політика очищення:
    # 1) Залишати мінімум N останніх ключів (за created_at), навіть якщо прострочені: SERVICE_JWKS_MIN_KEYS (деф. 2)
    # 2) Видаляти ключі, якщо вони: мають expires_at у минулому, і цей момент ще й давніший за Cache-Control JWKS
    #    (SERVICE_JWKS_MAX_AGE або SERVICE_JWKS_CACHE_GRACE_SECONDS), і давніший за глобальний retention.
    min_keys = int(os.getenv('SERVICE_JWKS_MIN_KEYS', '2'))
    retention_days = int(os.getenv('SERVICE_JWT_RETENTION_DAYS', '2'))
    cache_grace = int(os.getenv('SERVICE_JWKS_CACHE_GRACE_SECONDS', os.getenv('SERVICE_JWKS_MAX_AGE', '300')))

    now = timezone.now()
    cutoff_retention = now - timezone.timedelta(days=retention_days)
    cutoff_cache = now - timezone.timedelta(seconds=cache_grace)

    # Список id залишених (мінімум останні N)
    keep_ids = list(ServiceKey.objects.order_by('-created_at').values_list('id', flat=True)[:min_keys])

    qs = ServiceKey.objects.exclude(id__in=keep_ids).filter(expires_at__isnull=False)
    # Кандидати на видалення: прострочені по обох порогах
    delete_qs = qs.filter(expires_at__lt=cutoff_cache, created_at__lt=cutoff_retention).order_by('created_at')

    count = delete_qs.count()
    delete_qs.delete()
    return count
