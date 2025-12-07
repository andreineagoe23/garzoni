from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsStaffOrSuperuser(BasePermission):
    """Allow write operations only for staff or superusers."""

    message = "Administrative privileges required to modify lessons."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)

        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_staff or request.user.is_superuser)
        )
