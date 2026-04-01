"""
Compatibility re-export module.

Authentication views are now split by domain:
- views_auth.py
- views_profile.py
- views_friends.py
- views_hearts.py
- views_password.py
- views_entitlements.py
"""

from authentication.views_auth import (
    LoginSecureView,
    RegisterSecureView,
    CustomTokenRefreshView,
    VerifyAuthView,
    LogoutView,
    get_csrf_token,
)
from authentication.views_profile import (
    UserProfileView,
    FinancialProfileView,
    UserSettingsView,
    update_avatar,
)
from authentication.views_friends import (
    FriendRequestView,
    FriendsLeaderboardView,
    ReferralApplyView,
    ReferralCodeValidationView,
)
from authentication.views_hearts import (
    UserHeartsView,
    UserHeartsDecrementView,
    UserHeartsGrantView,
    UserHeartsRefillView,
)
from authentication.views_password import (
    change_password,
    delete_account,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    EmailUnsubscribeView,
)
from authentication.views_entitlements import EntitlementsView, ConsumeEntitlementView, PlansView
