from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Tenant',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('slug', models.SlugField(unique=True)),
                ('owner_user_id', models.BigIntegerField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name='Role',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.CharField(max_length=50)),
                ('name', models.CharField(max_length=100)),
                ('description', models.TextField(blank=True, default='')),
                ('is_system', models.BooleanField(default=False)),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='roles', to='core.tenant')),
            ],
            options={'unique_together': {('tenant', 'key')}},
        ),
        migrations.CreateModel(
            name='Membership',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('user_id', models.BigIntegerField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('role', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='members', to='core.role')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='memberships', to='core.tenant')),
            ],
            options={'unique_together': {('tenant', 'user_id')}},
        ),
    ]

