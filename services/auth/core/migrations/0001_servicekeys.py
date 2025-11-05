from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='ServiceKey',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kid', models.CharField(max_length=100, unique=True)),
                ('private_pem', models.TextField()),
                ('public_jwk', models.JSONField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
            ],
            options={'indexes': [models.Index(fields=['kid'], name='core_servic_kid_idx'), models.Index(fields=['created_at'], name='core_servic_created_idx')]},
        ),
    ]

