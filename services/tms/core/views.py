from rest_framework.decorators import api_view
from rest_framework.response import Response
import os


@api_view(['GET'])
def health(_request):
    return Response({
        'status': 'ok',
        'service': os.getenv('SERVICE_NAME', 'tms'),
    })

