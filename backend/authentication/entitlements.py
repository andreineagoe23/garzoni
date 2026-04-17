from dataclasses import dataclass
from typing import Dict, Optional, Tuple

from django.core.cache import cache
from django.utils import timezone


@dataclass
class FeatureState:
    name: str
    flag: str
    enabled: bool
    daily_quota: Optional[int] = None
    description: str = ""


FEATURE_FLAGS = {
    "daily_limits": "feature.limit.daily",
    "hints": "feature.education.hints",
    "streak_repair": "feature.gamification.streak_repair",
    "downloads": "feature.resources.downloads",
    "analytics": "feature.analytics.access",
    "ai_tutor": "feature.ai.tutor",
    "personalized_path": "feature.learning.personalized_path",
}

PLAN_ORDER = {
    "starter": 0,
    "plus": 1,
    "pro": 2,
}

PLAN_ALIASES = {
    "free": "starter",
    "premium": "plus",
}


PLAN_MATRIX: Dict[str, Dict[str, Dict]] = {
    "starter": {
        "label": "Starter",
        "features": {
            "daily_limits": {
                "enabled": True,
                "daily_quota": 3,
                "description": "3 core learning actions per day",
            },
            "hints": {
                "enabled": True,
                "daily_quota": 2,
                "description": "Two lesson/quiz hints each day",
            },
            "streak_repair": {
                "enabled": False,
                "daily_quota": 0,
                "description": "Streak repairs are Plus/Pro only",
            },
            "downloads": {
                "enabled": True,
                "daily_quota": 1,
                "description": "One certificate/share card download daily",
            },
            "analytics": {
                "enabled": False,
                "description": "Advanced analytics locked to Plus/Pro",
            },
            "ai_tutor": {
                "enabled": True,
                "daily_quota": 5,
                "description": "Five AI tutor prompts per day",
            },
            "personalized_path": {
                "enabled": False,
                "daily_quota": 0,
                "description": "Personalized path (Plus/Pro only)",
            },
        },
    },
    "plus": {
        "label": "Plus",
        "features": {
            "daily_limits": {
                "enabled": True,
                "daily_quota": None,
                "description": "Unlimited learning actions per day",
            },
            "hints": {
                "enabled": True,
                "daily_quota": None,
                "description": "Unlimited lesson and quiz hints",
            },
            "streak_repair": {
                "enabled": True,
                "daily_quota": 1,
                "description": "One streak repair token per day",
            },
            "downloads": {
                "enabled": True,
                "daily_quota": None,
                "description": "Unlimited certificate/share downloads",
            },
            "analytics": {
                "enabled": True,
                "daily_quota": None,
                "description": "Full analytics and insights",
            },
            "ai_tutor": {
                "enabled": True,
                "daily_quota": 50,
                "description": "50 AI tutor prompts per day",
            },
            "personalized_path": {
                "enabled": True,
                "daily_quota": None,
                "description": "Personalized learning path based on your goals",
            },
        },
    },
    "pro": {
        "label": "Pro",
        "features": {
            "daily_limits": {
                "enabled": True,
                "daily_quota": None,
                "description": "Unlimited learning actions per day",
            },
            "hints": {
                "enabled": True,
                "daily_quota": None,
                "description": "Unlimited lesson and quiz hints",
            },
            "streak_repair": {
                "enabled": True,
                "daily_quota": 1,
                "description": "One streak repair token per day",
            },
            "downloads": {
                "enabled": True,
                "daily_quota": None,
                "description": "Unlimited certificate/share downloads",
            },
            "analytics": {
                "enabled": True,
                "daily_quota": None,
                "description": "Full analytics and insights",
            },
            "ai_tutor": {
                "enabled": True,
                "daily_quota": 200,
                "description": "200 AI tutor prompts per day",
            },
            "personalized_path": {
                "enabled": True,
                "daily_quota": None,
                "description": "Personalized learning path based on your goals",
            },
        },
    },
}

# Year plans first (sort_order 0–1), then Starter, then monthly. 7-day trial only on yearly Pro/Plus.
# Prices must match Stripe (Plus: £69/year, £7.99/month; Pro: £79/year, £11.99/month).
PLAN_CATALOG = [
    {
        "plan_id": "plus",
        "name": "Plus",
        "billing_interval": "yearly",
        "price_amount": 69,
        "currency": "GBP",
        "trial_days": 7,
        "sort_order": 0,
        "entitlements_plan": "plus",
        "stripe_price_setting": "STRIPE_PRICE_PLUS_YEARLY",
        "feature_overrides": {},
    },
    {
        "plan_id": "pro",
        "name": "Pro",
        "billing_interval": "yearly",
        "price_amount": 79,
        "currency": "GBP",
        "trial_days": 7,
        "sort_order": 1,
        "entitlements_plan": "pro",
        "stripe_price_setting": "STRIPE_PRICE_PRO_YEARLY",
        "feature_overrides": {
            "ai_tutor": {"daily_quota": 200},
        },
    },
    {
        "plan_id": "starter",
        "name": "Starter",
        "billing_interval": "monthly",
        "price_amount": 0,
        "currency": "GBP",
        "trial_days": 0,
        "sort_order": 2,
        "entitlements_plan": "starter",
        "stripe_price_setting": "STRIPE_PRICE_STARTER_MONTHLY",
        "feature_overrides": {},
    },
    {
        "plan_id": "plus",
        "name": "Plus",
        "billing_interval": "monthly",
        "price_amount": 7.99,
        "currency": "GBP",
        "trial_days": 0,
        "sort_order": 3,
        "entitlements_plan": "plus",
        "stripe_price_setting": "STRIPE_PRICE_PLUS_MONTHLY",
        "feature_overrides": {},
    },
    {
        "plan_id": "pro",
        "name": "Pro",
        "billing_interval": "monthly",
        "price_amount": 11.99,
        "currency": "GBP",
        "trial_days": 0,
        "sort_order": 4,
        "entitlements_plan": "pro",
        "stripe_price_setting": "STRIPE_PRICE_PRO_MONTHLY",
        "feature_overrides": {
            "ai_tutor": {"daily_quota": 200},
        },
    },
]


def _usage_cache_key(user_id: int, feature: str) -> str:
    today = timezone.now().date().isoformat()
    return f"entitlement:{feature}:{user_id}:{today}"


def _get_usage(user_id: int, feature: str) -> int:
    return cache.get(_usage_cache_key(user_id, feature), 0)


def _increment_usage(user_id: int, feature: str, amount: int = 1) -> int:
    key = _usage_cache_key(user_id, feature)
    current_count = cache.get(key, 0) + max(int(amount), 1)
    # Cache until end of the day
    midnight = timezone.now().replace(hour=23, minute=59, second=59, microsecond=0)
    cache_ttl = max(int((midnight - timezone.now()).total_seconds()), 60)
    cache.set(key, current_count, cache_ttl)
    return current_count


def normalize_plan_id(plan_id: Optional[str]) -> str:
    if not plan_id:
        return "starter"
    plan = str(plan_id).strip().lower()
    return PLAN_ALIASES.get(plan, plan)


def plan_rank(plan_id: Optional[str]) -> int:
    return PLAN_ORDER.get(normalize_plan_id(plan_id), 0)


def plan_allows(user_plan: Optional[str], required_plan: Optional[str]) -> bool:
    return plan_rank(user_plan) >= plan_rank(required_plan)


def allowed_plan_tiers(user_plan: Optional[str]) -> list:
    rank = plan_rank(user_plan)
    return [plan for plan, value in PLAN_ORDER.items() if value <= rank]


def get_user_plan(user) -> str:
    try:
        profile = getattr(user, "profile", None)
        if not profile:
            return "starter"
        raw_plan = getattr(profile, "subscription_plan_id", None)
        if not raw_plan:
            raw_plan = getattr(profile, "subscription_plan", None)
            if raw_plan and not isinstance(raw_plan, str):
                raw_plan = getattr(raw_plan, "plan_id", None)
        plan = normalize_plan_id(raw_plan) if raw_plan not in (None, "") else "starter"
        if plan in ("plus", "pro"):
            return plan
        if plan == "starter" and not (
            getattr(profile, "has_paid", False) or getattr(profile, "is_premium", False)
        ):
            return "starter"
        if getattr(profile, "has_paid", False) or getattr(profile, "is_premium", False):
            from finance.plan_resolution import resolve_plan_id_from_profile_stripe

            inferred = resolve_plan_id_from_profile_stripe(profile)
            if inferred in ("plus", "pro"):
                return inferred
            return "plus"
        if plan in PLAN_ORDER:
            return plan
    except Exception:
        pass
    return "starter"


def _build_feature_state(plan: str, feature: str, config: Dict) -> FeatureState:
    return FeatureState(
        name=config.get("label") or feature.replace("_", " ").title(),
        flag=FEATURE_FLAGS[feature],
        enabled=config.get("enabled", False),
        daily_quota=config.get("daily_quota"),
        description=config.get("description", ""),
    )


def _feature_usage(user_id: int, feature: str, daily_quota: Optional[int]) -> Dict:
    used_today = _get_usage(user_id, feature)
    remaining_today = None if daily_quota is None else max(daily_quota - used_today, 0)
    return {
        "used_today": used_today,
        "remaining_today": remaining_today,
    }


def get_entitlements_for_user(user) -> Dict:
    plan = get_user_plan(user)
    plan_config = PLAN_MATRIX.get(plan, PLAN_MATRIX["starter"])
    features = {}

    for feature_key, config in plan_config.get("features", {}).items():
        state = _build_feature_state(plan, feature_key, config)
        usage = _feature_usage(user.id, feature_key, state.daily_quota)
        features[feature_key] = {
            "name": state.name,
            "flag": state.flag,
            "enabled": state.enabled,
            "daily_quota": state.daily_quota,
            "description": state.description,
            **usage,
        }

    return {
        "plan": plan,
        "label": plan_config.get("label", plan.title()),
        "features": features,
    }


def get_plan_catalog(settings) -> Dict[str, list]:
    plans = []
    for plan in PLAN_CATALOG:
        plan_key = plan["entitlements_plan"]
        plan_config = PLAN_MATRIX.get(plan_key, PLAN_MATRIX["starter"])
        features = {}
        for feature_key, config in plan_config.get("features", {}).items():
            overrides = plan.get("feature_overrides", {}).get(feature_key, {})
            merged = {**config, **overrides}
            state = _build_feature_state(plan_key, feature_key, merged)
            features[feature_key] = {
                "name": state.name,
                "description": state.description,
                "enabled": state.enabled,
                "daily_quota": state.daily_quota,
            }

        stripe_price_id = getattr(settings, plan.get("stripe_price_setting", ""), "") or None

        plans.append(
            {
                "plan_id": plan["plan_id"],
                "name": plan["name"],
                "billing_interval": plan["billing_interval"],
                "price_amount": plan["price_amount"],
                "currency": plan["currency"],
                "trial_days": plan["trial_days"],
                "sort_order": plan["sort_order"],
                "stripe_price_id": stripe_price_id,
                "features": features,
            }
        )

    return {"plans": plans}


def check_and_consume_entitlement(user, feature: str, amount: int = 1) -> Tuple[bool, Dict]:
    entitlements = get_entitlements_for_user(user)
    feature_state = entitlements["features"].get(feature)

    if not feature_state or not feature_state.get("enabled"):
        return False, {
            "error": "This feature is available on Premium plans only.",
            "flag": FEATURE_FLAGS.get(feature, feature),
            "remaining_today": 0,
            "reason": "upgrade",
        }

    daily_quota = feature_state.get("daily_quota")
    if daily_quota is None:
        return True, {
            "remaining_today": None,
            "flag": feature_state.get("flag"),
            "reason": "ok",
        }

    used_today = _get_usage(user.id, feature)
    if used_today + max(int(amount), 1) > daily_quota:
        return False, {
            "error": "You have reached today's limit for this feature.",
            "flag": feature_state.get("flag"),
            "remaining_today": 0,
            "reason": "limit",
        }

    _increment_usage(user.id, feature, amount)
    return True, {
        "remaining_today": max(daily_quota - used_today - max(int(amount), 1), 0),
        "flag": feature_state.get("flag"),
        "reason": "ok",
    }


def entitlement_usage_snapshot(user) -> Dict:
    entitlements = get_entitlements_for_user(user)
    snapshot = {}

    for key, feature in entitlements["features"].items():
        snapshot[key] = {
            "remaining_today": feature.get("remaining_today"),
            "used_today": feature.get("used_today"),
            "flag": feature.get("flag"),
            "enabled": feature.get("enabled", False),
        }

    return snapshot
