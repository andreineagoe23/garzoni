# Encoding and user display

## Why this exists

User-facing text (names, usernames) can end up with **mojibake** (e.g. `RoÈ™u` instead of `Roșu`, `Â£` instead of `£`, `âš ï¸` instead of `⚠️`) when UTF-8 is misinterpreted as Latin-1/Windows-1252. To prevent this from appearing in API responses, admin, or emails, we centralize encoding normalization and user display.

## Centralized pieces

1. **`core.utils.normalize_text_encoding(text)`**
   Fixes common mojibake in any string (apostrophes, quotes, £, Romanian ș/ț/Î, ⚠️, etc.). Use for arbitrary user-facing text from DB or external sources.

2. **`authentication.user_display`**
   **Single source of truth for exposing user names.**
   - **`user_display_dict(user, include_id=..., include_email=..., include_staff=...)`**
     Returns a dict with normalized `username`, `first_name`, `last_name` (and optionally `id`, `email`, `is_staff`, `is_superuser`). Use whenever an API response or export includes user identity.
   - **`normalize_display_string(value)`**
     Returns normalized string for a single field (e.g. in serializers or email body).

## Rule for new code

**Do not** read `user.username`, `user.first_name`, or `user.last_name` directly for display or API responses. **Always** use:

- `authentication.user_display.user_display_dict(user, ...)` for payloads, or
- `authentication.user_display.normalize_display_string(user.username)` (or `.first_name` / `.last_name`) for a single field.

This keeps mojibake from reappearing and ensures one place to extend fixes (e.g. new character mappings in `normalize_text_encoding`).

## Fixing existing bad data

To correct values already stored in the DB (e.g. for Django admin):

```bash
python manage.py fix_user_mojibake --dry-run   # preview
python manage.py fix_user_mojibake             # apply
```

Optional: `--email` to also normalize the email field.
