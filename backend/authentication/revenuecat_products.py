"""
RevenueCat ↔ Garzoni plan identifiers.

Keep in sync with mobile `PRODUCT_TO_PLAN` / ASC product IDs.
"""

# Map App Store / Play product identifier → internal plan ID.
PRODUCT_PLAN_MAP: dict[str, str] = {
    # v3 — current production (App Store Connect)
    "app.garzoni.mobile.plus_monthly_v3": "plus",
    "app.garzoni.mobile.plus_yearly_v3": "plus",
    "app.garzoni.mobile.pro_monthly_v3": "pro",
    "app.garzoni.mobile.pro_yearly_v3": "pro",
    # v2 — sandbox / test store
    "app.garzoni.mobile.plus_monthly_v2": "plus",
    "app.garzoni.mobile.plus_yearly_v2": "plus",
    "app.garzoni.mobile.pro_monthly_v2": "pro",
    "app.garzoni.mobile.pro_yearly_v2": "pro",
    # v1 — legacy, keep for existing subscribers
    "app.garzoni.mobile.plus_monthly": "plus",
    "app.garzoni.mobile.plus_yearly": "plus",
    "app.garzoni.mobile.pro_monthly": "pro",
    "app.garzoni.mobile.pro_yearly": "pro",
    # alternate bundle legacy IDs (some dashboards / migrations)
    "tech.garzoni.app.plus_monthly": "plus",
    "tech.garzoni.app.plus_yearly": "plus",
    "tech.garzoni.app.pro_monthly": "pro",
    "tech.garzoni.app.pro_yearly": "pro",
}

# RevenueCat dashboard entitlement identifiers → plan.
ENTITLEMENT_PLAN_MAP: dict[str, str] = {
    "Garzoni Plus": "plus",
    "Garzoni Pro": "pro",
}

_PLAN_RANK = {"starter": 0, "plus": 1, "pro": 2}


def plan_rank(plan_id: str | None) -> int:
    if not plan_id:
        return 0
    return _PLAN_RANK.get(plan_id, 0)
