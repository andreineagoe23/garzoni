from rest_framework import viewsets, serializers, generics, status, views
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth.models import User
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.conf import settings
from .models import UserProfile, Course, Lesson, Quiz, Path, UserProgress, Mission, MissionCompletion, Questionnaire, Tool
from .serializers import (
    UserProfileSerializer, CourseSerializer, LessonSerializer, 
    QuizSerializer, PathSerializer, RegisterSerializer, UserProgressSerializer, LeaderboardSerializer, UserProfileSettingsSerializer, QuestionnaireSerializer, ToolSerializer,
)
from core.dialogflow import detect_intent_from_text, perform_web_search

class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_profile = UserProfile.objects.get(user=request.user)
        serializer = UserProfileSerializer(user_profile)
        user_data = {
            "first_name": request.user.first_name,
            "last_name": request.user.last_name,
            "email": request.user.email,
            "username": request.user.username,
            "email_reminders": user_profile.email_reminders,
            "earned_money": float(user_profile.earned_money),
            "points": user_profile.points,
        }
        print("User Data:", user_data)
        return Response(user_data)



    def patch(self, request):
        user_profile = request.user.userprofile
        email_reminders = request.data.get('email_reminders')
        if email_reminders is not None:
            user_profile.email_reminders = email_reminders
            user_profile.save()
        return Response({"message": "Profile updated successfully."})

# User registration view
class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

class PathViewSet(viewsets.ModelViewSet):
    queryset = Path.objects.all()
    serializer_class = PathSerializer

class UserProfileViewSet(viewsets.ModelViewSet):
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @action(detail=False, methods=["post"], url_path="add-generated-image")
    def add_generated_image(self, request):
        user_profile = request.user.userprofile
        image = request.FILES.get('image')

        if not image:
            return Response({"error": "No image file provided."}, status=status.HTTP_400_BAD_REQUEST)

        # Save image to storage
        file_path = default_storage.save(f'generated_images/{image.name}', ContentFile(image.read()))

        # Add file path to user's profile
        user_profile.add_generated_image(file_path)

        return Response({"message": "Image added successfully!", "file_path": file_path}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="get-generated-images")
    def get_generated_images(self, request):
        user_profile = request.user.userprofile
        return Response({"generated_images": user_profile.generated_images})

    @action(detail=False, methods=["post"], url_path="save-avatar")
    def save_avatar(self, request):
        user_profile = request.user.userprofile
        avatar_url = request.data.get("avatar_url")

        if not avatar_url:
            return Response({"error": "Avatar URL is missing."}, status=status.HTTP_400_BAD_REQUEST)

        user_profile.profile_avatar = avatar_url
        user_profile.save()
        return Response({"message": "Avatar saved successfully.", "avatar_url": avatar_url})

class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer

class LessonViewSet(viewsets.ModelViewSet):
    queryset = Lesson.objects.all()
    serializer_class = LessonSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def with_progress(self, request):
        course_id = request.query_params.get("course", None)
        if not course_id:
            return Response({"error": "Course ID is required."}, status=400)

        lessons = self.get_queryset().filter(course_id=course_id)
        user_progress = UserProgress.objects.filter(user=request.user, course_id=course_id).first()

        completed_lesson_ids = (
            user_progress.completed_lessons.values_list("id", flat=True) if user_progress else []
        )

        lesson_data = [
            {
                "id": lesson.id,
                "title": lesson.title,
                "short_description": lesson.short_description,
                "detailed_content": lesson.detailed_content,
                "video_url": lesson.video_url,
                "exercise_type": lesson.exercise_type,
                "exercise_data": lesson.exercise_data,
                "accessible": lesson.id in completed_lesson_ids or lesson.id == lessons.first().id,
                "is_completed": lesson.id in completed_lesson_ids,
            }
            for lesson in lessons
        ]

        return Response(lesson_data)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def complete(self, request):
        """
        Mark a lesson as complete and update related missions.
        """
        lesson_id = request.data.get('lesson_id')
        user = request.user

        try:
            # Fetch the lesson and user progress
            lesson = Lesson.objects.get(id=lesson_id)
            user_progress, created = UserProgress.objects.get_or_create(
                user=user, course=lesson.course
            )
            user_progress.completed_lessons.add(lesson)
            user_progress.save()

            # Update related missions
            mission_completions = MissionCompletion.objects.filter(
                user=user,
                mission__goal_type='complete_lesson'
            )
            for mission_completion in mission_completions:
                mission_completion.update_progress(user)

            return Response({"message": "Lesson completed!"}, status=status.HTTP_200_OK)

        except Lesson.DoesNotExist:
            return Response({"error": "Lesson not found."}, status=status.HTTP_404_NOT_FOUND)


class QuizViewSet(viewsets.ModelViewSet):
    queryset = Quiz.objects.all()
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        course_id = self.request.query_params.get("course")
        if not course_id:
            return Quiz.objects.none()

        quizzes = Quiz.objects.filter(course_id=course_id)
        return quizzes

    @action(detail=False, methods=["post"], permission_classes=[IsAuthenticated])
    def complete(self, request):
        quiz_id = request.data.get("quiz_id")
        selected_answer = request.data.get("selected_answer")

        if not quiz_id or not selected_answer:
            return Response({"error": "Quiz ID and selected answer are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            quiz = Quiz.objects.get(id=quiz_id)
        except Quiz.DoesNotExist:
            return Response({"error": "Quiz not found."}, status=status.HTTP_404_NOT_FOUND)

        if quiz.correct_answer == selected_answer:
            user_profile = request.user.userprofile
            user_profile.add_money(10.00)
            user_profile.add_points(20)
            return Response({"message": "Quiz completed successfully!", "earned_money": 10.00}, status=status.HTTP_200_OK)

        return Response({"message": "Incorrect answer. Try again!"}, status=status.HTTP_400_BAD_REQUEST)

class UserProgressViewSet(viewsets.ModelViewSet):
    queryset = UserProgress.objects.all()
    serializer_class = UserProgressSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'], url_path='complete')
    def complete(self, request):
        lesson_id = request.data.get('lesson_id')
        if not lesson_id:
            return Response({"error": "lesson_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            lesson = Lesson.objects.get(id=lesson_id)
        except Lesson.DoesNotExist:
            return Response({"error": "Lesson not found"}, status=status.HTTP_404_NOT_FOUND)

        # Mark lesson as completed
        course = lesson.course
        user_profile = request.user.userprofile
        user_progress, created = UserProgress.objects.get_or_create(user=request.user, course=course)
        user_progress.completed_lessons.add(lesson)
        user_profile.add_money(5.00)
        user_profile.add_points(10)
        user_progress.save()

        # Update streak
        user_progress.update_streak()

        # Check for mission completion and complete eligible missions
        missions_completed = self.check_and_complete_missions(request.user)

        return Response(
            {"status": "Lesson completed", "missions_completed": missions_completed, "streak": user_progress.streak},
            status=status.HTTP_200_OK
        )

    def check_and_complete_missions(self, user):
        """
        This method checks for missions that are marked as 'not_started' and completes them.
        """
        mission_completions = MissionCompletion.objects.filter(
            user=user,
            status='not_started',
        )
        completed_count = 0
        for mission_completion in mission_completions:
            mission_completion.status = 'completed'
            mission_completion.save()
            user.userprofile.add_points(mission_completion.mission.points_reward)
            completed_count += 1
        user.userprofile.save()
        return completed_count


    @action(detail=False, methods=["get"])
    def progress_summary(self, request):
        user = request.user
        progress_data = []

        user_progress = UserProgress.objects.filter(user=user)
        for progress in user_progress:
            total_lessons = progress.course.lessons.count()
            completed_lessons = progress.completed_lessons.count()
            percent_complete = (completed_lessons / total_lessons) * 100 if total_lessons > 0 else 0

            progress_data.append({
                "path": progress.course.path.title if progress.course.path else None,
                "course": progress.course.title,
                "percent_complete": percent_complete,
            })

        return Response({"overall_progress": sum(d["percent_complete"] for d in progress_data) / len(progress_data) if progress_data else 0,
                         "paths": progress_data})


class LeaderboardViewSet(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        top_users = UserProfile.objects.order_by('-points')[:10]
        serializer = LeaderboardSerializer(top_users, many=True)
        return Response(serializer.data)

class UserSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_profile, created = UserProfile.objects.get_or_create(user=request.user)
        serializer = UserProfileSettingsSerializer(user_profile)
        return Response(serializer.data)

    def patch(self, request):
        user_profile, created = UserProfile.objects.get_or_create(user=request.user)
        serializer = UserProfileSettingsSerializer(
            user_profile, data=request.data, partial=True
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

class MissionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        try:
            completions = MissionCompletion.objects.filter(user=user)
            daily_missions = Mission.objects.filter(mission_type="daily")
            weekly_missions = Mission.objects.filter(mission_type="weekly")

            def format_mission(mission, user):
                completion = completions.filter(mission=mission).first()
                return {
                    "id": mission.id,
                    "name": mission.name,
                    "description": mission.description,
                    "points_reward": mission.points_reward,
                    "goal_type": mission.goal_type,
                    "status": completion.status if completion else "not_started",
                    "progress": completion.progress if completion else 0,
                }

            response_data = {
                "daily": [format_mission(mission, user) for mission in daily_missions],
                "weekly": [format_mission(mission, user) for mission in weekly_missions],
            }
            return Response(response_data, status=status.HTTP_200_OK)

        except Exception as e:
            print(f"Error fetching missions: {e}")
            return Response(
                {"error": "An error occurred while fetching missions."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def post(self, request, mission_id):
        user = request.user
        try:
            mission_completion, created = MissionCompletion.objects.get_or_create(
                user=user, mission_id=mission_id
            )
            action_type = request.data.get("action_type")
            increment = 0

            if mission_completion.mission.goal_type == "complete_lesson":
                increment = 100  # Fully complete when lesson is done
            elif mission_completion.mission.goal_type == "complete_exercise":
                increment = 50  # Partial progress for an exercise
            elif mission_completion.mission.goal_type == "complete_course":
                course_progress = UserProgress.objects.filter(
                    user=user,
                    course_id=mission_completion.mission.goal_id,
                ).first()
                if course_progress:
                    increment = course_progress.completed_lessons.count() / \
                                course_progress.course.lessons.count() * 100

            mission_completion.update_progress(increment)
            return Response(
                {"message": "Progress updated!", "progress": mission_completion.progress},
                status=status.HTTP_200_OK,
            )

        except Mission.DoesNotExist:
            return Response({"error": "Mission not found."}, status=status.HTTP_404_NOT_FOUND)


class QuestionnaireView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Retrieve the user's questionnaire data
        try:
            questionnaire = Questionnaire.objects.get(user=request.user)
            serializer = QuestionnaireSerializer(questionnaire)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Questionnaire.DoesNotExist:
            return Response({"message": "Questionnaire not found."}, status=status.HTTP_404_NOT_FOUND)

    def post(self, request):
        # Create or update the user's questionnaire
        try:
            questionnaire, created = Questionnaire.objects.get_or_create(user=request.user)
            serializer = QuestionnaireSerializer(questionnaire, data=request.data, partial=True)

            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)



class ChatbotView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user_input = request.data.get("text", "")
        session_id = str(request.user.id)

        if not user_input:
            return Response({"error": "No input provided"}, status=400)

        try:
            # Check if this input requires a Dialogflow intent response
            response_text = detect_intent_from_text(
                project_id="monevo-443011",
                text=user_input,
                session_id=session_id
            )
            return Response({"response": response_text}, status=200)

        except Exception as e:
            return Response({"error": str(e)}, status=500)

    @staticmethod
    def dialogflow_webhook(request):
        """
        Handle requests from Dialogflow's webhook.
        """
        try:
            # Parse the request body
            req = json.loads(request.body)

            # Extract intent name
            intent_name = req.get("queryResult", {}).get("intent", {}).get("displayName")

            # Process specific intents
            if intent_name == "SearchTheWeb":
                search_query = req.get("queryResult", {}).get("queryText", "")
                response_text = perform_web_search(search_query)
            else:
                response_text = f"Intent '{intent_name}' is not implemented yet."

            # Send a response back to Dialogflow
            return JsonResponse({
                "fulfillmentText": response_text
            })

        except Exception as e:
            # Handle exceptions during webhook processing
            return JsonResponse({
                "fulfillmentText": f"An error occurred: {str(e)}"
            })

class ToolListView(APIView):
    """
    API Endpoint to list tool categories only.
    """
    def get(self, request):
        tools = [
            {"category": "Forex Tools"},
            {"category": "Crypto Tools"},
            {"category": "News & Calendars"},
            {"category": "Basic Finance & Budgeting Tools"},
        ]
        return Response(tools)


class SavingsGoalCalculatorView(APIView):
    """
    API Endpoint to calculate savings goals based on compound interest.
    """
    def post(self, request):
        try:
            data = request.data
            savings_goal = float(data.get('savings_goal', 0))
            initial_investment = float(data.get('initial_investment', 0))
            years_to_grow = float(data.get('years_to_grow', 0))
            annual_interest_rate = float(data.get('annual_interest_rate', 0)) / 100
            compound_frequency = int(data.get('compound_frequency', 1))

            if years_to_grow <= 0 or compound_frequency <= 0:
                return Response({"error": "Invalid input for years or frequency."}, status=status.HTTP_400_BAD_REQUEST)

            # Calculate the final savings using compound interest formula
            final_savings = initial_investment * ((1 + annual_interest_rate / compound_frequency) ** (compound_frequency * years_to_grow))

            return Response({
                "final_savings": round(final_savings, 2),
                "message": f"To achieve your savings goal of {savings_goal}, your estimated final savings would be {round(final_savings, 2)}."
            })
        except ValueError:
            return Response({"error": "Invalid input values."}, status=status.HTTP_400_BAD_REQUEST)

class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({"error": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
            token = PasswordResetTokenGenerator().make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            reset_link = f"http://localhost:3000/monevo#/password-reset/{uid}/{token}"

            # Render the email content
            context = {
                'user': user,
                'reset_link': reset_link,
            }
            subject = "Password Reset Request"
            html_content = render_to_string("emails/password_reset.html", context)
            text_content = strip_tags(html_content)  # Fallback for plain-text email clients

            # Send the email
            email_message = EmailMultiAlternatives(subject, text_content, settings.DEFAULT_FROM_EMAIL, [user.email])
            email_message.attach_alternative(html_content, "text/html")
            email_message.send()

            return Response({"message": "Password reset link sent."}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({"error": "No user found with this email."}, status=status.HTTP_404_NOT_FOUND)

class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]  # Allow unauthenticated users

    def get(self, request, uidb64, token):
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({"error": "Invalid user ID or token."}, status=status.HTTP_400_BAD_REQUEST)

        if PasswordResetTokenGenerator().check_token(user, token):
            return Response({"message": "Token is valid, proceed with password reset."}, status=status.HTTP_200_OK)
        else:
            return Response({"error": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST)

    def post(self, request, uidb64, token):
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({"error": "Invalid user ID or token."}, status=status.HTTP_400_BAD_REQUEST)

        if not PasswordResetTokenGenerator().check_token(user, token):
            return Response({"error": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)

        new_password = request.data.get("new_password")
        confirm_password = request.data.get("confirm_password")

        if not new_password or new_password != confirm_password:
            return Response({"error": "Passwords do not match."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()

        return Response({"message": "Password reset successful."}, status=status.HTTP_200_OK)

