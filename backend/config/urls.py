from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.views.static import serve
from django.http import FileResponse


def media_with_cors(request, path):
    """Serve media files with CORS headers so frontend (port 5173) can load images."""
    response = serve(request, path, document_root=settings.MEDIA_ROOT)
    response['Access-Control-Allow-Origin'] = '*'
    return response


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('classification.urls')),
    path('api/', include('segmentation.urls')),
    path('api/', include('analysis.urls')),
    path('api/rag/', include('rag.urls')),
    path('api/', include('history.urls')),
    re_path(r'^media/(?P<path>.*)$', media_with_cors),
]
