from django.test import SimpleTestCase, RequestFactory

from education.utils import get_request_language


class RequestLanguageTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def test_defaults_to_english_when_no_request(self):
        self.assertEqual(get_request_language(None), "en")

    def test_uses_x_app_language_when_present(self):
        request = self.factory.get("/", HTTP_X_APP_LANGUAGE="ro")
        self.assertEqual(get_request_language(request), "ro")

    def test_accept_language_parsing(self):
        request = self.factory.get("/", HTTP_ACCEPT_LANGUAGE="ro-RO,ro;q=0.9,en;q=0.8")
        self.assertEqual(get_request_language(request), "ro")

    def test_unsupported_language_falls_back(self):
        request = self.factory.get("/", HTTP_ACCEPT_LANGUAGE="fr-FR,fr;q=0.9")
        self.assertEqual(get_request_language(request), "en")

    def test_x_app_language_overrides_accept_language(self):
        request = self.factory.get(
            "/",
            HTTP_X_APP_LANGUAGE="ro",
            HTTP_ACCEPT_LANGUAGE="en-US,en;q=0.9",
        )
        self.assertEqual(get_request_language(request), "ro")
