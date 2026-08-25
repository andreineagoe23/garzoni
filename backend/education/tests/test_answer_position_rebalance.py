from collections import Counter
from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from education.management.commands.rebalance_mc_answer_positions import (
    assign_targets,
    build_permutation,
)
from education.models import (
    Course,
    Lesson,
    LessonSection,
    LessonSectionTranslation,
    Path,
    Quiz,
    QuizTranslation,
)


class BuildPermutationTests(TestCase):
    def test_places_correct_option_at_target(self):
        for target in range(4):
            perm = build_permutation(section_id=7, n=4, correct=1, target=target)
            self.assertEqual(perm[target], 1)
            self.assertCountEqual(perm, [0, 1, 2, 3])

    def test_is_deterministic_for_the_same_section(self):
        first = build_permutation(section_id=42, n=4, correct=0, target=2)
        second = build_permutation(section_id=42, n=4, correct=0, target=2)
        self.assertEqual(first, second)

    def test_distractors_are_not_left_in_original_order(self):
        # Across sections, at least some runs must reorder the wrong options —
        # otherwise the same three distractors keep the same relative sequence
        # and become a tell of their own.
        reordered = 0
        for section_id in range(50):
            perm = build_permutation(section_id, n=4, correct=0, target=0)
            if perm[1:] != [1, 2, 3]:
                reordered += 1
        self.assertGreater(reordered, 0)


class AssignTargetsTests(TestCase):
    def test_targets_are_evenly_spread(self):
        targets = assign_targets(list(range(400)), slots=4)
        counts = Counter(targets.values())
        self.assertEqual(sorted(counts), [0, 1, 2, 3])
        self.assertEqual(max(counts.values()) - min(counts.values()), 0)

    def test_targets_are_stable_across_calls(self):
        self.assertEqual(assign_targets(list(range(40)), 4), assign_targets(list(range(40)), 4))


class RebalanceCommandTests(TestCase):
    def setUp(self):
        path = Path.objects.create(title="Basic Finance", description="d")
        self.course = Course.objects.create(path=path, title="Budgeting", description="d")
        self.lesson = Lesson.objects.create(
            course=self.course,
            title="What is a budget?",
            short_description="d",
            detailed_content="<p>d</p>",
        )

    def _section(self, order, correct=1, published=True):
        return LessonSection.objects.create(
            lesson=self.lesson,
            order=order,
            title=f"Knowledge Check {order}",
            content_type="exercise",
            exercise_type="multiple-choice",
            is_published=published,
            exercise_data={
                "question": "Which is it?",
                "options": [f"opt{order}-a", f"opt{order}-b", f"opt{order}-c", f"opt{order}-d"],
                "correctAnswer": correct,
                "explanation": "because",
            },
        )

    def _run(self, **kwargs):
        out = StringIO()
        call_command("rebalance_mc_answer_positions", stdout=out, **kwargs)
        return out.getvalue()

    def test_correct_option_text_survives_the_move(self):
        section = self._section(1)
        before = section.exercise_data["options"][1]
        self._run()
        section.refresh_from_db()
        data = section.exercise_data
        self.assertEqual(data["options"][data["correctAnswer"]], before)
        self.assertCountEqual(data["options"], ["opt1-a", "opt1-b", "opt1-c", "opt1-d"])

    def test_dry_run_writes_nothing(self):
        section = self._section(1)
        original = dict(section.exercise_data)
        output = self._run(dry_run=True)
        section.refresh_from_db()
        self.assertEqual(section.exercise_data, original)
        self.assertIn("Dry run", output)

    def test_running_twice_is_idempotent(self):
        section = self._section(1)
        self._run()
        section.refresh_from_db()
        once = dict(section.exercise_data)
        self._run()
        section.refresh_from_db()
        self.assertEqual(section.exercise_data, once)

    def test_translation_options_move_in_lockstep(self):
        section = self._section(1)
        LessonSectionTranslation.objects.create(
            section=section,
            language="ro",
            title="Verificare",
            exercise_data={
                "question": "Care este?",
                "options": ["ro-a", "ro-b", "ro-c", "ro-d"],
                "correctAnswer": 1,
            },
        )
        self._run()
        section.refresh_from_db()
        tr = LessonSectionTranslation.objects.get(section=section, language="ro")
        target = section.exercise_data["correctAnswer"]
        self.assertEqual(tr.exercise_data["correctAnswer"], target)
        # English slot i and Romanian slot i must still be the same option.
        pairs = dict(
            zip(["opt1-a", "opt1-b", "opt1-c", "opt1-d"], ["ro-a", "ro-b", "ro-c", "ro-d"])
        )
        for en, ro in zip(section.exercise_data["options"], tr.exercise_data["options"]):
            self.assertEqual(pairs[en], ro)

    def test_mismatched_translation_is_dropped_not_scrambled(self):
        section = self._section(1)
        LessonSectionTranslation.objects.create(
            section=section,
            language="ro",
            title="Verificare",
            exercise_data={"question": "Care?", "options": ["ro-a", "ro-b"], "correctAnswer": 1},
        )
        self._run()
        tr = LessonSectionTranslation.objects.get(section=section, language="ro")
        self.assertIsNone(tr.exercise_data)
        self.assertEqual(tr.source_hash, "")

    def test_checkpoint_quiz_choices_follow_the_section(self):
        section = self._section(1)
        quiz = Quiz.objects.create(
            course=self.course,
            lesson=self.lesson,
            source_lesson_section=section,
            title="Knowledge Check 1",
            question="Which is it?",
            choices=[{"text": t} for t in ["opt1-a", "opt1-b", "opt1-c", "opt1-d"]],
            correct_answer="opt1-b",
        )
        self._run()
        section.refresh_from_db()
        quiz.refresh_from_db()
        data = section.exercise_data
        self.assertEqual([c["text"] for c in quiz.choices], data["options"])
        self.assertEqual(quiz.correct_answer, "opt1-b")
        self.assertEqual(quiz.choices[data["correctAnswer"]]["text"], "opt1-b")

    def test_quiz_translation_follows_the_section_translation(self):
        section = self._section(1)
        LessonSectionTranslation.objects.create(
            section=section,
            language="ro",
            title="Verificare",
            exercise_data={
                "question": "Care este?",
                "options": ["ro-a", "ro-b", "ro-c", "ro-d"],
                "correctAnswer": 1,
            },
        )
        quiz = Quiz.objects.create(
            course=self.course,
            lesson=self.lesson,
            source_lesson_section=section,
            title="Knowledge Check 1",
            question="Which is it?",
            choices=[{"text": t} for t in ["opt1-a", "opt1-b", "opt1-c", "opt1-d"]],
            correct_answer="opt1-b",
        )
        qt = QuizTranslation.objects.create(
            quiz=quiz,
            language="ro",
            title="Verificare",
            question="Care este?",
            choices=[{"text": t} for t in ["ro-a", "ro-b", "ro-c", "ro-d"]],
            correct_answer="ro-b",
        )
        self._run()
        qt.refresh_from_db()
        section.refresh_from_db()
        self.assertEqual(qt.correct_answer, "ro-b")
        self.assertEqual(
            qt.choices[section.exercise_data["correctAnswer"]]["text"],
            "ro-b",
        )

    def test_unpublished_sections_are_skipped_by_default(self):
        section = self._section(1, published=False)
        original = dict(section.exercise_data)
        self._run()
        section.refresh_from_db()
        self.assertEqual(section.exercise_data, original)

    def test_unusable_correct_answer_is_reported_not_written(self):
        section = self._section(1)
        section.exercise_data = {**section.exercise_data, "correctAnswer": "b"}
        section.save(update_fields=["exercise_data"])
        output = self._run()
        section.refresh_from_db()
        self.assertEqual(section.exercise_data["correctAnswer"], "b")
        self.assertIn("unusable correctAnswer", output)

    def test_distribution_is_spread_across_all_four_slots(self):
        for order in range(1, 41):
            self._section(order, correct=1)
        self._run()
        counts = Counter(
            s.exercise_data["correctAnswer"]
            for s in LessonSection.objects.filter(exercise_type="multiple-choice")
        )
        self.assertEqual(sorted(counts), [0, 1, 2, 3])
        self.assertLessEqual(max(counts.values()) - min(counts.values()), 1)
