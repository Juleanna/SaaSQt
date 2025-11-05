from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Invitation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('email', models.EmailField(max_length=254)),
                ('token', models.CharField(max_length=64, unique=True)),
                ('invited_by_user_id', models.BigIntegerField(blank=True, null=True)),
                ('accepted_by_user_id', models.BigIntegerField(blank=True, null=True)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('accepted', 'Accepted'), ('expired', 'Expired'), ('revoked', 'Revoked')], default='pending', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('role', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='invitations', to='core.role')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='invitations', to='core.tenant')),
            ],
        ),
        migrations.CreateModel(
            name='ProjectRole',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('project_id', models.BigIntegerField()),
                ('key', models.CharField(max_length=50)),
                ('name', models.CharField(max_length=100)),
                ('description', models.TextField(blank=True, default='')),
                ('is_system', models.BooleanField(default=False)),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='project_roles', to='core.tenant')),
            ],
            options={'unique_together': {('tenant', 'project_id', 'key')}},
        ),
        migrations.CreateModel(
            name='ProjectMembership',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('project_id', models.BigIntegerField()),
                ('user_id', models.BigIntegerField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('role', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='members', to='core.projectrole')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='project_memberships', to='core.tenant')),
            ],
            options={'unique_together': {('tenant', 'project_id', 'user_id')}},
        ),
    ]

