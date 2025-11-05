from rest_framework.throttling import UserRateThrottle


class JWTUserRateThrottle(UserRateThrottle):
    def get_cache_key(self, request, view):
        user = getattr(request, 'user', None)
        if user and getattr(user, 'is_authenticated', False):
            user_id = getattr(user, 'id', None)
            if user_id is not None:
                ident = f"user:{user_id}"
                return self.cache_format % {
                    'scope': self.scope,
                    'ident': ident
                }
        return super().get_cache_key(request, view)

