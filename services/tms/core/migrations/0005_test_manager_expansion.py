from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_test_manager'),
    ]

    operations = [
        migrations.CreateModel(
            name='TestSection',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('order', models.PositiveIntegerField(default=0)),
                ('path', models.CharField(blank=True, default='', max_length=255)),
                ('parent', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='children', to='core.testsection')),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sections', to='core.project')),
            ],
            options={
                'ordering': ['order', 'id'],
                'unique_together': {('project', 'parent', 'name')},
                'indexes': [
                    models.Index(fields=['project'], name='core_testsec_project_idx'),
                    models.Index(fields=['parent'], name='core_testsec_parent_idx'),
                    models.Index(fields=['project', 'path'], name='core_testsec_path_idx'),
                ],
            },
        ),
        migrations.CreateModel(
            name='TestTag',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50)),
                ('color', models.CharField(blank=True, default='', max_length=20)),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tags', to='core.project')),
            ],
            options={
                'indexes': [
                    models.Index(fields=['project'], name='core_testtag_project_idx'),
                    models.Index(fields=['project', 'name'], name='core_testtag_name_idx'),
                ],
                'unique_together': {('project', 'name')},
            },
        ),
        migrations.CreateModel(
            name='Requirement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('external_id', models.CharField(blank=True, default='', max_length=100)),
                ('title', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True, default='')),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('active', 'Active'), ('deprecated', 'Deprecated')], default='active', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='requirements', to='core.project')),
            ],
            options={
                'indexes': [
                    models.Index(fields=['project'], name='core_require_project_idx'),
                    models.Index(fields=['project', 'external_id'], name='core_require_extid_idx'),
                    models.Index(fields=['status'], name='core_require_status_idx'),
                ],
            },
        ),
        migrations.CreateModel(
            name='TestImportJob',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_by_user_id', models.BigIntegerField(blank=True, null=True)),
                ('file_path', models.CharField(max_length=500)),
                ('file_format', models.CharField(default='csv', max_length=20)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('processing', 'Processing'), ('completed', 'Completed'), ('failed', 'Failed')], default='pending', max_length=20)),
                ('total_records', models.IntegerField(default=0)),
                ('processed_records', models.IntegerField(default=0)),
                ('error_message', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('finished_at', models.DateTimeField(blank=True, null=True)),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='import_jobs', to='core.project')),
            ],
            options={
                'indexes': [
                    models.Index(fields=['project'], name='core_import_project_idx'),
                    models.Index(fields=['status'], name='core_import_status_idx'),
                    models.Index(fields=['created_at'], name='core_import_created_idx'),
                ],
            },
        ),
        migrations.CreateModel(
            name='TestExportJob',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_by_user_id', models.BigIntegerField(blank=True, null=True)),
                ('query', models.JSONField(blank=True, default=dict)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('processing', 'Processing'), ('completed', 'Completed'), ('failed', 'Failed')], default='pending', max_length=20)),
                ('file_path', models.CharField(blank=True, default='', max_length=500)),
                ('error_message', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('finished_at', models.DateTimeField(blank=True, null=True)),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='export_jobs', to='core.project')),
            ],
            options={
                'indexes': [
                    models.Index(fields=['project'], name='core_export_project_idx'),
                    models.Index(fields=['status'], name='core_export_status_idx'),
                    models.Index(fields=['created_at'], name='core_export_created_idx'),
                ],
            },
        ),
        migrations.AddField(
            model_name='testcase',
            name='priority',
            field=models.CharField(choices=[('low', 'Low'), ('medium', 'Medium'), ('high', 'High'), ('critical', 'Critical')], default='medium', max_length=20),
        ),
        migrations.AddField(
            model_name='testcase',
            name='section',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='test_cases', to='core.testsection'),
        ),
        migrations.AddField(
            model_name='testcase',
            name='labels',
            field=models.ManyToManyField(blank=True, related_name='test_cases', to='core.testtag'),
        ),
        migrations.AddField(
            model_name='testcase',
            name='requirements',
            field=models.ManyToManyField(blank=True, related_name='test_cases', to='core.requirement'),
        ),
    ]
