from django.contrib.auth.models import User
from rest_framework import serializers, status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.conf import settings
import requests


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    first_name = serializers.CharField(required=False, allow_blank=True, default="")
    last_name = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Email already in use")
        return value

    def create(self, validated_data):
        email = validated_data["email"].lower()
        password = validated_data["password"]
        first_name = validated_data.get("first_name", "")
        last_name = validated_data.get("last_name", "")
        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )
        return user


class RegisterView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'register'

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response({
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
        }, status=status.HTTP_201_CREATED)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        return Response({
            "id": u.id,
            "email": getattr(u, 'email', ''),
            "first_name": getattr(u, 'first_name', ''),
            "last_name": getattr(u, 'last_name', ''),
            "username": getattr(u, 'username', ''),
        })


class SwitchTenantView(APIView):
    permission_classes = [IsAuthenticated]

    @staticmethod
    def _has_membership_payload(payload, tenant_id):
        if isinstance(payload, list):
            return any(
                isinstance(item, dict) and int(item.get('tenant', 0)) == tenant_id
                for item in payload
            )
        if isinstance(payload, dict):
            results = payload.get('results')
            if isinstance(results, list):
                return any(
                    isinstance(item, dict) and int(item.get('tenant', 0)) == tenant_id
                    for item in results
                )
            count = payload.get('count')
            if isinstance(count, int):
                return count > 0
        return False

    def post(self, request):
        tenant_id = request.data.get('tenant_id')
        try:
            tenant_id = int(tenant_id)
        except Exception:
            return Response({'detail': 'Invalid tenant_id'}, status=400)
        base = getattr(settings, 'ORGS_BASE_URL', 'http://orgs:8000/api')
        svc = getattr(settings, 'ORGS_SERVICE_TOKEN', None)
        if not svc:
            return Response({'detail': 'Service token not configured'}, status=500)
        try:
            r = requests.get(
                f"{base.rstrip('/')}/memberships/",
                params={'tenant': tenant_id, 'user_id': request.user.id},
                headers={'Authorization': f'Service {svc}'},
                timeout=3,
            )
            ok = False
            if r.status_code == 200:
                ok = self._has_membership_payload(r.json(), tenant_id)
            if not ok:
                tenant_resp = requests.get(
                    f"{base.rstrip('/')}/tenants/{tenant_id}/",
                    headers={'Authorization': f'Service {svc}'},
                    timeout=3,
                )
                if tenant_resp.status_code == 200:
                    owner_user_id = tenant_resp.json().get('owner_user_id')
                    if owner_user_id and int(owner_user_id) == request.user.id:
                        ok = True
            if not ok:
                return Response({'detail': 'Not a member of tenant'}, status=403)
        except Exception:
            return Response({'detail': 'Membership check failed'}, status=502)
        # Mint a new access token with tenant_id claim
        from rest_framework_simplejwt.tokens import AccessToken
        access = AccessToken.for_user(request.user)
        access['tenant_id'] = tenant_id
        return Response({'access': str(access)})


class ThrottledTokenObtainPairView(TokenObtainPairView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'token'


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    def _maybe_map_email_to_username(self, attrs):
        username = attrs.get(self.username_field)
        if not username:
            return attrs

        try:
            from django.contrib.auth import get_user_model

            User = get_user_model()
            lookup = {"email__iexact": username}
            user = User.objects.filter(**lookup).only(User.USERNAME_FIELD).first()
            if user:
                attrs[self.username_field] = getattr(user, User.USERNAME_FIELD)
        except Exception:
            pass
        return attrs

    def validate(self, attrs):
        attrs = self._maybe_map_email_to_username(attrs)
        data = super().validate(attrs)
        # Optional: accept tenant_id in login payload to set context
        tenant_id = None
        try:
            req = self.context.get('request')
            if req is not None:
                tenant_val = req.data.get('tenant_id')
                if tenant_val and str(tenant_val).isdigit():
                    tenant_id = int(tenant_val)
        except Exception:
            tenant_id = None

        # Verify membership if tenant_id provided
        if tenant_id is not None:
            try:
                base = getattr(settings, 'ORGS_BASE_URL', 'http://orgs:8000/api')
                url = f"{base.rstrip('/')}/memberships/"
                headers = {}
                svc = getattr(settings, 'ORGS_SERVICE_TOKEN', None)
                if svc:
                    headers['Authorization'] = f"Service {svc}"
                r = requests.get(url, params={'tenant': tenant_id, 'user_id': self.user.id}, headers=headers, timeout=3)
                ok = False
                if r.status_code == 200:
                    js = r.json()
                    if isinstance(js, list):
                        ok = any(isinstance(it, dict) and it.get('tenant') == tenant_id for it in js)
                    elif isinstance(js, dict):
                        cnt = js.get('count')
                        if isinstance(cnt, int):
                            ok = cnt > 0
                if not ok:
                    tenant_id = None
            except Exception:
                tenant_id = None

        # Inject claim into refresh (and thus access)
        refresh_token = self.get_token(self.user)
        if tenant_id is not None:
            refresh_token['tenant_id'] = tenant_id
        data['refresh'] = str(refresh_token)
        data['access'] = str(refresh_token.access_token)
        return data
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['email'] = getattr(user, 'email', '')
        token['name'] = (getattr(user, 'first_name', '') + ' ' + getattr(user, 'last_name', '')).strip()
        return token
