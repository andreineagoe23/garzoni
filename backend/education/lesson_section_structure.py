"""
Canonical 9-section lesson layout and internal cognitive progression tags.

Used by management commands (reshape, rebuild, load_lesson_from_markdown) and
by content generation at scale. Cognitive progression tags are internal only
(not exposed to users) and prevent repetition when generating section content.
"""

# (order, title, content_type, cognitive_role or None for non-text)
SECTION_TEMPLATE_9 = [
    (1, "Overview", "text", "Concept Introduction"),
    (2, "Core Concept", "text", "Structural Understanding"),
    (3, "Knowledge Check 1", "exercise", None),
    (4, "Applied Insight", "text", "Risk & Nuance"),
    (5, "Practical Walkthrough", "text", "Practical Mechanics"),
    (6, "Knowledge Check 2", "exercise", None),
    (7, "Key Takeaways", "text", "Strategic Framing"),
    (8, "Next Steps", "text", "Behavioral Reinforcement"),
    (9, "Watch & Learn", "video", None),
]

# Section order -> cognitive progression tag (text sections only)
COGNITIVE_ROLE_BY_ORDER = {
    order: role for order, _title, _ctype, role in SECTION_TEMPLATE_9 if role
}

# Section order -> (title, content_type) for quick lookup
SECTION_TITLE_AND_TYPE_BY_ORDER = {
    order: (title, content_type) for order, title, content_type, _ in SECTION_TEMPLATE_9
}

# Markdown header (lowercase) -> section order (for load_lesson_from_markdown)
TEXT_HEADER_TO_ORDER = {
    "overview": 1,
    "core concept": 2,
    "applied insight": 4,
    "practical walkthrough": 5,
    "key takeaways": 7,
    "next steps": 8,
}
