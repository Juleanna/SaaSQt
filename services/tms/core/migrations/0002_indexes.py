from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='project',
            options={'indexes': [models.Index(fields=['tenant_id'], name='core_proj_tenant_idx'), models.Index(fields=['tenant_id', 'key'], name='core_proj_tenant_key_idx')], 'unique_together': {('tenant_id', 'key')}},
        ),
        migrations.AlterModelOptions(
            name='suite',
            options={'indexes': [models.Index(fields=['project'], name='core_suite_project_idx')]},
        ),
        migrations.AlterModelOptions(
            name='suitecase',
            options={'indexes': [models.Index(fields=['suite', 'order'], name='core_sc_suite_order_idx'), models.Index(fields=['test_case'], name='core_sc_testcase_idx')], 'unique_together': {('suite', 'test_case')}},
        ),
        migrations.AlterModelOptions(
            name='testcase',
            options={'indexes': [models.Index(fields=['project'], name='core_tc_project_idx'), models.Index(fields=['status'], name='core_tc_status_idx'), models.Index(fields=['project', 'status'], name='core_tc_project_status_idx')]},
        ),
    ]

