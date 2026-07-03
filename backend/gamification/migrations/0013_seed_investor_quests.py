from django.db import migrations

# Only step types with a live auto-advance receiver in gamification/signals.py
# are used here: "lesson", "exercise", "tool". No "chat"/envelope/paper-trade
# steps — those have no signal yet and would render as dead steps.
QUESTS = [
    {
        "slug": "investors-week",
        "name": "The Investor's Week",
        "description": "Link an investing lesson to real practice and the portfolio tool.",
        "mission_type": "weekly",
        "points_reward": 200,
        "badge_name": "Market Ready",
        "steps": [
            {
                "id": "lesson-investing",
                "type": "lesson",
                "title": "Read an Investing lesson",
                "course_topic": "investing",
                "route": "/all-topics?topic=investing",
            },
            {
                "id": "practice-investing",
                "type": "exercise",
                "title": "Complete 5 Investing exercises",
                "exercise_category": "Investing",
                "target_count": 5,
                "route": "/exercises?skill=Investing&intentReason=mission_step",
            },
            {
                "id": "tool-portfolio",
                "type": "tool",
                "title": "Open the Portfolio tool",
                "tool_slug": "portfolio",
                "route": "/tools/portfolio",
            },
        ],
    },
    {
        "slug": "saver-setup-week",
        "name": "Set Up to Save",
        "description": "Turn a saving lesson into practice and a real budget plan.",
        "mission_type": "weekly",
        "points_reward": 180,
        "badge_name": "Foundation Builder",
        "steps": [
            {
                "id": "lesson-saving",
                "type": "lesson",
                "title": "Read a Saving lesson",
                "course_topic": "saving",
                "route": "/all-topics?topic=saving",
            },
            {
                "id": "practice-saving",
                "type": "exercise",
                "title": "Complete 3 Saving exercises",
                "exercise_category": "Saving",
                "target_count": 3,
                "route": "/exercises?skill=Saving&intentReason=mission_step",
            },
            {
                "id": "tool-budget-planner",
                "type": "tool",
                "title": "Set up your Budget Planner",
                "tool_slug": "budget-planner",
                "route": "/tools/budget-planner",
            },
        ],
    },
]


def seed_quests(apps, schema_editor):
    MultiStepMission = apps.get_model("gamification", "MultiStepMission")
    for quest in QUESTS:
        MultiStepMission.objects.get_or_create(
            slug=quest["slug"],
            defaults={
                "name": quest["name"],
                "description": quest["description"],
                "mission_type": quest["mission_type"],
                "points_reward": quest["points_reward"],
                "badge_name": quest["badge_name"],
                "steps": quest["steps"],
            },
        )


def unseed_quests(apps, schema_editor):
    MultiStepMission = apps.get_model("gamification", "MultiStepMission")
    MultiStepMission.objects.filter(slug__in=[q["slug"] for q in QUESTS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("gamification", "0012_alter_multistepmissionprogress_options"),
    ]

    operations = [
        migrations.RunPython(seed_quests, unseed_quests),
    ]
