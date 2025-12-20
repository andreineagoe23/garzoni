from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from authentication.views import CustomTokenRefreshView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path('admin/', admin.site.urls),
    # Add a direct route for token refresh to avoid cookie path issues
    path('token/refresh/', CustomTokenRefreshView.as_view(), name='token-refresh-direct'),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    path('api/', include('authentication.urls')),
    path('api/', include('education.urls')),
    path('api/', include('gamification.urls')),
    path('api/', include('finance.urls')),
    path('api/', include('support.urls')),
    path("ckeditor5/", include('django_ckeditor_5.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# SPA fallback (React BrowserRouter). Only enabled when a build is present.
# - /api/*, /admin/* etc remain server-handled
# - everything else returns index.html so React can route client-side
if getattr(settings, "SERVE_FRONTEND", False):
    urlpatterns += [
        re_path(
            r"^(?!api/|admin/|token/|ckeditor5/|static/|media/).*",
            TemplateView.as_view(template_name="index.html"),
            name="spa-fallback",
        ),
    ]
