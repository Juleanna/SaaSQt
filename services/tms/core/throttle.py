from rest_framework.throttling import SimpleRateThrottle


class JWTUserOrIPRateThrottle(SimpleRateThrottle):
    scope = 'user'

    def get_cache_key(self, request, view):
        user = getattr(request, 'user', None)
        if user and getattr(user, 'is_authenticated', False):
            user_id = getattr(user, 'id', None)
            if user_id is not None:
                ident = f'user:{user_id}'
                return self.cache_format % {'scope': self.scope, 'ident': ident}
        # fallback to client IP for anon
        ident = self.get_ident(request)
        if not ident:
            return None
        return self.cache_format % {'scope': self.scope, 'ident': ident}

