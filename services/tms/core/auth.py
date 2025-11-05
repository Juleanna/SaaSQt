from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.settings import api_settings as jwt_settings


class ExternalUser:
    def __init__(self, user_id):
        self.id = user_id
        self.pk = user_id
        self.is_authenticated = True


class ExternalJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user_id = validated_token.get(jwt_settings.USER_ID_CLAIM)
        if user_id is None:
            return None
        return ExternalUser(user_id)
