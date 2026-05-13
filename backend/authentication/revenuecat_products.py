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
# Keep aliases for web/mobile naming drift across projects.
ENTITLEMENT_PLAN_MAP: dict[str, str] = {
    "Garzoni Plus": "plus",
    "Garzoni Pro": "pro",
    "Garzoni Educational Plus": "plus",
    "Garzoni Educational Pro": "pro",
}

_PLAN_RANK = {"starter": 0, "plus": 1, "pro": 2}


def plan_rank(plan_id: str | None) -> int:
    if not plan_id:
        return 0
    return _PLAN_RANK.get(plan_id, 0)


def validate_rc_plan_mappings() -> list[str]:
    """
    Validate RevenueCat identifier maps used for subscription parity.
    Returns a list of human-readable errors (empty when valid).
    """
    errors: list[str] = []
    allowed = {"plus", "pro"}
    product_values = set(PRODUCT_PLAN_MAP.values())
    entitlement_values = set(ENTITLEMENT_PLAN_MAP.values())

    if not {"plus", "pro"}.issubset(product_values):
        errors.append(
            "PRODUCT_PLAN_MAP must include at least one product id for both plus and pro."
        )
    if not {"plus", "pro"}.issubset(entitlement_values):
        errors.append(
            "ENTITLEMENT_PLAN_MAP must include at least one entitlement name for both plus and pro."
        )

    unknown_product_targets = sorted(product_values - allowed)
    if unknown_product_targets:
        errors.append(
            f"PRODUCT_PLAN_MAP has unsupported plan targets: {', '.join(unknown_product_targets)}."
        )

    unknown_entitlement_targets = sorted(entitlement_values - allowed)
    if unknown_entitlement_targets:
        errors.append(
            "ENTITLEMENT_PLAN_MAP has unsupported plan targets: "
            + ", ".join(unknown_entitlement_targets)
            + "."
        )
    return errors
