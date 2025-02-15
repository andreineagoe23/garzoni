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
from .models import UserProfile, Course, Lesson, Quiz, Path, UserProgress, Mission, MissionCompletion, Questionnaire, Tool, SimulatedSavingsAccount, Question, UserResponse, PathRecommendation, LessonCompletion, QuizCompletion
from .serializers import (
    UserProfileSerializer, CourseSerializer, LessonSerializer, 
    QuizSerializer, PathSerializer, RegisterSerializer, UserProgressSerializer, LeaderboardSerializer, UserProfileSettingsSerializer, QuestionnaireSerializer, ToolSerializer, SimulatedSavingsAccountSerializer,
    QuestionSerializer, UserResponseSerializer, PathRecommendationSerializer, 
)
from core.dialogflow import detect_intent_from_text, perform_web_search
from django.utils import timezone
from django.utils.timezone import now
import logging
import os

class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_profile = UserProfile.objects.get(user=request.user)
        serializer = UserProfileSerializer(user_profile)
        progress = UserProgress.objects.filter(user=request.user).first()

        is_completed = UserResponse.objects.filter(user=request.user).exists()

        user_data = {
            "first_name": request.user.first_name,
            "last_name": request.user.last_name,
            "email": request.user.email,
            "username": request.user.username,
            "email_reminders": user_profile.email_reminders,
            "earned_money": float(user_profile.earned_money),
            "points": user_profile.points,
        }

        return Response({
            "user_data": user_data,
            "streak": progress.streak if progress else 0,
            "profile_avatar": user_profile.profile_avatar,
            "is_questionnaire_completed": is_completed, 
        })


    def patch(self, request):
        user_profile = request.user.userprofile
        email_reminders = request.data.get('email_reminders')
        if email_reminders is not None:
            user_profile.email_reminders = email_reminders
            user_profile.save()
        return Response({"message": "Profile updated successfully."})


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def perform_create(self, serializer):
        try:
            user = serializer.save()
            if user.userprofile.wants_personalized_path:
                return Response({"next": "/questionnaire/"}, status=status.HTTP_201_CREATED)
            return Response({"next": "/dashboard/"}, status=status.HTTP_201_CREATED)
        except serializers.ValidationError as e:
            print("Validation Error:", e.detail)  # Log the validation error
            return Response({"error": e.detail}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print("Unexpected Error:", str(e))  # Log unexpected errors
            return Response({"error": "Something went wrong."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


from rest_framework_simplejwt.views import TokenObtainPairView
from django.http import JsonResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from core.tokens import set_jwt_cookies, delete_jwt_cookies


class CookieTokenObtainPairView(TokenObtainPairView):
    """Handles Login and Stores JWT in HTTP-only Cookies"""

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            access_token = response.data.get('access')
            refresh_token = response.data.get('refresh')
            response = set_jwt_cookies(response, access_token, refresh_token)
        else:
            return JsonResponse({'error': 'Invalid credentials'}, status=401)
        return response


class LogoutView(APIView):
    """Handles Logout and Clears JWT Cookies"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        response = JsonResponse({"message": "Logout successful."})
        return delete_jwt_cookies(response)



from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import SessionAuthentication

class PathViewSet(viewsets.ModelViewSet):
    queryset = Path.objects.all()
    serializer_class = PathSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)



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
            lesson = Lesson.objects.get(id=lesson_id)
            user_progress, created = UserProgress.objects.get_or_create(
                user=user, course=lesson.course
            )
            user_progress.completed_lessons.add(lesson)  # Correctly placed here
            user_progress.save()

            mission_completions = MissionCompletion.objects.filter(
                user=user,
                mission__goal_type='complete_lesson'
            )
            for mission_completion in mission_completions:
                lessons_required = 2
                increment = 100 // lessons_required 
                mission_completion.update_progress(increment=increment, total=100)

            return Response({"message": "Lesson completed!"}, status=status.HTTP_200_OK)

        except Lesson.DoesNotExist:
            return Response({"error": "Lesson not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"Error completing lesson: {e}")
            return Response({"error": "An error occurred while completing the lesson."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
            QuizCompletion.objects.create(user=request.user, quiz=quiz)
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
        user_profile = UserProfile.objects.get(user=request.user)
        return Response({
            "email_reminders": user_profile.email_reminders,
            "email_frequency": user_profile.email_frequency,
            "profile": {
                "username": request.user.username,
                "email": request.user.email,
                "first_name": request.user.first_name,
                "last_name": request.user.last_name,
            },
        })

    def patch(self, request):
        user_profile = request.user.userprofile
        email_reminders = request.data.get('email_reminders')
        email_frequency = request.data.get('email_frequency')

        if email_reminders is not None:
            user_profile.email_reminders = email_reminders

        if email_frequency in ['daily', 'weekly', 'monthly']:
            user_profile.email_frequency = email_frequency

        user_profile.save()
        return Response({"message": "Settings updated successfully."})



class MissionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        try:
            # Fetch daily and weekly missions
            daily_completions = MissionCompletion.objects.filter(
                user=user, mission__mission_type="daily"
            )
            weekly_completions = MissionCompletion.objects.filter(
                user=user, mission__mission_type="weekly"
            )

            daily_missions = []
            weekly_missions = []

            for completion in daily_completions:
                daily_missions.append({
                    "id": completion.mission.id,
                    "name": completion.mission.name,
                    "description": completion.mission.description,
                    "points_reward": completion.mission.points_reward,
                    "progress": completion.progress,
                    "status": completion.status,
                    "goal_type": completion.mission.goal_type,
                })

            for completion in weekly_completions:
                weekly_missions.append({
                    "id": completion.mission.id,
                    "name": completion.mission.name,
                    "description": completion.mission.description,
                    "points_reward": completion.mission.points_reward,
                    "progress": completion.progress,
                    "status": completion.status,
                    "goal_type": completion.mission.goal_type,
                })

            return Response({
                "daily_missions": daily_missions,
                "weekly_missions": weekly_missions,
            }, status=200)

        except Exception as e:
            return Response(
                {"error": "An error occurred while fetching missions."},
                status=500,
            )

    def post(self, request, mission_id):
        user = request.user
        try:
            # Find the specific MissionCompletion record
            mission_completion = MissionCompletion.objects.get(user=user, mission_id=mission_id)
            increment = request.data.get("progress", 0)

            if not isinstance(increment, int):
                return Response({"error": "Progress must be an integer."}, status=400)

            # Update mission progress
            mission_completion.update_progress(increment)
            return Response({"message": "Mission progress updated.", "progress": mission_completion.progress}, status=200)

        except MissionCompletion.DoesNotExist:
            return Response({"error": "Mission not found for this user."}, status=404)
        except Exception as e:
            logging.error(f"Error updating mission progress for user {user.username}: {str(e)}")
            return Response({"error": "An error occurred while updating mission progress."}, status=500)


class SavingsAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        account, _ = SimulatedSavingsAccount.objects.get_or_create(user=request.user)
        return Response({"balance": account.balance}, status=200)

    def post(self, request):
        amount = request.data.get("amount", 0)
        try:
            account, _ = SimulatedSavingsAccount.objects.get_or_create(user=request.user)
            account.add_to_balance(amount)

            # Update savings-related missions
            mission_completions = MissionCompletion.objects.filter(
                user=request.user,
                mission__goal_type="add_savings"
            )
            for mission_completion in mission_completions:
                mission_completion.update_progress(increment=amount, total=100)

            return Response(
                {"message": "Savings added successfully!", "balance": account.balance},
                status=200,
            )
        except Exception as e:
            logging.error(f"Error updating savings for user {request.user.username}: {str(e)}")
            return Response({"error": "An error occurred while updating savings."}, status=500)



class FinanceFactView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            # Update fact-related missions
            mission_completions = MissionCompletion.objects.filter(
                user=request.user,
                mission__goal_type="read_fact"
            )
            for mission_completion in mission_completions:
                if mission_completion.progress < 100:
                    mission_completion.update_progress(100, total=100)

            return Response({"message": "Fact read successfully!"}, status=200)
        except Exception as e:
            logging.error(f"Error marking fact read for user {request.user.username}: {str(e)}")
            return Response({"error": "An error occurred while marking the fact as read."}, status=500)



import os
import json
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .dialogflow import detect_intent_from_text, perform_web_search

class ChatbotView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user_input = request.data.get("text", "")
        session_id = str(request.user.id)

        if not user_input:
            return Response({"error": "No input provided"}, status=400)

        try:
            project_id = os.environ.get("DIALOGFLOW_PROJECT_ID", "monevo-443011")
            response_text = detect_intent_from_text(
                project_id=project_id,
                text=user_input,
                session_id=session_id
            )
            return Response({"response": response_text}, status=200)
        except Exception as e:
            print("Dialogflow Error:", e)
            return Response({"error": str(e)}, status=500)

    @staticmethod
    def dialogflow_webhook(request):
        """
        Handle requests from Dialogflow's webhook.
        """
        try:
            req = json.loads(request.body)
            intent_name = req.get("queryResult", {}).get("intent", {}).get("displayName")

            if intent_name == "SearchTheWeb":
                search_query = req.get("queryResult", {}).get("queryText", "")
                response_text = perform_web_search(search_query)
            else:
                response_text = f"Intent '{intent_name}' is not implemented yet."

            return JsonResponse({
                "fulfillmentText": response_text
            })

        except Exception as e:
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
    permission_classes = [AllowAny]

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

class QuestionnaireView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):

        questions = Question.objects.order_by('order')
        serializer = QuestionSerializer(questions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):

        answers = request.data.get('answers', {})
        user = request.user if request.user.is_authenticated else None

        for question_id, answer in answers.items():
            try:
                question = Question.objects.get(id=question_id)
                UserResponse.objects.create(user=user, question=question, answer=answer)
            except Question.DoesNotExist:
                return Response({"error": f"Question {question_id} does not exist."}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"message": "Questionnaire submitted successfully."}, status=status.HTTP_201_CREATED)


class RecommendationView(APIView):
    def get(self, request, user_id):
        responses = UserResponse.objects.filter(user_id=user_id)
        recommended_path = None

        recommendations = {
            "Basic Finance": "It looks like you're interested in budgeting and saving. Start with Basic Finance to build strong financial habits!",
            "Crypto": "You've mentioned crypto or blockchain. Our Crypto path will guide you through the fundamentals of digital assets.",
            "Real Estate": "Since you showed interest in real estate, we recommend the Real Estate path to explore property investment.",
            "Forex": "Your responses indicate interest in currency trading. The Forex path will help you master trading strategies.",
            "Personal Finance": "Want to improve overall financial wellness? The Personal Finance path is the best place to start!",
            "Financial Mindset": "A strong mindset is key to financial success! Learn about wealth psychology with the Financial Mindset path."
        }

        for response in responses:
            for path, message in recommendations.items():
                if path.lower() in response.answer.lower():
                    recommended_path = path
                    recommendation_message = message
                    break

        if not recommended_path:
            recommended_path = "Basic Finance"
            recommendation_message = "Start with Basic Finance to strengthen your foundation in money management."

        return Response({
            "path": recommended_path,
            "message": recommendation_message
        })


class QuestionnaireSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        answers = request.data.get('answers', {})

        if not answers:
            return Response({"error": "No answers provided."}, status=status.HTTP_400_BAD_REQUEST)

        try:

            for question_id, answer in answers.items():
                question = Question.objects.get(id=question_id)
                UserResponse.objects.create(user=user, question=question, answer=answer)

            user_profile = UserProfile.objects.get(user=user)
            user_profile.wants_personalized_path = True
            user_profile.save()

            return Response({"message": "Questionnaire submitted successfully."}, status=status.HTTP_201_CREATED)

        except Question.DoesNotExist:
            return Response({"error": "Invalid question ID."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"Error in QuestionnaireSubmitView: {e}")
            return Response({"error": "Something went wrong."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

import logging
import json
from collections import defaultdict
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Course, Path, UserResponse, UserProfile
from .serializers import CourseSerializer

logger = logging.getLogger(__name__)

class PersonalizedPathView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        user_profile = UserProfile.objects.get(user=user)

        responses = UserResponse.objects.filter(user=user)
        if not responses.exists():
            return Response({"error": "No questionnaire responses found."}, status=404)

        path_keywords = {
            "Financial Mindset": ["mindset", "psychology", "discipline", "growth"],
            "Personal Finance": ["budget", "saving", "spending", "invest"],
            "Forex": ["forex", "currency", "trading"],
            "Crypto": ["crypto", "bitcoin", "blockchain"],
            "Real Estate": ["real estate", "property", "housing"],
            "Basic Finance": ["finance", "credit", "debt", "investment"],
        }

        path_scores = defaultdict(int)
        for response in responses:
            for path, keywords in path_keywords.items():
                if any(keyword in response.answer.lower() for keyword in keywords):
                    path_scores[path] += 1

        sorted_paths = sorted(path_scores.items(), key=lambda x: x[1], reverse=True)

        selected_courses = []
        used_paths = set()
        total_courses_needed = 10

        for path_name, _ in sorted_paths:
            path_obj = Path.objects.filter(title=path_name).first()
            if path_obj and path_obj.id not in used_paths:
                courses = list(Course.objects.filter(path=path_obj)[:2])
                selected_courses.extend(courses)
                used_paths.add(path_obj.id)

            if len(selected_courses) >= total_courses_needed:
                break 

        if len(selected_courses) < total_courses_needed:
            remaining_courses = list(
                Course.objects.exclude(id__in=[c.id for c in selected_courses])[:total_courses_needed - len(selected_courses)]
            )
            selected_courses.extend(remaining_courses)

        if not selected_courses:
            return Response({"error": "No suitable courses found for your preferences."}, status=404)
        

        serializer = CourseSerializer(
            selected_courses, 
            many=True, 
            context={'request': request}
        )

        return Response({
            "personalized_courses": serializer.data,
            "message": "We've assembled a custom learning path based on your interests."
        })


from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Lesson, UserProgress

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_exercise_progress(request, exercise_id):
    try:
        lesson = Lesson.objects.get(id=exercise_id)
        user_progress = UserProgress.objects.filter(user=request.user, course=lesson.course).first()

        if user_progress:
            return Response({
                "completed": lesson in user_progress.completed_lessons.all(),
                "answers": {}  # Add logic to fetch saved answers if applicable
            })
        else:
            return Response({"completed": False, "answers": {}})
    except Lesson.DoesNotExist:
        return Response({"error": "Exercise not found."}, status=404)


class RecentActivityView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        activities = []

        # Lesson completions
        lesson_completions = LessonCompletion.objects.filter(
            user_progress__user=user
        ).select_related('lesson', 'user_progress__course')
        for lc in lesson_completions:
            activities.append({
                "type": "lesson",
                "action": "completed",
                "title": lc.lesson.title,
                "course": lc.user_progress.course.title,
                "timestamp": lc.completed_at
            })

        # Quiz completions
        quiz_completions = QuizCompletion.objects.filter(user=user).select_related('quiz')
        for qc in quiz_completions:
            activities.append({
                "type": "quiz",
                "action": "completed",
                "title": qc.quiz.title,
                "timestamp": qc.completed_at
            })

        # Mission completions
        missions = MissionCompletion.objects.filter(
            user=user, 
            status='completed'
        ).exclude(completed_at__isnull=True)
        for mc in missions:
            activities.append({
                "type": "mission",
                "action": "completed",
                "name": mc.mission.name,
                "timestamp": mc.completed_at
            })

        # Course completions
        course_completions = UserProgress.objects.filter(
            user=user,
            is_course_complete=True
        ).exclude(course_completed_at__isnull=True)
        for cc in course_completions:
            activities.append({
                "type": "course",
                "action": "completed",
                "title": cc.course.title,
                "timestamp": cc.course_completed_at
            })

        # Sort and limit to 15 activities
        sorted_activities = sorted(
            activities, 
            key=lambda x: x["timestamp"], 
            reverse=True
        )[:15]

        return Response({"recent_activities": sorted_activities})