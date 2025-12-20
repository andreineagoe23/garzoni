# authentication/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView
from .views import (
    LoginSecureView,
    RegisterSecureView,
    CustomTokenRefreshView,
    VerifyAuthView,
    LogoutView,
    UserProfileView,
    UserSettingsView,
    update_avatar,
    change_password,
    delete_account,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    FriendRequestView,
    FriendsLeaderboardView,
    EntitlementsView,
    ConsumeEntitlementView,
    get_csrf_token,
    ReferralApplyView,
    UserHeartsView,
    UserHeartsDecrementView,
    UserHeartsGrantView,
    UserHeartsRefillView,
)

router = DefaultRouter()
router.register(r"friend-requests", FriendRequestView, basename="friend-request")

urlpatterns = [
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("login-secure/", LoginSecureView.as_view(), name="login-secure"),
    path("register-secure/", RegisterSecureView.as_view(), name="register-secure"),
    path("token/refresh/", CustomTokenRefreshView.as_view(), name="token-refresh"),
    path("verify-auth/", VerifyAuthView.as_view(), name="verify-auth"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("userprofile/", UserProfileView.as_view(), name="userprofile"),
    path("update-avatar/", update_avatar, name="update_avatar"),
    path("entitlements/", EntitlementsView.as_view(), name="entitlements"),
    path("entitlements/consume/", ConsumeEntitlementView.as_view(), name="consume-entitlement"),
    path("user/settings/", UserSettingsView.as_view(), name="user-settings"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="password_reset_request"),
    path(
        "password-reset-confirm/<uidb64>/<token>/",
        PasswordResetConfirmView.as_view(),
        name="password_reset_confirm",
    ),
    path("change-password/", change_password, name="change-password"),
    path("delete-account/", delete_account, name="delete-account"),
    path("leaderboard/friends/", FriendsLeaderboardView.as_view(), name="friends-leaderboard"),
    path("referrals/", ReferralApplyView.as_view(), name="apply-referral"),
    path("csrf/", get_csrf_token, name="get_csrf_token"),
    # Hearts (lives) system
    path("user/hearts/", UserHeartsView.as_view(), name="user-hearts"),
    path("user/hearts/decrement/", UserHeartsDecrementView.as_view(), name="user-hearts-decrement"),
    path("user/hearts/grant/", UserHeartsGrantView.as_view(), name="user-hearts-grant"),
    path("user/hearts/refill/", UserHeartsRefillView.as_view(), name="user-hearts-refill"),
    # Include router URLs for ViewSet endpoints
    path("", include(router.urls)),
]
