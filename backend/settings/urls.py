from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from authentication.views import CustomTokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    # Add a direct route for token refresh to avoid cookie path issues
    path('token/refresh/', CustomTokenRefreshView.as_view(), name='token-refresh-direct'),
    path('api/', include('authentication.urls')),
    path('api/', include('education.urls')),
    path('api/', include('gamification.urls')),
    path('api/', include('finance.urls')),
    path('api/', include('support.urls')),
    path("ckeditor5/", include('django_ckeditor_5.urls')),
]

if settings.DEBUG: 
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)