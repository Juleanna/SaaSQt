from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from jose import jwt
from .service_keys import list_public_jwks, get_signing_key, rotate
import time


def _is_service_authorized(request):
    header = request.META.get('HTTP_AUTHORIZATION', '')
    if not header:
        return False
    parts = header.split()
    if len(parts) != 2:
        return False
    scheme, token = parts
    if scheme.lower() != 'service':
        return False
    expected = getattr(settings, 'ORGS_SERVICE_TOKEN', None) or settings.SECRET_KEY
    return expected and token == expected


@api_view(['GET'])
@permission_classes([AllowAny])
@authentication_classes([])
def jwks(request):
    max_age = int(getattr(settings, 'SERVICE_JWKS_MAX_AGE', 300))
    jwks = { 'keys': list_public_jwks() }
    resp = Response(jwks)
    resp['Cache-Control'] = f'public, max-age={max_age}'
    return resp


@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])
def issue_service_token(request):
    if not _is_service_authorized(request):
        return Response({'detail':'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)
    aud = request.data.get('aud', 'orgs')
    sub = request.data.get('sub', 'tms')
    iss = 'auth'
    now = int(time.time())
    payload = {
        'iss': iss,
        'sub': sub,
        'aud': aud,
        'iat': now,
        'exp': now + 300,
    }
    keys = get_signing_key()
    token = jwt.encode(payload, keys['private_pem'], algorithm='RS256', headers={'kid': keys['kid']})
    return Response({'token': token})


@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])
def rotate_jwks(request):
    if not _is_service_authorized(request):
        return Response({'detail':'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)
    kid = rotate()
    return Response({'kid': kid})
