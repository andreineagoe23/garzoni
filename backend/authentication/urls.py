# authentication/urls.py
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views_google_oauth import GoogleOAuthInitView, GoogleOAuthCallbackView
from .views_auth import (
    LoginSecureView,
    RegisterSecureView,
    CustomTokenRefreshView,
    VerifyAuthView,
    LogoutView,
    get_csrf_token,
)
from .views_profile import (
    ActivityHeatmapView,
    UserProfileView,
    FinancialProfileView,
    UserSettingsView,
    update_avatar,
)
from .views_password import (
    change_password,
    delete_account,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    EmailPreferencesView,
    EmailUnsubscribeView,
)
from .views_friends import (
    FriendRequestView,
    FriendsLeaderboardView,
    PublicProfileView,
    ReferralApplyView,
    ReferralCodeValidationView,
)
from .views_social import (
    FriendActivityFeedView,
    FriendSuggestionsView,
    UserSearchView,
)
from .views_entitlements import (
    EntitlementsView,
    ConsumeEntitlementView,
    PlansView,
)
from .views_hearts import (
    UserHeartsView,
    UserHeartsDecrementView,
    UserHeartsGrantView,
    UserHeartsRefillView,
)
from .views_push import ExpoPushTokenView
from .views_revenuecat import RevenueCatWebhookView
from .views_revenuecat_sync import RevenueCatSyncView

router = DefaultRouter()
router.register(r"friend-requests", FriendRequestView, basename="friend-request")

urlpatterns = [
    path("login-secure/", LoginSecureView.as_view(), name="login-secure"),
    path("register-secure/", RegisterSecureView.as_view(), name="register-secure"),
    path("auth/google/", GoogleOAuthInitView.as_view(), name="google-oauth-init"),
    path("auth/google/callback", GoogleOAuthCallbackView.as_view(), name="google-oauth-callback"),
    path("token/refresh/", CustomTokenRefreshView.as_view(), name="token-refresh"),
    path("verify-auth/", VerifyAuthView.as_view(), name="verify-auth"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("auth/push-token/", ExpoPushTokenView.as_view(), name="expo-push-token"),
    path("userprofile/", UserProfileView.as_view(), name="userprofile"),
    path("activity-heatmap/", ActivityHeatmapView.as_view(), name="activity-heatmap"),
    path("me/profile/", FinancialProfileView.as_view(), name="financial-profile"),
    path("update-avatar/", update_avatar, name="update_avatar"),
    path("entitlements/", EntitlementsView.as_view(), name="entitlements"),
    path(
        "entitlements/consume/",
        ConsumeEntitlementView.as_view(),
        name="consume-entitlement",
    ),
    path("plans/", PlansView.as_view(), name="plans"),
    path("user/settings/", UserSettingsView.as_view(), name="user-settings"),
    path(
        "password-reset/",
        PasswordResetRequestView.as_view(),
        name="password_reset_request",
    ),
    path(
        "password-reset-confirm/<uidb64>/<token>/",
        PasswordResetConfirmView.as_view(),
        name="password_reset_confirm",
    ),
    path(
        "email/unsubscribe/",
        EmailUnsubscribeView.as_view(),
        name="email_unsubscribe",
    ),
    path(
        "email/preferences/",
        EmailPreferencesView.as_view(),
        name="email_preferences",
    ),
    # Aliases: earlier CIO syncs minted links under /api/auth/email/... (the
    # route lives at /api/email/...). Keep these so already-delivered emails
    # don't 404. Safe to remove once old links age out.
    path(
        "auth/email/unsubscribe/",
        EmailUnsubscribeView.as_view(),
        name="email_unsubscribe_alias",
    ),
    path(
        "auth/email/preferences/",
        EmailPreferencesView.as_view(),
        name="email_preferences_alias",
    ),
    path("change-password/", change_password, name="change-password"),
    path("delete-account/", delete_account, name="delete-account"),
    path(
        "leaderboard/friends/",
        FriendsLeaderboardView.as_view(),
        name="friends-leaderboard",
    ),
    path("users/<int:user_id>/public-profile/", PublicProfileView.as_view(), name="public-profile"),
    path("users/search/", UserSearchView.as_view(), name="user-search"),
    path("friends/activity-feed/", FriendActivityFeedView.as_view(), name="friends-activity-feed"),
    path("friends/suggestions/", FriendSuggestionsView.as_view(), name="friends-suggestions"),
    path("referrals/", ReferralApplyView.as_view(), name="apply-referral"),
    path(
        "referrals/validate/",
        ReferralCodeValidationView.as_view(),
        name="validate-referral-code",
    ),
    path("csrf/", get_csrf_token, name="get_csrf_token"),
    path(
        "revenuecat-webhook/",
        RevenueCatWebhookView.as_view(),
        name="revenuecat-webhook",
    ),
    path(
        "revenuecat-sync/",
        RevenueCatSyncView.as_view(),
        name="revenuecat-sync",
    ),
    # Hearts (lives) system
    path("user/hearts/", UserHeartsView.as_view(), name="user-hearts"),
    path(
        "user/hearts/decrement/",
        UserHeartsDecrementView.as_view(),
        name="user-hearts-decrement",
    ),
    path("user/hearts/grant/", UserHeartsGrantView.as_view(), name="user-hearts-grant"),
    path("user/hearts/refill/", UserHeartsRefillView.as_view(), name="user-hearts-refill"),
    # Include router URLs for ViewSet endpoints
    path("", include(router.urls)),
]
