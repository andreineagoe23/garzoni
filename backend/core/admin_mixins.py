"""Shared Django-admin mixins for protecting sensitive / system-generated data.

Many models are written by application logic (provider webhooks, RevenueCat
sync, reward grants, signals) rather than by hand. Allowing ad-hoc inserts or
deletes through the admin bypasses that logic and can corrupt billing,
entitlement, or analytics state. These mixins keep such models inspectable and
editable for support fixes, but lock the dangerous operations.
"""


class NoAddDeleteAdminMixin:
    """Allow viewing and editing existing rows, but no manual add or delete.

    For financial / entitlement / system-generated records where hand-creating
    or deleting a row would bypass business logic.
    """

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class ReadOnlyAdminMixin:
    """Fully read-only admin: view only, no add / change / delete.

    For audit / ledger / idempotency records that must never be mutated.
    """

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
