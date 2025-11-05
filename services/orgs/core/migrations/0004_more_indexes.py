from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0003_indexes'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='tenant',
            index=models.Index(fields=['created_at'], name='core_tenant_created_idx'),
        ),
        migrations.AddIndex(
            model_name='tenant',
            index=models.Index(fields=['updated_at'], name='core_tenant_updated_idx'),
        ),
        migrations.AddIndex(
            model_name='membership',
            index=models.Index(fields=['created_at'], name='core_member_created_idx'),
        ),
        migrations.AddIndex(
            model_name='invitation',
            index=models.Index(fields=['created_at'], name='core_inv_created_idx'),
        ),
        migrations.AddIndex(
            model_name='projectmembership',
            index=models.Index(fields=['created_at'], name='core_pmem_created_idx'),
        ),
    ]

