from django.http import JsonResponse


class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        tenant_id = None
        # Prefer header
        hdr = request.META.get('HTTP_X_TENANT_ID')
        if hdr and hdr.isdigit():
            tenant_id = int(hdr)
        # Fallback to query param
        if tenant_id is None:
            param = request.GET.get('tenant_id')
            if param and str(param).isdigit():
                tenant_id = int(param)
        # Fallback to JWT claim
        token = getattr(request, 'auth', None)
        claim_tenant = None
        try:
            if isinstance(token, dict):
                tval = token.get('tenant_id')
                if tval and str(tval).isdigit():
                    claim_tenant = int(tval)
        except Exception:
            claim_tenant = None
        # If no header/query provided, use claim
        if tenant_id is None and claim_tenant is not None:
            tenant_id = claim_tenant
        # If both provided and mismatch -> 403
        if tenant_id is not None and claim_tenant is not None and tenant_id != claim_tenant:
            return JsonResponse({'detail': 'tenant_id mismatch'}, status=403)
        request.tenant_id = tenant_id
        return self.get_response(request)
