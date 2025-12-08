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
}


PLAN_MATRIX: Dict[str, Dict[str, Dict]] = {
    "free": {
        "label": "Free",
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
                "description": "Streak repairs are premium only",
            },
            "downloads": {
                "enabled": True,
                "daily_quota": 1,
                "description": "One certificate/share card download daily",
            },
            "analytics": {
                "enabled": False,
                "description": "Advanced analytics locked to premium",
            },
            "ai_tutor": {
                "enabled": True,
                "daily_quota": 5,
                "description": "Five AI tutor prompts per day",
            },
        },
    },
    "premium": {
        "label": "Premium",
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
        },
    },
}


def _usage_cache_key(user_id: int, feature: str) -> str:
    today = timezone.now().date().isoformat()
    return f"entitlement:{feature}:{user_id}:{today}"


def _get_usage(user_id: int, feature: str) -> int:
    return cache.get(_usage_cache_key(user_id, feature), 0)


def _increment_usage(user_id: int, feature: str) -> int:
    key = _usage_cache_key(user_id, feature)
    current_count = cache.get(key, 0) + 1
    # Cache until end of the day
    midnight = timezone.now().replace(hour=23, minute=59, second=59, microsecond=0)
    cache_ttl = max(int((midnight - timezone.now()).total_seconds()), 60)
    cache.set(key, current_count, cache_ttl)
    return current_count


def get_user_plan(user) -> str:
    try:
        if hasattr(user, "profile") and user.profile.has_paid:
            return "premium"
    except Exception:
        pass
    return "free"


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
    plan_config = PLAN_MATRIX.get(plan, PLAN_MATRIX["free"])
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


def check_and_consume_entitlement(user, feature: str) -> Tuple[bool, Dict]:
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
    if used_today >= daily_quota:
        return False, {
            "error": "You have reached today’s limit for this feature.",
            "flag": feature_state.get("flag"),
            "remaining_today": 0,
            "reason": "limit",
        }

    _increment_usage(user.id, feature)
    return True, {
        "remaining_today": max(daily_quota - used_today - 1, 0),
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
