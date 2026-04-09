from whitenoise.storage import CompressedManifestStaticFilesStorage


class NonStrictCompressedManifestStaticFilesStorage(CompressedManifestStaticFilesStorage):
    """WhiteNoise storage that doesn't crash on missing CSS/JS references (e.g. Django 4.2 admin)."""
    manifest_strict = False
