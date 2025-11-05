from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_invites_projectroles'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='tenant',
            options={'indexes': [models.Index(fields=['slug'], name='core_tenant_slug_idx')]},
        ),
        migrations.AlterModelOptions(
            name='role',
            options={'indexes': [models.Index(fields=['tenant', 'key'], name='core_role_tenant_key_idx')], 'unique_together': {('tenant', 'key')}},
        ),
        migrations.AlterModelOptions(
            name='membership',
            options={'indexes': [models.Index(fields=['tenant'], name='core_member_tenant_idx'), models.Index(fields=['tenant', 'user_id'], name='core_member_tenant_user_idx')], 'unique_together': {('tenant', 'user_id')}},
        ),
        migrations.AlterModelOptions(
            name='invitation',
            options={'indexes': [models.Index(fields=['tenant', 'email'], name='core_inv_tenant_email_idx'), models.Index(fields=['token'], name='core_inv_token_idx')]},
        ),
        migrations.AlterModelOptions(
            name='projectrole',
            options={'indexes': [models.Index(fields=['tenant', 'project_id'], name='core_prole_tenant_proj_idx'), models.Index(fields=['tenant', 'project_id', 'key'], name='core_prole_tenant_proj_key_idx')], 'unique_together': {('tenant', 'project_id', 'key')}},
        ),
        migrations.AlterModelOptions(
            name='projectmembership',
            options={'indexes': [models.Index(fields=['tenant', 'project_id'], name='core_pmem_tenant_proj_idx'), models.Index(fields=['tenant', 'project_id', 'user_id'], name='core_pmem_tenant_proj_user_idx')], 'unique_together': {('tenant', 'project_id', 'user_id')}},
        ),
    ]

