"""Gunicorn config: quieter access logs + request-id in each line."""

from gunicorn.glogging import Logger

bind = "0.0.0.0:8000"
worker_class = "gthread"
timeout = 60
graceful_timeout = 30
keepalive = 5
max_requests = 1000
max_requests_jitter = 100

accesslog = "-"
access_log_format = '%(h)s "%(r)s" %(s)s %(b)sb %(L)ss rid=%({x-request-id}o)s'

_SKIP_ACCESS_PREFIXES = ("/static/", "/media/")
_SKIP_ACCESS_PATHS = frozenset({"/health/", "/healthz", "/api/health"})


class QuietStaticMediaLogger(Logger):
    """Drop access lines for static assets, media, and health probes."""

    def access(self, resp, req, environ, request_time):
        path = environ.get("PATH_INFO", "")
        if path.startswith(_SKIP_ACCESS_PREFIXES):
            return
        if path in _SKIP_ACCESS_PATHS or path.rstrip("/") == "/api/health":
            return
        super().access(resp, req, environ, request_time)


logger_class = QuietStaticMediaLogger
