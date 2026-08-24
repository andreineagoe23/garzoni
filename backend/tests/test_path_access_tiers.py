"""
Which paths each plan can open.

The policy, set in education migration 0048:

    starter   Basic Finance, and nothing else
    plus      + Personal Finance, Everyday Money Skills, Financial Mindset
    pro       everything else

Free accounts previously reached most of the catalogue, so these assert the
narrowing explicitly rather than trusting seed data.
"""

from django.test import TestCase

from education.models import Path
from education.utils import resolve_path_access_tier

EXPECTED_TIERS = {
    "Basic Finance": "starter",
    "Personal Finance": "plus",
    "Everyday Money Skills": "plus",
    "Financial Mindset": "plus",
    "Real Estate": "pro",
    "Crypto": "pro",
    "Forex": "pro",
}


class PathAccessTierPolicyTests(TestCase):
    def test_exactly_one_path_is_free(self):
        free = [t for t, tier in EXPECTED_TIERS.items() if tier == "starter"]
        self.assertEqual(free, ["Basic Finance"])

    def test_explicit_access_tier_is_honoured_over_the_title(self):
        # A stored tier always wins; the title fallback must not override it.
        path = Path.objects.create(title="Crypto", description="", access_tier="starter")
        self.assertEqual(resolve_path_access_tier(path), "starter")

    def test_title_fallback_matches_the_policy(self):
        # Fires only when access_tier is blank. Every known title must resolve
        # to the same tier the migration writes, or a path with a missing tier
        # would silently sit in the wrong plan.
        for title, expected in EXPECTED_TIERS.items():
            path = Path(title=title, description="", access_tier="")
            self.assertEqual(
                resolve_path_access_tier(path),
                expected,
                msg=f"{title} should fall back to {expected}",
            )

    def test_real_estate_is_pro_not_plus(self):
        # It moved in 0048 and the fallback moved with it; this is the pair
        # most likely to drift apart again.
        path = Path(title="Real Estate", description="", access_tier="")
        self.assertEqual(resolve_path_access_tier(path), "pro")

    def test_unknown_title_stays_visible(self):
        path = Path(title="Something New", description="", access_tier="")
        self.assertEqual(resolve_path_access_tier(path), "starter")

    def test_blank_title_and_tier_does_not_raise(self):
        self.assertEqual(resolve_path_access_tier(Path(title="", access_tier="")), "starter")
