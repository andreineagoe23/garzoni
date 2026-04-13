"""Sanitization for malformed Cloudinary delivery URLs."""

from django.test import SimpleTestCase

from core.media_url import sanitize_media_delivery_url


class SanitizeMediaDeliveryUrlTests(SimpleTestCase):
    def test_fixes_v1_media_segment(self):
        bad = (
            "https://res.cloudinary.com/daqvqm710/image/upload/v1/media/garzoni/personalfinance"
        )
        fixed = sanitize_media_delivery_url(bad)
        self.assertIn("/image/upload/f_auto,q_auto,w_800/garzoni/personalfinance", fixed)
        self.assertNotIn("/v1/media/", fixed)

    def test_rewards_get_jpg_when_extension_missing(self):
        u = "https://res.cloudinary.com/daqvqm710/image/upload/f_auto,q_auto/garzoni/rewards/LearningPath"
        fixed = sanitize_media_delivery_url(u)
        self.assertTrue(fixed.endswith("LearningPath.jpg"))

    def test_protocol_relative_cloudinary(self):
        u = "//res.cloudinary.com/x/image/upload/v1/media/garzoni/foo"
        fixed = sanitize_media_delivery_url(u)
        self.assertTrue(fixed.startswith("https://"))
