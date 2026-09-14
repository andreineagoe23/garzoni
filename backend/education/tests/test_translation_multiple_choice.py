import json
from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from education.services.translation import OpenAITranslator

EXERCISE = {
    "question": "What should you do with €100 left over?",
    "options": ["Leave it", "Assign the €100 to a goal", "Spend it", "Withdraw €50"],
    "correctAnswer": 1,
    "explanation": "Give every euro a job.",
}


def _reply(**overrides):
    body = {
        "question": "Ce faci cu 100 € rămași?",
        "options": ["Îi lași.", "Aloci cei 100 € unui scop", "Îi cheltui", "Retragi 50 €"],
        "explanation": "Dă fiecărui euro un rol.",
    }
    body.update(overrides)
    return json.dumps(body, ensure_ascii=False)


@override_settings(OPENAI_API_KEY="test")
class MultipleChoiceTranslationTests(SimpleTestCase):
    def test_translates_the_question_in_one_call(self):
        with patch.object(OpenAITranslator, "_call_api", return_value=_reply()) as call:
            out = OpenAITranslator().translate_exercise(EXERCISE)
        self.assertEqual(call.call_count, 1)
        self.assertEqual(out["question"], "Ce faci cu 100 € rămași?")
        self.assertEqual(out["correctAnswer"], 1)
        self.assertEqual(len(out["options"]), 4)

    def test_option_does_not_gain_a_full_stop_the_english_lacks(self):
        with patch.object(OpenAITranslator, "_call_api", return_value=_reply()):
            out = OpenAITranslator().translate_exercise(EXERCISE)
        self.assertEqual(out["options"][0], "Îi lași")

    def test_accepts_a_fenced_json_reply(self):
        fenced = "```json\n" + _reply() + "\n```"
        with patch.object(OpenAITranslator, "_call_api", return_value=fenced) as call:
            OpenAITranslator().translate_exercise(EXERCISE)
        self.assertEqual(call.call_count, 1)

    def test_wrong_option_count_falls_back_to_per_string(self):
        replies = [_reply(options=["a", "b", "c"])] + ["ro"] * 6
        with patch.object(OpenAITranslator, "_call_api", side_effect=replies) as call:
            out = OpenAITranslator().translate_exercise(EXERCISE)
        self.assertEqual(call.call_count, 7)
        self.assertEqual(len(out["options"]), 4)

    def test_reordered_numeric_options_fall_back_to_per_string(self):
        swapped = ["Îi lași", "Retragi 50 €", "Îi cheltui", "Aloci cei 100 € unui scop"]
        replies = [_reply(options=swapped)] + ["ro"] * 6
        with patch.object(OpenAITranslator, "_call_api", side_effect=replies) as call:
            OpenAITranslator().translate_exercise(EXERCISE)
        self.assertEqual(call.call_count, 7)
