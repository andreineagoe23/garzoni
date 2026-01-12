# Adding Exercises to Lesson Sections

This guide explains how to add interactive exercises to lesson sections in the Monevo education platform.

## Overview

Lesson sections can have three content types:
- **Text Content** (`text`) - Rich text with CKEditor
- **Video** (`video`) - Video URL
- **Interactive Exercise** (`exercise`) - Interactive exercises

When a section has `content_type="exercise"`, it needs:
- `exercise_type` - The type of exercise (multiple-choice, drag-and-drop, numeric, budget-allocation)
- `exercise_data` - JSON data containing the exercise content

## Exercise Types

### 1. Multiple Choice

**Format:**
```json
{
  "question": "What is the 50/30/20 budgeting rule?",
  "options": [
    "50% needs, 30% wants, 20% savings",
    "50% savings, 30% needs, 20% wants",
    "50% wants, 30% needs, 20% savings",
    "Equal distribution across all categories"
  ],
  "correctAnswer": 0,
  "explanation": "The 50/30/20 rule prioritizes essential expenses first, then wants, and finally savings."
}
```

**Fields:**
- `question` (string) - The question text
- `options` (array) - Array of answer choices
- `correctAnswer` (integer) - Index of the correct answer (0-based)
- `explanation` (string, optional) - Explanation shown after answering

### 2. Drag and Drop

**Format:**
```json
{
  "question": "Arrange these steps in the correct order for creating a budget:",
  "items": [
    "Track your income and expenses",
    "Categorize your spending",
    "Set spending limits for each category",
    "Review and adjust monthly"
  ],
  "hints": [
    "You need to know your current situation first",
    "Understanding where money goes helps set limits",
    "Monitoring helps you stay on track"
  ]
}
```

**Fields:**
- `question` (string) - The question text
- `items` (array) - Items to be arranged in order
- `hints` (array, optional) - Hints for the user

**Note:** The correct answer is the order [0, 1, 2, 3, ...] as items appear in the array.

### 3. Numeric

**Format:**
```json
{
  "question": "You have a monthly income of $5,000. Following the 50/30/20 rule, how much should you allocate to savings?",
  "expected_value": 1000,
  "tolerance": 0.01,
  "unit": "USD",
  "placeholder": "Enter amount",
  "validation": "Use the 50/30/20 rule: 20% of income goes to savings",
  "hints": [
    "The 50/30/20 rule allocates 20% to savings",
    "Calculate 20% of $5,000",
    "20% = 0.20 or 1/5"
  ]
}
```

**Fields:**
- `question` (string) - The question text
- `expected_value` (number) - The correct numeric answer
- `tolerance` (number) - Acceptable margin of error (e.g., 0.01 for 1%)
- `unit` (string) - Unit of measurement (USD, %, etc.)
- `placeholder` (string, optional) - Placeholder text for input
- `validation` (string, optional) - Validation message
- `hints` (array, optional) - Hints for the user

### 4. Budget Allocation

**Format:**
```json
{
  "question": "Allocate your monthly income of $4,000 according to the 50/30/20 rule. Categories: Needs, Wants, Savings",
  "income": 4000,
  "categories": ["Needs", "Wants", "Savings"],
  "target": {
    "category": "Savings",
    "min": 800
  },
  "hints": [
    "50% goes to Needs = $2,000",
    "30% goes to Wants = $1,200",
    "20% goes to Savings = $800"
  ]
}
```

**Fields:**
- `question` (string) - The question text
- `income` (number) - Total income/budget to allocate
- `categories` (array) - List of budget categories
- `target` (object, optional) - Target allocation for a specific category
  - `category` (string) - Category name
  - `min` (number) - Minimum amount for this category
- `hints` (array, optional) - Hints for the user

## Methods to Add Exercises

### Method 1: Using Django Admin (Recommended for Individual Sections)

1. Navigate to Django Admin: `/admin/education/lessonsection/`
2. Find the lesson section you want to update
3. Click on the section to edit it
4. Ensure `Content type` is set to "Interactive Exercise"
5. Select the `Exercise type` (multiple-choice, drag-and-drop, etc.)
6. In the `Exercise data` field, paste your JSON formatted exercise data
7. Click "Save"

**Example Admin Workflow:**
- Go to: Admin → Education → Lesson Sections
- Filter by: Content type = "Interactive Exercise"
- Filter by: Title = "Quick Check"
- Edit each section and add exercise_data

### Method 2: Using Management Command (Bulk Population)

We've created a management command to automatically populate exercises for "Quick Check" sections:

```bash
# Dry run (see what would be updated)
python manage.py populate_quick_check_exercises --dry-run

# Actually update the sections
python manage.py populate_quick_check_exercises

# Use a different exercise type
python manage.py populate_quick_check_exercises --exercise-type drag-and-drop

# Filter by different title
python manage.py populate_quick_check_exercises --title-filter "Practice Exercise"
```

**Command Options:**
- `--dry-run` - Preview changes without saving
- `--exercise-type` - Type of exercise to generate (multiple-choice, drag-and-drop, numeric, budget-allocation)
- `--title-filter` - Filter sections by title (default: "Quick Check")

### Method 3: Using Django Shell (Programmatic)

```python
from education.models import LessonSection
import json

# Find the section
section = LessonSection.objects.get(id=YOUR_SECTION_ID)

# Set exercise type and data
section.exercise_type = "multiple-choice"
section.exercise_data = {
    "question": "What is a budget?",
    "options": [
        "A plan for spending and saving money",
        "A type of bank account",
        "A credit card feature",
        "An investment strategy"
    ],
    "correctAnswer": 0,
    "explanation": "A budget is a financial plan that helps you track income and expenses."
}

section.save()
```

### Method 4: Using API (Frontend/External)

If you have API access, you can update sections via the REST API:

```bash
PATCH /api/education/lessons/{lesson_id}/sections/{section_id}/
Content-Type: application/json

{
  "exercise_type": "multiple-choice",
  "exercise_data": {
    "question": "...",
    "options": [...],
    "correctAnswer": 0
  }
}
```

## Best Practices

1. **Question Clarity**: Write clear, concise questions that test understanding of the lesson content
2. **Answer Options**: Provide 3-4 plausible options, with only one clearly correct answer
3. **Explanations**: Always include explanations to help learners understand why an answer is correct
4. **Hints**: Provide helpful hints for complex exercises (especially numeric and budget-allocation)
5. **Relevance**: Ensure exercises directly relate to the lesson content
6. **Difficulty**: Match exercise difficulty to the lesson level (beginner, intermediate, advanced)

## Troubleshooting

### Exercise Not Displaying

- Check that `content_type` is set to "exercise"
- Verify `exercise_type` is set to a valid type
- Ensure `exercise_data` is valid JSON
- Check that the section is published (`is_published=True`)

### Invalid JSON Error

- Validate your JSON using a JSON validator
- Ensure all strings are properly quoted
- Check for trailing commas
- Verify array and object syntax

### Exercise Not Working Correctly

- Verify `correctAnswer` index matches the options array (0-based)
- For numeric exercises, check `expected_value` and `tolerance` are numbers
- For budget-allocation, ensure `income` and category totals match

## Examples by Lesson Topic

### Budgeting Lessons
- **Multiple Choice**: "What is the 50/30/20 rule?"
- **Numeric**: "Calculate savings allocation using 50/30/20"
- **Budget Allocation**: "Allocate monthly income across categories"

### Credit Lessons
- **Multiple Choice**: "What is a credit score?"
- **Drag and Drop**: "Order steps to build credit"
- **Numeric**: "Calculate credit utilization percentage"

### Investment Lessons
- **Multiple Choice**: "What is diversification?"
- **Drag and Drop**: "Order investment types by risk level"
- **Numeric**: "Calculate investment returns"

## Related Files

- Models: `backend/education/models.py` (LessonSection model)
- Admin: `backend/education/admin.py` (Admin configuration)
- Management Command: `backend/education/management/commands/populate_quick_check_exercises.py`
- Frontend Components: `frontend/src/components/exercises/`
