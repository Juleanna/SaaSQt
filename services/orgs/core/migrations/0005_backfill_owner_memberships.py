from django.db import migrations


def ensure_owner_memberships(apps, schema_editor):
    Tenant = apps.get_model('core', 'Tenant')
    Role = apps.get_model('core', 'Role')
    Membership = apps.get_model('core', 'Membership')

    for tenant in Tenant.objects.exclude(owner_user_id__isnull=True):
        owner_id = tenant.owner_user_id
        if owner_id is None:
            continue
        role, _ = Role.objects.get_or_create(
            tenant=tenant,
            key='owner',
            defaults={'name': 'Owner', 'description': 'Full access', 'is_system': True},
        )
        Membership.objects.get_or_create(
            tenant=tenant,
            user_id=owner_id,
            defaults={'role': role},
        )


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0004_more_indexes'),
    ]

    operations = [
        migrations.RunPython(ensure_owner_memberships, migrations.RunPython.noop),
    ]
