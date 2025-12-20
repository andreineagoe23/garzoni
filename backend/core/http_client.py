"""
Shared external HTTP client utilities.

- Connection pooling via a module-level requests.Session()
- Retry with exponential backoff + jitter for safe/idempotent calls
- Respect Retry-After for 429 responses when present

Important: never log raw request bodies/prompts from here.
"""

from __future__ import annotations

import random
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

import requests
from django.conf import settings
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


_SESSION: Optional[requests.Session] = None


def get_shared_session() -> requests.Session:
    global _SESSION
    if _SESSION is not None:
        return _SESSION

    s = requests.Session()

    # Pooling + conservative retries for GET/HEAD/OPTIONS via urllib3 Retry.
    # We still do our own manual retry loop for cases where we need jitter or POST idempotency.
    retry = Retry(
        total=0,  # manual retry handles it; keep adapter retries off to avoid double retry
        connect=0,
        read=0,
        status=0,
        backoff_factor=0,
        respect_retry_after_header=True,
        raise_on_status=False,
    )
    adapter = HTTPAdapter(
        max_retries=retry,
        pool_connections=int(getattr(settings, "HTTP_POOL_CONNECTIONS", 20)),
        pool_maxsize=int(getattr(settings, "HTTP_POOL_MAXSIZE", 20)),
    )
    s.mount("https://", adapter)
    s.mount("http://", adapter)

    _SESSION = s
    return s


@dataclass(frozen=True)
class ExternalRequestResult:
    response: requests.Response
    elapsed_ms: int
    attempts: int


def _parse_retry_after_seconds(value: Optional[str]) -> Optional[int]:
    if not value:
        return None
    try:
        seconds = int(value.strip())
        if seconds < 0:
            return None
        return seconds
    except Exception:
        return None


def request_with_backoff(
    *,
    method: str,
    url: str,
    timeout: Optional[float] = None,
    headers: Optional[Dict[str, str]] = None,
    params: Optional[Dict[str, Any]] = None,
    json: Optional[Dict[str, Any]] = None,
    data: Optional[Dict[str, Any]] = None,
    allow_retry: bool = True,
    max_attempts: int = 3,
    retry_statuses: Tuple[int, ...] = (429, 502, 503, 504),
    base_backoff_s: float = 0.5,
    jitter_s: float = 0.25,
) -> ExternalRequestResult:
    """
    Perform an external HTTP request with explicit retries.

    Retry policy:
    - Retries on Timeout / ConnectionError
    - Retries on status codes in retry_statuses
    - Never retries on 400/401/403 (fast fail)
    - Respects Retry-After for 429 when present
    """

    session = get_shared_session()
    if timeout is None:
        timeout = float(getattr(settings, "EXTERNAL_REQUEST_TIMEOUT_SECONDS", 15))

    attempts = 0
    start = time.monotonic()
    last_exc: Optional[Exception] = None

    while True:
        attempts += 1
        try:
            resp = session.request(
                method=method.upper(),
                url=url,
                headers=headers,
                params=params,
                json=json,
                data=data,
                timeout=timeout,
            )

            status = resp.status_code
            if not allow_retry or attempts >= max_attempts:
                break

            # Fast-fail on client errors (except 429).
            if status in (400, 401, 403):
                break

            if status in retry_statuses:
                retry_after = _parse_retry_after_seconds(resp.headers.get("Retry-After"))
                if retry_after is not None:
                    sleep_s = min(60.0, float(retry_after))
                else:
                    exp = base_backoff_s * (2 ** (attempts - 1))
                    sleep_s = min(30.0, exp + random.uniform(0, jitter_s))
                time.sleep(sleep_s)
                continue

            break
        except (requests.Timeout, requests.ConnectionError) as exc:
            last_exc = exc
            if not allow_retry or attempts >= max_attempts:
                raise
            exp = base_backoff_s * (2 ** (attempts - 1))
            sleep_s = min(30.0, exp + random.uniform(0, jitter_s))
            time.sleep(sleep_s)
            continue

    elapsed_ms = int((time.monotonic() - start) * 1000)
    return ExternalRequestResult(response=resp, elapsed_ms=elapsed_ms, attempts=attempts)
