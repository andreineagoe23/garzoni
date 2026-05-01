from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from django.views.generic.base import RedirectView
from authentication.views_auth import CustomTokenRefreshView
from authentication.views_profile import FinancialProfileView
from authentication.views_apple_signin import AppleIdentityAuthView
from authentication.views_google_oauth import GoogleCredentialAuthView
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)
from django.views.static import serve as static_serve
from core.views import (
    root_view,
    robots_txt_view,
    serve_mascot_media,
    apple_app_site_association,
    health_view,
)

urlpatterns = [
    path("", root_view),
    path("health/", health_view),
    path("robots.txt", robots_txt_view),
    # Universal Links: iOS fetches this to verify the app can handle garzoni.app URLs.
    # Must be served WITHOUT authentication or trailing-slash redirects.
    path(".well-known/apple-app-site-association", apple_app_site_association),
    path("admin/", admin.site.urls),
    # Add a direct route for token refresh to avoid cookie path issues
    path("token/refresh/", CustomTokenRefreshView.as_view(), name="token-refresh-direct"),
    # Compatibility route to ensure /api/me/profile/ is always available
    path("api/me/profile/", FinancialProfileView.as_view(), name="financial-profile-direct"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    # Google One Tap / Sign-in button: direct route so it always resolves (avoids include order / cached image)
    path(
        "api/auth/google/verify-credential/",
        GoogleCredentialAuthView.as_view(),
        name="google-verify-credential",
    ),
    path(
        "api/auth/google/verify-credential",
        GoogleCredentialAuthView.as_view(),
        name="google-verify-credential-no-slash",
    ),
    path(
        "api/auth/apple/verify-identity/",
        AppleIdentityAuthView.as_view(),
        name="apple-verify-identity",
    ),
    path(
        "api/auth/apple/verify-identity",
        AppleIdentityAuthView.as_view(),
        name="apple-verify-identity-no-slash",
    ),
    # Onboarding first so /api/questionnaire/* is matched before other app catch-alls
    path("api/", include("onboarding.urls")),
    path("api/", include("authentication.urls")),
    path("api/", include("notifications.urls")),
    path("api/", include("education.urls")),
    path("api/", include("gamification.urls")),
    path("api/", include("finance.urls")),
    path("api/", include("support.urls")),
    path("ckeditor5/", include("django_ckeditor_5.urls")),
    # Mascot media: no-cache so replaced files are picked up without cache-busting URLs
    re_path(r"^media/mascots/(?P<path>.*)$", serve_mascot_media),
]

# Serve uploaded/media files (mascots, path_images, course_images) in all environments
# Django's static() only wires this when DEBUG=True, so add an explicit route for production.
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
urlpatterns += [
    re_path(r"^media/(?P<path>.*)$", static_serve, {"document_root": settings.MEDIA_ROOT}),
]

LEGAL_PAGE_ROUTES = [
    "privacy-policy",
    "cookie-policy",
    "terms-of-service",
    "financial-disclaimer",
    "no-financial-advice",
]

# SPA fallback (React BrowserRouter). Only enabled when a build is present.
# - /api/*, /admin/* etc remain server-handled
# - everything else returns index.html so React can route client-side
if getattr(settings, "SERVE_FRONTEND", False):
    for route in LEGAL_PAGE_ROUTES:
        urlpatterns += [
            path(
                route,
                TemplateView.as_view(template_name="index.html"),
                name=f"{route}-page",
            ),
            path(
                f"{route}/",
                TemplateView.as_view(template_name="index.html"),
                name=f"{route}-page-slash",
            ),
        ]
    # request.path always starts with "/". Exclusions must use "/static/", not "static/",
    # or WhiteNoise never sees /static/* and this route serves index.html as text/html
    # (broken admin CSS/JS MIME errors).
    urlpatterns += [
        re_path(
            r"^/(?!api/|admin/|token/|ckeditor5/|static/|media/).*",
            TemplateView.as_view(template_name="index.html"),
            name="spa-fallback",
        ),
    ]
else:
    frontend_url = getattr(settings, "FRONTEND_URL", "").rstrip("/")
    if frontend_url:
        for route in LEGAL_PAGE_ROUTES:
            urlpatterns += [
                path(
                    route,
                    RedirectView.as_view(url=f"{frontend_url}/{route}", permanent=False),
                    name=f"{route}-redirect",
                ),
                path(
                    f"{route}/",
                    RedirectView.as_view(url=f"{frontend_url}/{route}", permanent=False),
                    name=f"{route}-redirect-slash",
                ),
            ]
