from django.core.management.base import BaseCommand
from core.service_keys import rotate


class Command(BaseCommand):
    help = 'Rotate RS256 JWKS signing key. Keeps previous key valid for grace period.'

    def handle(self, *args, **options):
        kid = rotate()
        self.stdout.write(self.style.SUCCESS(f'Rotated JWKS. New kid: {kid}'))

