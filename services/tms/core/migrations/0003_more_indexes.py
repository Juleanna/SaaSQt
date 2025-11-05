from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_indexes'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='project',
            index=models.Index(fields=['created_at'], name='core_proj_created_idx'),
        ),
        migrations.AddIndex(
            model_name='project',
            index=models.Index(fields=['updated_at'], name='core_proj_updated_idx'),
        ),
        migrations.AddIndex(
            model_name='testcase',
            index=models.Index(fields=['created_at'], name='core_tc_created_idx'),
        ),
        migrations.AddIndex(
            model_name='testcase',
            index=models.Index(fields=['updated_at'], name='core_tc_updated_idx'),
        ),
        migrations.AddIndex(
            model_name='suite',
            index=models.Index(fields=['created_at'], name='core_suite_created_idx'),
        ),
        migrations.AddIndex(
            model_name='suite',
            index=models.Index(fields=['updated_at'], name='core_suite_updated_idx'),
        ),
    ]

