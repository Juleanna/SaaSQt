import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create the default superuser from environment variables if missing"

    def handle(self, *args, **options):
        username = os.getenv("DJANGO_SUPERUSER_USERNAME")
        email = os.getenv("DJANGO_SUPERUSER_EMAIL")
        password = os.getenv("DJANGO_SUPERUSER_PASSWORD")

        if not username or not password:
            self.stdout.write(self.style.WARNING("Skipping superuser creation (missing username or password env vars)"))
            return

        User = get_user_model()

        user, created = User.objects.get_or_create(
            username=username,
            defaults={"email": email or "", "is_superuser": True, "is_staff": True},
        )

        if created:
            user.set_password(password)
            user.email = email or user.email
            user.is_staff = True
            user.is_superuser = True
            user.save()
            self.stdout.write(self.style.SUCCESS(f"Created default superuser '{username}'"))
            return

        updates = []
        if email and user.email != email:
            user.email = email
            updates.append("email")
        if password:
            user.set_password(password)
            updates.append("password")
        if updates:
            user.save()
            self.stdout.write(self.style.SUCCESS(
                f"Updated existing superuser '{username}' ({', '.join(updates)})"
            ))
        else:
            self.stdout.write(f"Superuser '{username}' already exists; no changes made")
