from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Project',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tenant_id', models.BigIntegerField()),
                ('key', models.CharField(max_length=20)),
                ('name', models.CharField(max_length=200)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'unique_together': {('tenant_id', 'key')}},
        ),
        migrations.CreateModel(
            name='TestCase',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=300)),
                ('description', models.TextField(blank=True, default='')),
                ('steps', models.JSONField(blank=True, default=list)),
                ('tags', models.JSONField(blank=True, default=list)),
                ('status', models.CharField(choices=[('active', 'Active'), ('archived', 'Archived')], default='active', max_length=20)),
                ('version', models.IntegerField(default=1)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='test_cases', to='core.project')),
            ],
        ),
        migrations.CreateModel(
            name='Suite',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='suites', to='core.project')),
            ],
        ),
        migrations.CreateModel(
            name='SuiteCase',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('order', models.PositiveIntegerField(default=0)),
                ('suite', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='suite_cases', to='core.suite')),
                ('test_case', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='in_suites', to='core.testcase')),
            ],
            options={'unique_together': {('suite', 'test_case')}},
        ),
    ]

