from __future__ import absolute_import, unicode_literals

# Use PyMySQL as MySQLdb so local dev works without mysqlclient C libs
try:
    import pymysql

    pymysql.install_as_MySQLdb()
except ImportError:
    pass

# This will make sure the app is always imported when
# Django starts, so Celery tasks can be recognized.
from .celery import app as celery_app

__all__ = ("celery_app",)
