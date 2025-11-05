from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0003_more_indexes'),
    ]

    operations = [
        migrations.AddField(
            model_name='testcase',
            name='automation_ref',
            field=models.CharField(blank=True, default='', max_length=200),
        ),
        migrations.AddField(
            model_name='testcase',
            name='automation_type',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
        migrations.AddField(
            model_name='testcase',
            name='is_automated',
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name='Release',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('version', models.CharField(blank=True, default='', max_length=50)),
                ('due_date', models.DateField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='releases', to='core.project')),
            ],
            options={'unique_together': {('project', 'name')}, 'indexes': [models.Index(fields=['project'], name='core_rel_project_idx'), models.Index(fields=['project', 'name'], name='core_rel_project_name_idx')]},
        ),
        migrations.CreateModel(
            name='TestCaseVersion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('version', models.IntegerField()),
                ('title', models.CharField(max_length=300)),
                ('description', models.TextField(blank=True, default='')),
                ('steps', models.JSONField(blank=True, default=list)),
                ('expected', models.JSONField(blank=True, default=list)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('testcase', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='versions', to='core.testcase')),
            ],
            options={'unique_together': {('testcase', 'version')}, 'indexes': [models.Index(fields=['testcase', 'version'], name='core_tcv_tc_ver_idx')]},
        ),
        migrations.CreateModel(
            name='TestPlan',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True, default='')),
                ('created_by_user_id', models.BigIntegerField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='plans', to='core.project')),
                ('release', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='plans', to='core.release')),
            ],
            options={'indexes': [models.Index(fields=['project'], name='core_plan_project_idx'), models.Index(fields=['project', 'name'], name='core_plan_project_name_idx')]},
        ),
        migrations.CreateModel(
            name='TestRun',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('status', models.CharField(choices=[('planned', 'Planned'), ('running', 'Running'), ('paused', 'Paused'), ('completed', 'Completed'), ('canceled', 'Canceled')], default='planned', max_length=20)),
                ('scheduled_at', models.DateTimeField(blank=True, null=True)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('finished_at', models.DateTimeField(blank=True, null=True)),
                ('is_automation', models.BooleanField(default=False)),
                ('created_by_user_id', models.BigIntegerField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('plan', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='runs', to='core.testplan')),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='runs', to='core.project')),
            ],
            options={'indexes': [models.Index(fields=['project'], name='core_run_project_idx'), models.Index(fields=['status'], name='core_run_status_idx'), models.Index(fields=['project', 'status'], name='core_run_project_status_idx')]},
        ),
        migrations.CreateModel(
            name='PlanItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('order', models.PositiveIntegerField(default=0)),
                ('plan', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='core.testplan')),
                ('testcase', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='plan_items', to='core.testcase')),
                ('testcase_version', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='plan_items', to='core.testcaseversion')),
            ],
            options={'unique_together': {('plan', 'testcase')}, 'indexes': [models.Index(fields=['plan', 'order'], name='core_planitem_plan_order_idx')]},
        ),
        migrations.CreateModel(
            name='TestInstance',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('assignee_user_id', models.BigIntegerField(blank=True, null=True)),
                ('status', models.CharField(choices=[('not_started', 'Not Started'), ('in_progress', 'In Progress'), ('blocked', 'Blocked'), ('passed', 'Passed'), ('failed', 'Failed'), ('skipped', 'Skipped')], default='not_started', max_length=20)),
                ('actual_result', models.TextField(blank=True, default='')),
                ('defects', models.JSONField(blank=True, default=list)),
                ('duration_seconds', models.IntegerField(blank=True, null=True)),
                ('automation_ref', models.CharField(blank=True, default='', max_length=200)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('finished_at', models.DateTimeField(blank=True, null=True)),
                ('order', models.PositiveIntegerField(default=0)),
                ('run', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='instances', to='core.testrun')),
                ('testcase', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='instances', to='core.testcase')),
                ('testcase_version', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='instances', to='core.testcaseversion')),
            ],
            options={'indexes': [models.Index(fields=['run'], name='core_ti_run_idx'), models.Index(fields=['status'], name='core_ti_status_idx'), models.Index(fields=['run', 'status'], name='core_ti_run_status_idx'), models.Index(fields=['automation_ref'], name='core_ti_autoref_idx')]},
        ),
    ]

