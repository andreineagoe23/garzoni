from collections import Counter
from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from education.models import (
    Course,
    Exercise,
    ExerciseTranslation,
    Lesson,
    LessonSection,
    MultipleChoiceChoice,
    Path,
    Quiz,
)


def run(**kwargs):
    out = StringIO()
    call_command("rebalance_catalog_answer_positions", stdout=out, **kwargs)
    return out.getvalue()


class ExerciseRebalanceTests(TestCase):
    def _exercise(self, n, correct=0):
        return Exercise.objects.create(
            type="multiple-choice",
            question=f"Question {n}?",
            exercise_data={"options": [f"{n}-a", f"{n}-b", f"{n}-c", f"{n}-d"], "hints": []},
            correct_answer=correct,
            category="Budgeting",
            is_published=True,
        )

    def test_correct_option_text_survives(self):
        ex = self._exercise(1, correct=0)
        run()
        ex.refresh_from_db()
        self.assertEqual(ex.exercise_data["options"][ex.correct_answer], "1-a")
        self.assertCountEqual(ex.exercise_data["options"], ["1-a", "1-b", "1-c", "1-d"])

    def test_is_idempotent(self):
        ex = self._exercise(1)
        run()
        ex.refresh_from_db()
        once = (dict(ex.exercise_data), ex.correct_answer)
        run()
        ex.refresh_from_db()
        self.assertEqual((dict(ex.exercise_data), ex.correct_answer), once)

    def test_dry_run_writes_nothing(self):
        ex = self._exercise(1)
        before = (dict(ex.exercise_data), ex.correct_answer)
        run(dry_run=True)
        ex.refresh_from_db()
        self.assertEqual((dict(ex.exercise_data), ex.correct_answer), before)

    def test_translation_moves_in_lockstep(self):
        ex = self._exercise(1, correct=0)
        ExerciseTranslation.objects.create(
            exercise=ex,
            language="ro",
            question="Intrebare?",
            exercise_data={"options": ["ro-a", "ro-b", "ro-c", "ro-d"]},
        )
        run()
        ex.refresh_from_db()
        tr = ExerciseTranslation.objects.get(exercise=ex, language="ro")
        pairs = dict(zip(["1-a", "1-b", "1-c", "1-d"], ["ro-a", "ro-b", "ro-c", "ro-d"]))
        for en, ro in zip(ex.exercise_data["options"], tr.exercise_data["options"]):
            self.assertEqual(pairs[en], ro)

    def test_choice_rows_are_rebuilt_from_exercise_data(self):
        # The admin writes exercise_data BACK from these rows on save. They held
        # placeholder text, so an admin save replaced real content with
        # boilerplate — and would have undone this rebalance.
        ex = self._exercise(1, correct=0)
        for i, junk in enumerate(
            [
                "Apply: placeholder",
                "Memorize definitions without context",
                "Ignore practical application",
                "Skip straight to the next lesson",
            ]
        ):
            MultipleChoiceChoice.objects.create(
                exercise=ex, order=i, text=junk, is_correct=(i == 0)
            )
        run()
        ex.refresh_from_db()
        rows = list(ex.multiple_choice_choices.order_by("order"))
        self.assertEqual([r.text for r in rows], ex.exercise_data["options"])
        self.assertEqual([r.order for r in rows], [0, 1, 2, 3])
        self.assertEqual([k for k, r in enumerate(rows) if r.is_correct], [ex.correct_answer])

    def test_exercise_without_choice_rows_is_left_alone(self):
        ex = self._exercise(1)
        run()
        self.assertEqual(ex.multiple_choice_choices.count(), 0)

    def test_slots_are_spread(self):
        for n in range(40):
            self._exercise(n, correct=0)
        run()
        counts = Counter(e.correct_answer for e in Exercise.objects.filter(type="multiple-choice"))
        self.assertEqual(sorted(counts), [0, 1, 2, 3])
        self.assertLessEqual(max(counts.values()) - min(counts.values()), 1)


class QuizRebalanceTests(TestCase):
    def setUp(self):
        path = Path.objects.create(title="Basic Finance", description="d")
        self.course = Course.objects.create(path=path, title="Budgeting", description="d")
        self.lesson = Lesson.objects.create(
            course=self.course, title="L", short_description="d", detailed_content="<p>d</p>"
        )

    def _quiz(self, n, correct_idx=1, section=None):
        texts = [f"{n}-a", f"{n}-b", f"{n}-c", f"{n}-d"]
        return Quiz.objects.create(
            course=self.course,
            lesson=self.lesson,
            source_lesson_section=section,
            title=f"Quiz {n}",
            question="Q?",
            choices=[{"text": t} for t in texts],
            correct_answer=texts[correct_idx],
        )

    def test_correct_answer_text_still_present_after_move(self):
        q = self._quiz(1, correct_idx=1)
        run()
        q.refresh_from_db()
        texts = [c["text"] for c in q.choices]
        self.assertIn(q.correct_answer, texts)
        self.assertEqual(q.correct_answer, "1-b")
        self.assertCountEqual(texts, ["1-a", "1-b", "1-c", "1-d"])

    def test_checkpoint_quizzes_are_not_touched(self):
        section = LessonSection.objects.create(
            lesson=self.lesson,
            order=3,
            title="Knowledge Check 1",
            content_type="exercise",
            exercise_type="multiple-choice",
            exercise_data={"options": ["a", "b", "c", "d"], "correctAnswer": 1},
        )
        q = self._quiz(9, correct_idx=1, section=section)
        before = list(q.choices)
        run()
        q.refresh_from_db()
        self.assertEqual(q.choices, before)

    def test_is_idempotent(self):
        q = self._quiz(1)
        run()
        q.refresh_from_db()
        once = list(q.choices)
        run()
        q.refresh_from_db()
        self.assertEqual(q.choices, once)
