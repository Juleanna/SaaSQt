import os
from rest_framework.authentication import BaseAuthentication
from rest_framework import exceptions
from django.conf import settings
from jose import jwt
from jose.utils import base64url_decode
import requests
import time


class ServiceUser:
    is_authenticated = True
    is_staff = True
    id = 0
    pk = 0


_JWKS_CACHE = {"ts": 0, "jwks": None}


class ServiceTokenAuthentication(BaseAuthentication):
    def authenticate(self, request):
        header = request.META.get('HTTP_AUTHORIZATION', '')
        if not header:
            return None
        parts = header.split()
        if len(parts) != 2:
            return None
        scheme, token = parts
        scheme = scheme.lower()
        if scheme == 'service':
            expected = os.getenv('ORGS_SERVICE_TOKEN') or os.getenv('SERVICES_SHARED_TOKEN')
            if not expected:
                raise exceptions.AuthenticationFailed('Service token not configured')
            if token != expected:
                raise exceptions.AuthenticationFailed('Invalid service token')
            return (ServiceUser(), None)
        if scheme == 'servicebearer':
            # Prefer JWKS if provided
            jwks_url = getattr(settings, 'SERVICES_JWKS_URL', None)
            audience = getattr(settings, 'SERVICES_JWT_AUDIENCE', 'orgs')
            issuer = getattr(settings, 'SERVICES_JWT_ISSUER', None)
            secret = getattr(settings, 'SERVICES_JWT_SECRET', None)
            try:
                if jwks_url:
                    now = time.time()
                    if not _JWKS_CACHE["jwks"] or now - _JWKS_CACHE["ts"] > 300:
                        resp = requests.get(jwks_url, timeout=3)
                        resp.raise_for_status()
                        _JWKS_CACHE["jwks"] = resp.json()
                        _JWKS_CACHE["ts"] = now
                    headers = jwt.get_unverified_header(token)
                    kid = headers.get('kid')
                    keys = _JWKS_CACHE["jwks"].get('keys', []) if isinstance(_JWKS_CACHE["jwks"], dict) else []
                    key = next((k for k in keys if k.get('kid') == kid), None)
                    if not key:
                        raise exceptions.AuthenticationFailed('Unknown key id')
                    return (ServiceUser(), jwt.decode(token, key, algorithms=['RS256'], audience=audience, issuer=issuer))
                if secret:
                    return (ServiceUser(), jwt.decode(token, secret, algorithms=['HS256'], audience=audience, issuer=issuer))
            except Exception as e:
                raise exceptions.AuthenticationFailed('Invalid service JWT')
        return None
