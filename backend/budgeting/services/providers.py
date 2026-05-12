"""
Pluggable provider abstraction for open-banking integrations.

The default provider is a no-op safe fallback so the feature can ship in regions
without bank linking and gracefully expose ``provider.enabled = False`` to the
client. A real provider (Plaid, Tink, TrueLayer, …) is selected via
``settings.BUDGETING_PROVIDER`` and registered through :func:`get_provider`.
"""

from __future__ import annotations

import abc
import logging
from dataclasses import dataclass
from typing import Iterable, List, Optional

from django.conf import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class NormalizedTransaction:
    provider_transaction_id: str
    posted_at: str  # ISO date
    amount: float
    currency: str
    description: str
    merchant_name: str
    provider_category_raw: str
    is_pending: bool = False


@dataclass(frozen=True)
class NormalizedAccount:
    provider_account_id: str
    display_name: str
    mask: str
    institution_name: str
    currency: str


@dataclass(frozen=True)
class ProviderStatus:
    enabled: bool
    provider: Optional[str]
    region: Optional[str]
    ready: bool


class BudgetingProvider(abc.ABC):
    """Abstract base class. Implementations should be small and stateless."""

    name: str = "unknown"

    @abc.abstractmethod
    def status(self) -> ProviderStatus:  # pragma: no cover - interface
        ...

    @abc.abstractmethod
    def create_link_url(self, user) -> str:  # pragma: no cover - interface
        ...

    @abc.abstractmethod
    def exchange_public_token(
        self, user, public_token: str
    ) -> NormalizedAccount:  # pragma: no cover - interface
        ...

    @abc.abstractmethod
    def list_accounts(self, user) -> Iterable[NormalizedAccount]:  # pragma: no cover
        ...

    @abc.abstractmethod
    def fetch_transactions(
        self, user, since_iso_date: str
    ) -> List[NormalizedTransaction]:  # pragma: no cover
        ...

    def verify_webhook_signature(self, raw_body: bytes, signature_header: str) -> bool:
        """Override in real providers; default rejects everything."""
        return False


class DisabledProvider(BudgetingProvider):
    """Safe no-op provider used when no integration is configured."""

    name = "disabled"

    def status(self) -> ProviderStatus:
        return ProviderStatus(
            enabled=False,
            provider=None,
            region=getattr(settings, "BUDGETING_REGION", None),
            ready=False,
        )

    def create_link_url(self, user) -> str:
        raise RuntimeError("Bank linking is not configured for this environment.")

    def exchange_public_token(self, user, public_token: str) -> NormalizedAccount:
        raise RuntimeError("Bank linking is not configured for this environment.")

    def list_accounts(self, user) -> Iterable[NormalizedAccount]:
        return []

    def fetch_transactions(self, user, since_iso_date: str) -> List[NormalizedTransaction]:
        return []


class PlaidProvider(BudgetingProvider):
    """Skeleton Plaid integration.

    Implements the public surface needed by the rest of the codebase but defers
    actual HTTP calls until credentials are present. This keeps unit tests fast
    and avoids importing the Plaid SDK at module load.
    """

    name = "plaid"

    def __init__(self) -> None:
        self.client_id = getattr(settings, "PLAID_CLIENT_ID", "")
        self.secret = getattr(settings, "PLAID_SECRET", "")
        self.env = getattr(settings, "PLAID_ENV", "sandbox")

    def status(self) -> ProviderStatus:
        ready = bool(self.client_id and self.secret)
        return ProviderStatus(
            enabled=True,
            provider="plaid",
            region=getattr(settings, "BUDGETING_REGION", None),
            ready=ready,
        )

    def create_link_url(self, user) -> str:
        # Concrete implementation would call /link/token/create and return the
        # Plaid Link redirect URL. Returning a tokenised placeholder lets the
        # client flow be exercised end-to-end without live keys.
        if not self.status().ready:
            raise RuntimeError("Plaid credentials are not configured.")
        return f"https://link.plaid.com/?token=PENDING_USER_{user.id}"

    def exchange_public_token(self, user, public_token: str) -> NormalizedAccount:
        if not self.status().ready:
            raise RuntimeError("Plaid credentials are not configured.")
        # TODO: implement /item/public_token/exchange + /accounts/get
        raise NotImplementedError("Plaid token exchange not implemented.")

    def list_accounts(self, user) -> Iterable[NormalizedAccount]:
        return []

    def fetch_transactions(self, user, since_iso_date: str) -> List[NormalizedTransaction]:
        return []


_PROVIDER_CACHE: Optional[BudgetingProvider] = None


def get_provider() -> BudgetingProvider:
    """Return the configured provider (memoised)."""
    global _PROVIDER_CACHE
    if _PROVIDER_CACHE is not None:
        return _PROVIDER_CACHE
    name = getattr(settings, "BUDGETING_PROVIDER", "disabled").lower()
    if name == "plaid":
        _PROVIDER_CACHE = PlaidProvider()
    else:
        _PROVIDER_CACHE = DisabledProvider()
    return _PROVIDER_CACHE


def reset_provider_cache_for_tests() -> None:  # pragma: no cover - test helper
    global _PROVIDER_CACHE
    _PROVIDER_CACHE = None
