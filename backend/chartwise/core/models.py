from django.db import models
from django.contrib.auth.models import User

# User Profile model, extending Django's User model with additional fields
class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    earned_money = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    # Add any other fields relevant to the user profile

    def __str__(self):
        return self.user.username

# Learning Path model (e.g., "Forex Basics" path with related courses)
class Path(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField()

    def __str__(self):
        return self.title

# Course model linked to a specific learning path
class Course(models.Model):
    path = models.ForeignKey(Path, on_delete=models.CASCADE, related_name="courses", null=True)
    title = models.CharField(max_length=200)
    description = models.TextField()
    # Other fields like difficulty, prerequisites, etc., could be added here

    def __str__(self):
        return self.title

# Lesson model linked to specific courses
class Lesson(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="lessons")
    title = models.CharField(max_length=200)
    content = models.TextField()  # This can be text, HTML, etc.

    def __str__(self):
        return f"{self.course.title} - {self.title}"

# Quiz model linked to specific lessons
class Quiz(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="quizzes")
    question = models.TextField()
    correct_answer = models.CharField(max_length=200)
    # Optionally, add fields for multiple-choice options

    def __str__(self):
        return f"Quiz for {self.lesson.title}: {self.question[:50]}"

class UserProgress(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="progress")
    course = models.ForeignKey('Course', on_delete=models.CASCADE, related_name="user_progress")  # Reference as a string
    completed_lessons = models.IntegerField(default=0)  # Track completed lessons
    is_course_complete = models.BooleanField(default=False)  # Mark if the user has completed the course

    def __str__(self):
        return f"{self.user.username} - {self.course.title}"
