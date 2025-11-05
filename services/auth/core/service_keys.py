from jose.utils import base64url_encode
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
import os
import threading
import time
from django.utils import timezone
from .models import ServiceKey


_lock = threading.Lock()
_keys = []  # list of dicts: {private_pem, public_jwk, kid, created, expires}


def _now() -> int:
    return int(time.time())


def _generate_keypair(kid: str):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode('ascii')
    public = key.public_key()
    numbers = public.public_numbers()
    n = base64url_encode(numbers.n.to_bytes((numbers.n.bit_length() + 7) // 8, 'big')).decode('ascii')
    e = base64url_encode(numbers.e.to_bytes((numbers.e.bit_length() + 7) // 8, 'big')).decode('ascii')
    jwk_dict = {
        'kty': 'RSA',
        'use': 'sig',
        'alg': 'RS256',
        'kid': kid,
        'n': n,
        'e': e,
    }
    return private_pem, jwk_dict


def _ensure_init():
    # If DB has no keys, initialize
    if ServiceKey.objects.count() == 0:
        pem_env = os.getenv('SERVICE_JWT_PRIVATE_KEY_PEM')
        kid = os.getenv('SERVICE_JWT_KID', f"auth-rsa-{_now()}")
        if pem_env:
            private_key = serialization.load_pem_private_key(pem_env.encode('ascii'), password=None)
            public = private_key.public_key()
            numbers = public.public_numbers()
            n = base64url_encode(numbers.n.to_bytes((numbers.n.bit_length() + 7) // 8, 'big')).decode('ascii')
            e = base64url_encode(numbers.e.to_bytes((numbers.e.bit_length() + 7) // 8, 'big')).decode('ascii')
            jwk_dict = { 'kty':'RSA','use':'sig','alg':'RS256','kid':kid,'n':n,'e':e }
            ServiceKey.objects.create(kid=kid, private_pem=pem_env, public_jwk=jwk_dict)
        else:
            priv, jwk_dict = _generate_keypair(kid)
            ServiceKey.objects.create(kid=kid, private_pem=priv, public_jwk=jwk_dict)


def rotate():
    with _lock:
        _ensure_init()
        new_kid = f"auth-rsa-{_now()}"
        priv, jwk_dict = _generate_keypair(new_kid)
        grace = int(os.getenv('SERVICE_JWT_GRACE_SECONDS', '900'))
        # Set expires_at on current active (most recent) key
        latest = ServiceKey.objects.order_by('-created_at').first()
        if latest and latest.expires_at is None:
            latest.expires_at = timezone.now() + timezone.timedelta(seconds=grace)
            latest.save(update_fields=['expires_at'])
        ServiceKey.objects.create(kid=new_kid, private_pem=priv, public_jwk=jwk_dict)
        _prune()
        return new_kid


def _prune():
    # Keep at least 2 latest keys, prune hard-expired (expires_at << now)
    count = ServiceKey.objects.count()
    if count > 5:
        # remove oldest expired beyond grace*2 window (soft policy)
        now = timezone.now()
        ServiceKey.objects.filter(expires_at__isnull=False, expires_at__lt=now - timezone.timedelta(hours=1)).order_by('created_at')[: count-5].delete()


def list_public_jwks():
    with _lock:
        _ensure_init()
        _prune()
        # Publish non-expired keys; include the latest regardless
        now = timezone.now()
        keys = list(ServiceKey.objects.order_by('-created_at'))
        result = []
        for k in keys:
            if k.expires_at is None or k.expires_at > now:
                result.append(k.public_jwk)
        if not result and keys:
            result.append(keys[0].public_jwk)
        return result


def get_signing_key():
    with _lock:
        _ensure_init()
        _prune()
        k = ServiceKey.objects.order_by('-created_at').first()
        return {'kid': k.kid, 'private_pem': k.private_pem, 'public_jwk': k.public_jwk}
