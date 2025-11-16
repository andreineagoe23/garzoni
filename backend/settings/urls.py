from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from core.views import CustomTokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    # Add a direct route for token refresh to avoid cookie path issues
    path('token/refresh/', CustomTokenRefreshView.as_view(), name='token-refresh-direct'),
    path('api/', include('core.urls')),
]

if settings.DEBUG: 
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)