import json

from django.test import TestCase

from education.exercise_quality import length_problem, target_length_band
from education.management.commands.rewrite_exercise_sections import (
    FEW_SHOT_EXAMPLES,
    MAX_LENGTH_RATIO,
    MIN_OPTION_CHARS,
    _build_system_prompt,
    _build_user_prompt,
    _validate,
)

BALANCED = [
    "A plan for where your money goes before the month starts",
    "A record of where your money went during last month",
    "A signal to your bank that you handle your money well",
    "A total of the income you expect to earn over a year",
]


def candidate(**overrides):
    data = {
        "question": "Which best describes a budget?",
        "options": list(BALANCED),
        "correct_index": 0,
        "hints": ["It happens before you spend"],
        "explanation": "A budget is a plan, not a record.",
    }
    data.update(overrides)
    return data


class ValidateTests(TestCase):
    def test_accepts_a_balanced_candidate(self):
        self.assertIsNone(_validate(candidate(), 0))

    def test_rejects_answer_in_the_wrong_slot(self):
        err = _validate(candidate(correct_index=1), 0)
        self.assertIn("correct_index must be 0", err)

    def test_rejects_missing_correct_index(self):
        data = candidate()
        del data["correct_index"]
        self.assertIn("correct_index missing", _validate(data, 0))

    def test_rejects_boolean_correct_index(self):
        # True == 1 in Python, so a bare int check would let this through and
        # silently mark option 1 correct.
        self.assertIn("correct_index missing", _validate(candidate(correct_index=True), 1))

    def test_rejects_uneven_option_lengths(self):
        options = list(BALANCED)
        options[0] = (
            "A forward-looking plan that assigns every single pound or euro of your "
            "income to a named job before the month even begins, so nothing is left unallocated"
        )
        err = _validate(candidate(options=options), 0)
        self.assertIn("too uneven in length", err)

    def test_rejects_correct_option_that_is_clearly_the_longest(self):
        # Inside the ratio gate, but the answer still stands out.
        options = [
            "A plan for where your money goes before the month even begins now",
            "A record of where the money went",
            "A signal to your bank about you",
            "A total of your yearly income",
        ]
        err = _validate(candidate(options=options), 0)
        self.assertTrue(
            "longest by too much" in err or "too uneven in length" in err,
            err,
        )

    def test_rejects_one_word_options(self):
        err = _validate(candidate(options=["Yes", "No", "Maybe", "Sometimes"]), 0)
        self.assertIn(f"at least {MIN_OPTION_CHARS} characters", err)

    def test_rejects_duplicate_options(self):
        options = list(BALANCED)
        options[2] = options[1]
        self.assertIn("all be different", _validate(candidate(options=options), 0))

    def test_rejects_wrong_option_count(self):
        self.assertIn("exactly 4", _validate(candidate(options=BALANCED[:3]), 0))

    def test_rejects_non_object(self):
        self.assertIn("not a JSON object", _validate(["a", "b"], 0))


class TargetLengthBandTests(TestCase):
    def test_band_is_inside_the_ratio_gate(self):
        for options in (BALANCED, ["a" * 30] * 4, ["b" * 120] * 4, ["c" * 10] * 4, []):
            low, mid, high = target_length_band(options)
            with self.subTest(options=len(options)):
                self.assertLessEqual(high / low, MAX_LENGTH_RATIO)
                self.assertGreaterEqual(low, MIN_OPTION_CHARS)
                self.assertLessEqual(low, mid)

    def test_band_tracks_the_existing_option_length(self):
        _, short_mid, _ = target_length_band(["x" * 45] * 4)
        _, long_mid, _ = target_length_band(["x" * 90] * 4)
        self.assertLess(short_mid, long_mid)

    def test_options_written_to_the_band_pass_validation(self):
        low, mid, high = target_length_band(BALANCED)
        options = [("opt%d " % i).ljust(mid, "x") for i in range(4)]
        self.assertIsNone(length_problem(options, 0))


class PromptTests(TestCase):
    def test_few_shot_examples_do_not_all_use_the_same_slot(self):
        # The original two examples both answered at index 1, and the corpus
        # came out 75% index 1 with index 3 never used.
        slots = [json.loads(e["assistant"])["correct_index"] for e in FEW_SHOT_EXAMPLES]
        self.assertEqual(len(set(slots)), len(slots), f"examples reuse a slot: {slots}")

    def test_every_few_shot_example_passes_its_own_validator(self):
        for example in FEW_SHOT_EXAMPLES:
            payload = json.loads(example["assistant"])
            with self.subTest(question=payload["question"][:40]):
                self.assertIsNone(_validate(payload, payload["correct_index"]))

    def test_system_prompt_states_the_length_limit(self):
        prompt = _build_system_prompt("STANDARDS")
        self.assertIn(f"{MAX_LENGTH_RATIO:.2f}", prompt)
        self.assertIn(str(MIN_OPTION_CHARS), prompt)
        self.assertIn("correct_index", prompt)

    def test_user_prompt_names_the_target_slot(self):
        prompt = _build_user_prompt(
            "Basic Finance",
            "Budgeting",
            "What is a budget?",
            "Knowledge Check 1",
            {"question": "q", "options": ["a", "b"], "hints": [], "explanation": ""},
            2,
        )
        self.assertIn("TARGET ANSWER INDEX: 2", prompt)
        self.assertIn("TARGET OPTION LENGTH", prompt)
        self.assertNotIn("YOUR PREVIOUS ANSWER WAS REJECTED", prompt)

    def test_retry_prompt_carries_the_rejection_reason(self):
        prompt = _build_user_prompt(
            "Basic Finance",
            "Budgeting",
            "What is a budget?",
            "Knowledge Check 1",
            {"question": "q", "options": ["a", "b"], "hints": [], "explanation": ""},
            2,
            retry_note="options are too uneven in length",
        )
        self.assertIn("YOUR PREVIOUS ANSWER WAS REJECTED", prompt)
        self.assertIn("too uneven in length", prompt)
