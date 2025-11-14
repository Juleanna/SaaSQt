from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0005_test_manager_expansion'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='description',
            field=models.TextField(blank=True, default=''),
        ),
    ]
