import os
from celery import Celery
from celery.schedules import crontab
from datetime import timedelta


os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth_service.settings')

app = Celery('auth_service')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()


def _every_hours(h: int):
    return timedelta(hours=h)


# Beat schedule: either at specific hour (UTC) or every N hours
rotate_hour = os.getenv('ROTATE_JWKS_CRON_HOUR')
rotate_hours = int(os.getenv('ROTATE_JWKS_EVERY_HOURS', '12'))

schedule = None
if rotate_hour is not None:
    try:
        h = int(rotate_hour)
        schedule = crontab(minute=0, hour=h)
    except Exception:
        schedule = None
if schedule is None and rotate_hours > 0:
    schedule = _every_hours(rotate_hours)

if schedule is not None:
    app.conf.beat_schedule = {
        'rotate-jwks-periodic': {
            'task': 'core.tasks.rotate_jwks_task',
            'schedule': schedule,
        }
    }

# Cleanup schedule: daily at CLEANUP_JWKS_CRON_HOUR (UTC) or every CLEANUP_JWKS_EVERY_HOURS
cleanup_hour = os.getenv('CLEANUP_JWKS_CRON_HOUR')
cleanup_hours = int(os.getenv('CLEANUP_JWKS_EVERY_HOURS', '24'))
cleanup_schedule = None
if cleanup_hour is not None:
    try:
        ch = int(cleanup_hour)
        cleanup_schedule = crontab(minute=30, hour=ch)
    except Exception:
        cleanup_schedule = None
if cleanup_schedule is None and cleanup_hours > 0:
    cleanup_schedule = _every_hours(cleanup_hours)

if cleanup_schedule is not None:
    app.conf.beat_schedule.update({
        'cleanup-jwks-periodic': {
            'task': 'core.tasks.cleanup_jwks_task',
            'schedule': cleanup_schedule,
        }
    })
