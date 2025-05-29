from rest_framework import viewsets, generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.contrib.auth.models import User
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.core.mail import EmailMultiAlternatives, send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.conf import settings
from django.middleware.csrf import get_token
from django.http import HttpResponse, JsonResponse
from django.db import transaction
from django.db.models import F
from django.core.cache import cache
from django.utils import timezone
from decimal import Decimal, InvalidOperation
from collections import defaultdict
import stripe
import requests
import logging
import os
import json
from transformers import pipeline
from .models import (
    LessonSection, UserProfile, Course, Lesson, Quiz, Path, UserProgress,
    MissionCompletion, SimulatedSavingsAccount, Question, UserResponse,
    LessonCompletion, QuizCompletion, Reward, UserPurchase, Badge, UserBadge,
    Referral, FriendRequest, Exercise, UserExerciseProgress, FinanceFact,
    UserFactProgress, ExerciseCompletion, FAQ, ContactMessage, FAQFeedback,
    PortfolioEntry, FinancialGoal
)
from .serializers import (
    UserProfileSerializer, CourseSerializer, LessonSerializer, QuizSerializer,
    PathSerializer, RegisterSerializer, UserProgressSerializer, LeaderboardSerializer,
    QuestionSerializer, RewardSerializer, UserPurchaseSerializer, BadgeSerializer,
    UserBadgeSerializer, ReferralSerializer, UserSearchSerializer, FriendRequestSerializer,
    ExerciseSerializer, UserExerciseProgressSerializer, FAQSerializer,
    PortfolioEntrySerializer, FinancialGoalSerializer
)
from .dialogflow import detect_intent_from_text, perform_web_search
from core.tokens import delete_jwt_cookies
import re
from django.utils.timezone import now
from datetime import datetime, timedelta
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.contrib.auth import update_session_auth_hash
from django.db import models



logger = logging.getLogger(__name__)

from django.views.decorators.csrf import ensure_csrf_cookie

# Add these imports for reCAPTCHA verification
def verify_recaptcha(token):
    """Verify the reCAPTCHA token with Google's API"""
    try:
        url = "https://www.google.com/recaptcha/api/siteverify"
        data = {
            "secret": settings.RECAPTCHA_PRIVATE_KEY,
            "response": token
        }
        response = requests.post(url, data=data)
        result = response.json()
        return result.get("success", False) and result.get("score", 0) >= settings.RECAPTCHA_SCORE_THRESHOLD
    except Exception as e:
        logger.error(f"reCAPTCHA verification error: {str(e)}")
        return False


@ensure_csrf_cookie
def get_csrf_token(request):
    """Retrieve and return a CSRF token for the client."""
    token = get_token(request)
    return JsonResponse({"csrfToken": token})


class HuggingFaceProxyView(APIView):
    permission_classes = [IsAuthenticated]

    # Load the model for financial assistance once when the class is first used
    try:
        from transformers import pipeline
        local_pipe = pipeline("text-generation", model="EleutherAI/gpt-neo-125M")
    except Exception as e:
        import logging
        logging.error(f"Error loading model: {str(e)}")
        local_pipe = None

    def post(self, request):
        prompt = request.data.get("inputs", "").strip()
        parameters = request.data.get("parameters", {})

        if not prompt:
            return Response({"error": "Prompt is required."}, status=400)

        try:
            # Check if we should add financial context
            is_finance_query = self.is_finance_related(prompt.lower())
            
            # Add financial context if needed
            if is_finance_query:
                prompt = self.add_financial_context(prompt)
            
            # Use increased max length for financial responses
            if "max_new_tokens" not in parameters and is_finance_query:
                parameters["max_new_tokens"] = 150
            
            # Run the local model
            if self.local_pipe:
                output = self.local_pipe(prompt, **parameters)
                # Extract the generated text (standard format for text-generation)
                response_text = output[0]["generated_text"]
                
                # Clean up the response
                response_text = self.clean_response(response_text, prompt)
            else:
                # Fallback if model failed to load
                response_text = "I apologize, but our AI service is temporarily unavailable. Please try again later."

            return Response({"response": response_text})
        except Exception as e:
            logging.error(f"HuggingFaceProxy Error: {str(e)}")
            return Response({"error": str(e)}, status=500)
    
    def is_finance_related(self, text):
        """Check if the query is related to finance."""
        finance_terms = [
            'money', 'finance', 'budget', 'invest', 'stock', 'market', 'fund',
            'saving', 'retirement', 'income', 'expense', 'debt', 'credit', 'loan',
            'mortgage', 'interest', 'dividend', 'portfolio', 'tax', 'inflation',
            'economy', 'financial', 'bank', 'crypto', 'bitcoin', 'ethereum',
            'compound interest', 'apr', 'apy', 'bond', 'etf', 'mutual fund',
            'forex', 'hedge fund', 'ira', '401k', 'cash flow', 'asset', 'liability',
            'net worth', 'bull market', 'bear market', 'capital gain', 'diversification',
            'liquidity', 'amortization', 'annuity', 'depreciation', 'equity', 'leverage',
            'yield', 'security', 'volatility', 'appreciation', 'depreciation', 'fiduciary',
            'principal', 'premium', 'maturity', 'roi', 'roic', 'exchange rate', 'roth'
        ]
        
        return any(term in text for term in finance_terms)
    
    def add_financial_context(self, prompt):
        """Add financial context to improve responses."""
        financial_context = (
            "You are a helpful and knowledgeable financial assistant. "
            "Provide accurate, concise information about personal finance, investing, "
            "budgeting, and financial education. Focus on educational content "
            "rather than specific investment advice. Your responses should be "
            "clear, direct, and factual without unnecessary introductions or "
            "self-references. Avoid saying 'I am a financial assistant' or similar "
            "phrases. Just provide the useful financial information directly.\n\n"
        )
        
        if "User:" in prompt and "AI:" in prompt:
            # Add context but preserve conversation format
            parts = prompt.split("User:", 1)
            return financial_context + "User:" + parts[1]
        else:
            return financial_context + prompt
    
    def clean_response(self, response_text, original_prompt):
        """Clean up the generated response text."""
        # Remove the original prompt from the beginning if it exists
        if response_text.startswith(original_prompt):
            response_text = response_text[len(original_prompt):].strip()
        
        # If we have AI: in the text, take only what follows the last AI:
        if "AI:" in response_text:
            response_text = response_text.split("AI:")[-1].strip()
        
        # Remove any trailing User: or Human: segments and their contents
        if "User:" in response_text:
            response_text = response_text.split("User:", 1)[0].strip()
        if "Human:" in response_text:
            response_text = response_text.split("Human:", 1)[0].strip()
        
        # Extract potential user query to check for repetitions
        user_query = ""
        if "User:" in original_prompt:
            user_query_parts = original_prompt.split("User:")
            if len(user_query_parts) > 1:
                user_query = user_query_parts[-1].split("AI:", 1)[0].strip().lower()
        
        # Remove repetitions of the user's query
        if user_query:
            # Try to match pattern like "how can i buy a house? how can i buy a house?"
            escaped_query = re.escape(user_query)
            response_text = re.sub(f"^{escaped_query}\\??\\s*{escaped_query}", "", response_text, flags=re.IGNORECASE)
            
            # Remove multiple repetitions
            repetition_pattern = f"({escaped_query}\\??\\s*){{2,}}"
            response_text = re.sub(repetition_pattern, "", response_text, flags=re.IGNORECASE)
            
            # Remove the question at the beginning
            response_text = re.sub(f"^{escaped_query}\\??\\s*", "", response_text, flags=re.IGNORECASE)
        
        # Remove common bot introduction patterns
        response_text = response_text.replace("I am a financial assistant.", "")
        response_text = response_text.replace("I am an AI assistant.", "")
        response_text = response_text.replace("As a financial advisor,", "")
        response_text = response_text.replace("As an AI assistant,", "")
        response_text = response_text.replace("As an AI language model,", "")
        
        # Remove introductory phrases
        intro_phrases = [
            "I'd be happy to explain",
            "I'd be glad to help",
            "I can help with that",
            "Let me explain",
            "To answer your question",
            "Here's information about",
            "Great question",
            "Sure,",
            "Certainly,",
            "Absolutely,",
            "Hello,",
            "Hi,",
            "I understand you're asking about",
            "I'd like to help you",
            "I'd love to assist",
        ]
        
        for phrase in intro_phrases:
            if response_text.lower().startswith(phrase.lower()):
                response_text = response_text[len(phrase):].strip()
                # Remove comma if present
                if response_text.startswith(","):
                    response_text = response_text[1:].strip()
                    
        # If response is too short, provide a fallback
        if len(response_text.strip()) < 10:
            return "I don't have enough information to answer that properly. Could you provide more details about your financial question?"
            
        return response_text.strip()


class OpenRouterProxyView(APIView):
    permission_classes = [IsAuthenticated]

    def is_greeting(self, text):
        """Check if the message is a simple greeting."""
        greetings = ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening']
        return text.lower().strip() in greetings

    def is_path_query(self, text):
        """Check if the message is asking about learning paths or courses."""
        path_terms = ['path', 'course', 'learn', 'study', 'curriculum', 'track']
        return any(term in text.lower() for term in path_terms)
        
    def is_recommendation_query(self, text):
        """Check if the message is asking for recommendations."""
        recommend_terms = ['recommend', 'suggest', 'what should', 'which', 'best', 'next course']
        return any(term in text.lower() for term in recommend_terms)
        
    def is_reset_query(self, text):
        """Check if the message is requesting to reset or clear the chat."""
        reset_terms = ['start over', 'clear chat', 'reset', 'new chat', 'clear history']
        return any(term in text.lower() for term in reset_terms)
        
    def get_available_paths(self):
        """Get a list of all active learning paths."""
        try:
            from core.models import Path
            # Fetch both title and id for creating links
            paths = Path.objects.all().values('title', 'id')
            # Create a mapping of lowercase titles to path URLs
            self.path_links = {p['title'].lower(): f"/all-topics#{p['id']}" for p in paths}
            return [p['title'] for p in paths]
        except Exception as e:
            logging.error(f"Error retrieving learning paths: {str(e)}")
            # Fallback to default paths if database query fails
            default_paths = ["Basic Finance", "Investing", "Real Estate", "Cryptocurrency"]
            self.path_links = {p.lower(): f"/all-topics#{p.lower().replace(' ', '-')}" for p in default_paths}
            return default_paths

    def format_paths_for_message(self):
        """Format available paths for inclusion in system message."""
        paths = self.get_available_paths()
        if not paths:
            return "various financial topics"
        return ", ".join(paths)
        
    def recommend_path(self, user):
        """Recommend a learning path based on user profile."""
        try:
            # Get user profile and check experience level
            from core.models import UserProfile, Path
            profile = UserProfile.objects.get(user=user)
            
            # Simple recommendation logic based on experience level
            if hasattr(profile, 'experience_level'):
                if profile.experience_level == 'beginner':
                    return "Based on your profile, I recommend starting with our Basic Finance path to build a solid foundation."
                elif profile.experience_level == 'intermediate':
                    return "With your intermediate knowledge, our Investing path would be a great next step to grow your wealth."
                else:
                    return "Given your advanced experience, exploring our Real Estate or Cryptocurrency paths could provide valuable insights."
            
            # Fallback recommendation
            return f"I recommend starting with our Basic Finance path to build a strong foundation. We also offer paths in {self.format_paths_for_message()}."
            
        except Exception as e:
            logging.error(f"Error generating recommendation: {str(e)}")
            return f"I recommend exploring our learning paths: {self.format_paths_for_message()}. Basic Finance is a great place to start!"

    def get_path_from_query(self, text):
        """Extract specific path name from a query, if mentioned."""
        if not hasattr(self, 'path_links'):
            self.get_available_paths()
            
        text_lower = text.lower()
        for path_name in self.path_links.keys():
            if path_name in text_lower:
                return path_name
        return None

    def post(self, request):
        prompt = request.data.get("inputs", "").strip()
        parameters = request.data.get("parameters", {})
        chat_history = request.data.get("chatHistory", [])
        
        if not prompt:
            return Response({"error": "Prompt is required."}, status=400)

        # Generate cache key for development environment
        cache_key = None
        if settings.DEBUG:
            cache_key = f"openrouter_response_{request.user.id}_{hash(prompt)}"
            cached_response = cache.get(cache_key)
            if cached_response:
                return Response(cached_response)

        try:
            # Initialize path links if not done already
            if not hasattr(self, 'path_links'):
                self.get_available_paths()
                
            # Handle special intents
            if self.is_greeting(prompt):
                return Response({
                    "response": "Hi! I'm your financial assistant. What would you like to learn about today?"
                })
                
            if self.is_reset_query(prompt):
                return Response({
                    "response": "I've reset our conversation. What financial topic would you like to discuss now?"
                })

            # Check for specific path in query
            specific_path = self.get_path_from_query(prompt)
            if specific_path:
                return Response({
                    "response": f"Our {specific_path.title()} path covers essential topics to help you master this area of finance. Would you like to explore this learning path?",
                    "link": {
                        "text": f"View {specific_path.title()} Path",
                        "path": self.path_links[specific_path],
                        "icon": "📚"
                    }
                })

            if self.is_path_query(prompt):
                paths = self.format_paths_for_message()
                return Response({
                    "response": f"I can help you explore our learning paths. We currently offer: {paths}. Which one interests you?",
                    "links": [
                        {
                            "text": f"View {path.title()} Path",
                            "path": self.path_links.get(path.lower(), f"/all-topics#{path.lower().replace(' ', '-')}"),
                            "icon": "📚"
                        }
                        for path in self.get_available_paths()
                    ]
                })
                
            if self.is_recommendation_query(prompt):
                recommendation = self.recommend_path(request.user)
                return Response({
                    "response": recommendation,
                    "links": [
                        {
                            "text": f"View {path.title()} Path",
                            "path": self.path_links.get(path.lower(), f"/all-topics#{path.lower().replace(' ', '-')}"),
                            "icon": "📚"
                        }
                        for path in self.get_available_paths()[:2]  # Just show top 2 recommendations
                    ]
                })

            # Check if we should add financial context
            is_finance_query = self.is_finance_related(prompt.lower())
            if is_finance_query:
                prompt = self.add_financial_context(prompt)

            # Get user information for personalization if available
            user = request.user
            user_context = self.get_user_context(user)
            if user_context:
                prompt = f"{user_context}\n\n{prompt}"

            # Prepare the request for OpenRouter API
            headers = {
                "Authorization": f"Bearer {os.environ.get('OPENROUTER_API_KEY', '')}",
                "HTTP-Referer": "https://monevo.com",  # Replace with your actual domain
                "X-Title": "Monevo Financial Assistant",
                "Content-Type": "application/json",
            }

            # Format the messages for OpenRouter
            messages = []
            
            # System message with financial guidance
            available_paths = self.format_paths_for_message()
            system_message = {
                "role": "system", 
                "content": (
                    "You are a helpful financial assistant specialized in personal finance education. "
                    f"We currently offer these learning paths: {available_paths}. "
                    "Keep all responses brief and to the point - aim for 2-3 sentences maximum. "
                    "For financial questions, provide only the most essential information. "
                    "Avoid lists, bullet points, or lengthy explanations. "
                    "Never make up specific course content or paths that don't exist. "
                    "If unsure about specific details, suggest asking about our available learning paths."
                )
            }
            messages.append(system_message)
            
            # Use chat history if provided
            if chat_history and isinstance(chat_history, list) and len(chat_history) > 0:
                messages.extend(chat_history)
            else:
                # Parse conversation history if provided in older format
                if "User:" in prompt and "AI:" in prompt:
                    # Extract conversation parts
                    conversation_parts = []
                    for part in re.split(r'(User:|AI:)', prompt):
                        if part and part not in ["User:", "AI:"]:
                            conversation_parts.append(part.strip())
                    
                    # Convert to message format, assuming alternating user/assistant messages
                    for i, content in enumerate(conversation_parts):
                        role = "user" if i % 2 == 0 else "assistant"
                        messages.append({"role": role, "content": content})
                else:
                    # Just a single user message
                    messages.append({"role": "user", "content": prompt})
            
            # Define parameters for the API call
            api_params = {
                "model": "mistralai/mistral-7b-instruct", # Using Mistral 7B as it's a reliable free model
                "messages": messages,
                "temperature": parameters.get("temperature", 0.7),
                "max_tokens": parameters.get("max_new_tokens", 150), # Reduced max tokens for shorter responses
            }
            
            # Make the API call to OpenRouter
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=api_params
            )
            
            # Process the response
            if response.status_code == 200:
                response_data = response.json()
                if "choices" in response_data and len(response_data["choices"]) > 0:
                    ai_response = response_data["choices"][0]["message"]["content"]
                    cleaned_response = self.clean_response(ai_response, prompt)
                    
                    # Check if the response might be talking about a specific path
                    result = {"response": cleaned_response}
                    
                    for path_name in self.path_links.keys():
                        if path_name in cleaned_response.lower():
                            # Add a link for the mentioned path
                            result["link"] = {
                                "text": f"View {path_name.title()} Path",
                                "path": self.path_links[path_name],
                                "icon": "📚"
                            }
                            break
                    
                    # Cache the response in development mode
                    if settings.DEBUG and cache_key:
                        cache.set(cache_key, result, timeout=300)  # 5 minutes TTL
                        
                    return Response(result)
                else:
                    return Response({"error": "No valid response from the model."}, status=500)
            else:
                return Response({"error": f"Error from OpenRouter API: {response.text}"}, status=response.status_code)
                
        except Exception as e:
            logging.error(f"OpenRouter Error: {str(e)}")
            return Response({"error": str(e)}, status=500)

    def is_finance_related(self, text):
        """Check if the query is related to finance."""
        finance_terms = [
            'money', 'finance', 'budget', 'invest', 'stock', 'market', 'fund',
            'saving', 'retirement', 'income', 'expense', 'debt', 'credit', 'loan',
            'mortgage', 'interest', 'dividend', 'portfolio', 'tax', 'inflation',
            'economy', 'financial', 'bank', 'crypto', 'bitcoin', 'ethereum',
            'compound interest', 'apr', 'apy', 'bond', 'etf', 'mutual fund',
            'forex', 'hedge fund', 'ira', '401k', 'cash flow', 'asset', 'liability',
            'net worth', 'bull market', 'bear market', 'capital gain', 'diversification',
            'liquidity', 'amortization', 'annuity', 'depreciation', 'equity', 'leverage',
            'yield', 'security', 'volatility', 'appreciation', 'depreciation', 'fiduciary',
            'principal', 'premium', 'maturity', 'roi', 'roic', 'exchange rate', 'roth'
        ]
        
        return any(term in text for term in finance_terms)
    
    def add_financial_context(self, prompt):
        """Add financial context to improve responses."""
        financial_context = (
            "You are a helpful and knowledgeable financial assistant. "
            "Provide accurate, concise information about personal finance, investing, "
            "budgeting, and financial education. Focus on educational content "
            "rather than specific investment advice. Your responses should be "
            "clear, direct, and factual without unnecessary introductions or "
            "self-references. Avoid saying 'I am a financial assistant' or similar "
            "phrases. Just provide the useful financial information directly.\n\n"
        )
        
        if "User:" in prompt and "AI:" in prompt:
            # Add context but preserve conversation format
            parts = prompt.split("User:", 1)
            return financial_context + "User:" + parts[1]
        else:
            return financial_context + prompt
    
    def get_user_context(self, user):
        """Get personalized context for the user."""
        try:
            # Get user profile info if available
            context_parts = []
            
            from core.models import UserProfile, Path, UserProgress
            
            try:
                profile = UserProfile.objects.get(user=user)
                # Add points information
                if hasattr(profile, 'points'):
                    context_parts.append(f"The user has {profile.points} points in their account.")
                
                # Add current learning paths if available
                user_progress = UserProgress.objects.filter(user=user)
                if user_progress.exists():
                    paths = set()
                    for progress in user_progress:
                        if progress.course and progress.course.path:
                            paths.add(progress.course.path.title)
                    if paths:
                        context_parts.append(f"The user is currently following these learning paths: {', '.join(paths)}.")
                
                # Add completed lessons
                completed_lessons = user_progress.filter(is_course_complete=True).count()
                if completed_lessons > 0:
                    context_parts.append(f"The user has completed {completed_lessons} courses.")
                    
                # Add experience level if available
                if hasattr(profile, 'experience_level') and profile.experience_level:
                    context_parts.append(f"The user's financial experience level is: {profile.experience_level}.")
            except (UserProfile.DoesNotExist, Exception) as e:
                # If we can't get the profile, just proceed without user context
                pass
                
            if context_parts:
                return "User context: " + " ".join(context_parts)
            
            return None
            
        except Exception as e:
            logging.error(f"Error getting user context: {str(e)}")
            return None
    
    def clean_response(self, response_text, original_prompt):
        """Clean up the generated response text."""
        # For OpenRouter responses, we generally don't need as much cleaning
        # as the responses are usually well-formatted, but we'll keep some logic
        
        # Remove any trailing User: or Human: segments and their contents
        if "User:" in response_text:
            response_text = response_text.split("User:", 1)[0].strip()
        if "Human:" in response_text:
            response_text = response_text.split("Human:", 1)[0].strip()
        
        # Remove common bot introduction patterns
        response_text = response_text.replace("I am a financial assistant.", "")
        response_text = response_text.replace("I am an AI assistant.", "")
        response_text = response_text.replace("As a financial advisor,", "")
        response_text = response_text.replace("As an AI assistant,", "")
        response_text = response_text.replace("As an AI language model,", "")
        
        # Remove introductory phrases
        intro_phrases = [
            "I'd be happy to explain",
            "I'd be glad to help",
            "I can help with that",
            "Let me explain",
            "To answer your question",
            "Here's information about",
            "Great question",
            "Sure,",
            "Certainly,",
            "Absolutely,",
            "Hello,",
            "Hi,",
            "I understand you're asking about",
            "I'd like to help you",
            "I'd love to assist",
        ]
        
        for phrase in intro_phrases:
            if response_text.lower().startswith(phrase.lower()):
                response_text = response_text[len(phrase):].strip()
                # Remove comma if present
                if response_text.startswith(","):
                    response_text = response_text[1:].strip()
                    
        # If response is too short, provide a fallback
        if len(response_text.strip()) < 10:
            return "I don't have enough information to answer that properly. Could you provide more details about your financial question?"
            
        return response_text.strip()


class UserProfileView(APIView):
    """View to handle user profile data retrieval and updates."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Retrieve and return the user's profile data."""
        user_profile = UserProfile.objects.get(user=request.user)

        # Get the current month's activity data
        today = timezone.now().date()
        first_day = today.replace(day=1)
        last_day = (first_day + timezone.timedelta(days=32)).replace(day=1) - timezone.timedelta(days=1)
        
        # Get all lesson completions for the current month
        lesson_completions = LessonCompletion.objects.filter(
            user_progress__user=request.user,
            completed_at__date__gte=first_day,
            completed_at__date__lte=last_day
        ).values('completed_at__date').annotate(count=models.Count('id'))

        # Create a dictionary of dates with completion counts
        activity_calendar = {
            str(date): 0 for date in [first_day + timezone.timedelta(days=x) for x in range((last_day - first_day).days + 1)]
        }
        
        for completion in lesson_completions:
            activity_calendar[str(completion['completed_at__date'])] = completion['count']

        # Add current month information
        current_month = {
            'first_day': first_day.isoformat(),
            'last_day': last_day.isoformat(),
            'month_name': first_day.strftime('%B'),
            'year': first_day.year
        }

        return Response({
            "user_data": {
                "first_name": request.user.first_name,
                "last_name": request.user.last_name,
                "email": request.user.email,
                "earned_money": user_profile.earned_money,
                "points": user_profile.points,
                "streak": user_profile.streak,
                "profile_avatar": user_profile.profile_avatar,
                "dark_mode": user_profile.dark_mode,
                "email_reminder_preference": user_profile.email_reminder_preference,
                "has_paid": user_profile.has_paid
            },
            "activity_calendar": activity_calendar,
            "current_month": current_month
        })

    def patch(self, request):
        """Update specific fields in the user's profile."""
        user_profile = request.user.profile
        email_reminder_preference = request.data.get('email_reminder_preference')
        if email_reminder_preference is not None:
            user_profile.email_reminder_preference = email_reminder_preference
            user_profile.save()
        return Response({"message": "Profile updated successfully."})


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom view to obtain JWT tokens and include user details in the response."""

    def post(self, request, *args, **kwargs):
        """Handle POST requests to generate access and refresh tokens."""
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            user = request.user
            if user.is_authenticated:
                return Response({
                    'access': response.data['access'],
                    'refresh': response.data['refresh'],
                    'user': {
                        'username': user.username,
                        'email': user.email
                    }
                })
        return response


class RegisterView(generics.CreateAPIView):
    """View to handle user registration and return JWT tokens upon successful registration."""

    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        """Handle user registration and return access and refresh tokens."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.save()
        refresh = RefreshToken.for_user(user)

        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email
            },
            "next": "/all-topics/"
        }, status=status.HTTP_201_CREATED)


class LogoutView(APIView):
    """Handles user logout by clearing JWT cookies."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Handle POST requests to log out the user and clear cookies."""
        response = JsonResponse({"message": "Logout successful."})
        return delete_jwt_cookies(response)


class LogoutSecureView(APIView):
    """Enhanced logout view that clears HttpOnly cookies."""
    
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Handle POST requests to log out the user and clear cookies."""
        try:
            response = Response({"message": "Logout successful."})
            # Clear the refresh token cookie
            response.delete_cookie(
                'refresh_token',
                path="/",
                samesite='None',
                secure=True
            )
            return response
        except Exception as e:
            logger.error(f"Logout error: {str(e)}")
            return Response({"error": "Logout failed"}, status=500)


class PathViewSet(viewsets.ModelViewSet):
    """ViewSet to manage paths, including listing and retrieving paths."""

    queryset = Path.objects.all()
    serializer_class = PathSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        """Handle GET requests to list all paths."""
        return super().list(request, *args, **kwargs)


class UserProfileViewSet(viewsets.ModelViewSet):
    """ViewSet to manage user profiles, including updating and retrieving profile data."""

    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return UserProfile.objects.filter(user=self.request.user)

    @action(detail=False, methods=['post'])
    def update_email_reminder(self, request):
        preference = request.data.get('email_reminder_preference')
        if preference not in dict(UserProfile.REMINDER_CHOICES):
            return Response(
                {'error': 'Invalid reminder preference'},
                status=status.HTTP_400_BAD_REQUEST
            )

        profile = self.get_queryset().first()
        if not profile:
            return Response(
                {'error': 'Profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        profile.email_reminder_preference = preference
        profile.save()

        return Response({
            'message': 'Email reminder preference updated successfully',
            'email_reminder_preference': preference
        })

    @action(detail=False, methods=["post"], url_path="add-generated-image")
    def add_generated_image(self, request):
        """Handle POST requests to add a generated image to the user's profile."""
        user_profile = request.user.profile
        image = request.FILES.get('image')

        if not image:
            return Response({"error": "No image file provided."}, status=status.HTTP_400_BAD_REQUEST)

        file_path = default_storage.save(f'generated_images/{image.name}', ContentFile(image.read()))

        user_profile.add_generated_image(file_path)

        return Response({"message": "Image added successfully!", "file_path": file_path}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="get-generated-images")
    def get_generated_images(self, request):
        """Handle GET requests to retrieve all generated images for the user."""
        user_profile = request.user.userprofile
        return Response({"generated_images": user_profile.generated_images})

    @action(detail=False, methods=["post"], url_path="save-avatar")
    def save_avatar(self, request):
        """Handle POST requests to save the user's avatar URL."""
        user_profile = request.user.profile
        avatar_url = request.data.get("avatar_url")

        if not avatar_url:
            return Response({"error": "Avatar URL is missing."}, status=status.HTTP_400_BAD_REQUEST)

        user_profile.profile_avatar = avatar_url
        user_profile.save()
        return Response({"message": "Avatar saved successfully.", "avatar_url": avatar_url})

class CourseViewSet(viewsets.ModelViewSet):
    """ViewSet to manage courses, including listing, retrieving, and updating course data."""
    queryset = Course.objects.all()
    serializer_class = CourseSerializer


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_avatar(request):
    """Update the user's avatar with a valid DiceBear URL."""
    avatar_url = request.data.get('profile_avatar')

    if not avatar_url or not (
        avatar_url.startswith('https://avatars.dicebear.com/') or
        avatar_url.startswith('https://api.dicebear.com/')
    ):
        return Response(
            {"error": "Invalid avatar URL. Only DiceBear avatars are allowed."},
            status=status.HTTP_400_BAD_REQUEST
        )

    user_profile = request.user.profile
    user_profile.profile_avatar = avatar_url
    user_profile.save()

    return Response({"status": "success", "avatar_url": avatar_url})


class LessonViewSet(viewsets.ModelViewSet):
    """ViewSet to manage lessons, including tracking progress and marking sections as complete."""
    queryset = Lesson.objects.all()
    serializer_class = LessonSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'])
    def complete_section(self, request, pk=None):
        """Mark a specific section of a lesson as completed."""
        lesson = self.get_object()
        section_id = request.data.get('section_id')

        # Track progress
        progress, _ = UserProgress.objects.get_or_create(
            user=request.user,
            course=lesson.course
        )
        progress.completed_sections.add(section_id)
        progress.save()

        return Response({"message": "Section completed!", "next_section": get_next_section()}) # type: ignore

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def with_progress(self, request):
        """Retrieve lessons with progress information for a specific course."""
        course_id = request.query_params.get("course", None)
        if not course_id:
            return Response({"error": "Course ID is required."}, status=400)

        try:
            user_progress = UserProgress.objects.get(
                user=request.user,
                course_id=course_id
            )
            completed_lesson_ids = list(user_progress.completed_lessons.values_list('id', flat=True))
            completed_sections = list(user_progress.completed_sections.values_list('id', flat=True))
        except UserProgress.DoesNotExist:
            completed_lesson_ids = []
            completed_sections = []

        lessons = self.get_queryset().filter(course_id=course_id).prefetch_related('sections')
        serializer = self.get_serializer(
            lessons,
            many=True,
            context={'completed_lesson_ids': completed_lesson_ids}
        )
        lesson_data = serializer.data

        for lesson in lesson_data:
            total = len(lesson['sections'])
            completed = sum(1 for s in lesson['sections'] if s['id'] in completed_sections)
            lesson['total_sections'] = total
            lesson['completed_sections'] = completed
            lesson['progress'] = f"{(completed / total * 100) if total > 0 else 0}%"

        return Response(lesson_data)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def complete(self, request):
        """Mark a lesson as completed and update the user's progress and streak."""
        lesson_id = request.data.get('lesson_id')
        user = request.user

        try:
            lesson = Lesson.objects.get(id=lesson_id)
            user_progress, created = UserProgress.objects.get_or_create(
                user=user, course=lesson.course
            )

            # Mark lesson complete (LessonCompletion logic stays)
            LessonCompletion.objects.get_or_create(
                user_progress=user_progress,
                lesson=lesson
            )

            # Update global streak inside UserProfile
            user_profile = user.userprofile
            user_profile.update_streak()

            user_profile.add_money(5.00)
            user_profile.add_points(10)

            total_lessons = lesson.course.lessons.count()
            completed_lessons = user_progress.completed_lessons.count()
            if completed_lessons == total_lessons:
                user_progress.mark_course_complete()

            return Response({"message": "Lesson completed!"}, status=status.HTTP_200_OK)
        except Lesson.DoesNotExist:
            return Response({"error": "Lesson not found."}, status=status.HTTP_404_NOT_FOUND)

class QuizViewSet(viewsets.ModelViewSet):
    """ViewSet to manage quizzes, including retrieving and completing quizzes."""

    queryset = Quiz.objects.all()
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Retrieve quizzes for a specific course."""
        user = self.request.user
        course_id = self.request.query_params.get("course")
        if not course_id:
            return Quiz.objects.none()

        quizzes = Quiz.objects.filter(course_id=course_id)
        return quizzes

    @action(detail=False, methods=["post"], permission_classes=[IsAuthenticated])
    def complete(self, request):
        """Mark a quiz as completed and reward the user if the answer is correct."""
        quiz_id = request.data.get("quiz_id")
        selected_answer = request.data.get("selected_answer")

        try:
            quiz = Quiz.objects.get(id=quiz_id)
            if quiz.correct_answer == selected_answer:
                QuizCompletion.objects.create(user=request.user, quiz=quiz)

                user_profile = request.user.userprofile
                user_profile.add_money(10.00)
                user_profile.add_points(20)
                user_profile.save()

                return Response({"message": "Quiz completed!"}, status=status.HTTP_200_OK)
            else:
                return Response({"message": "Incorrect answer."}, status=status.HTTP_400_BAD_REQUEST)
        except Quiz.DoesNotExist:
            return Response({"error": "Quiz not found."}, status=status.HTTP_404_NOT_FOUND)


class UserProgressViewSet(viewsets.ModelViewSet):
    """ViewSet to manage user progress, including tracking lessons, courses, and paths."""

    queryset = UserProgress.objects.all()
    serializer_class = UserProgressSerializer
    permission_classes = [IsAuthenticated]

    def check_path_completion(self, user, course):
        """Check if the user has completed all courses in a path and reward them."""
        path = course.path
        if not path:
            return

        courses_in_path = Course.objects.filter(path=path)
        completed_courses = UserProgress.objects.filter(
            user=user,
            course__in=courses_in_path,
            is_course_complete=True
        ).count()

        if completed_courses == courses_in_path.count():
            user_profile = user.userprofile
            user_profile.add_money(100.00)
            user_profile.add_points(200)
            user_profile.save()

    @action(detail=False, methods=['post'], url_path='complete')
    def complete(self, request):
        """Mark a lesson as completed and update the user's progress and streak."""
        lesson_id = request.data.get('lesson_id')
        if not lesson_id:
            return Response({"error": "lesson_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            lesson = Lesson.objects.get(id=lesson_id)
            course = lesson.course
            user_profile = request.user.profile
            user_progress, created = UserProgress.objects.get_or_create(user=request.user, course=course)

            user_progress.completed_lessons.add(lesson)
            user_profile.add_money(Decimal('5.00'))
            user_profile.save()

            total_lessons = course.lessons.count()
            completed_lessons = user_progress.completed_lessons.count()
            if completed_lessons == total_lessons:
                user_profile.add_money(Decimal('50.00'))
                user_profile.add_points(50)
                user_profile.save()

                user_progress.is_course_complete = True
                user_progress.course_completed_at = timezone.now()
                user_progress.save()

                # ✅ Check for complete_path mission updates
                path_missions = MissionCompletion.objects.filter(
                    user=request.user,
                    mission__goal_type="complete_path",
                    status__in=["not_started", "in_progress"]
                )
                for mission_completion in path_missions:
                    mission_completion.update_progress()

                # ✅ Also reward full path if completed
                path = course.path
                if path:
                    courses_in_path = Course.objects.filter(path=path)
                    completed_courses = UserProgress.objects.filter(
                        user=request.user,
                        course__in=courses_in_path,
                        is_course_complete=True
                    ).count()

                    if completed_courses == courses_in_path.count():
                        user_profile.add_money(Decimal('100.00'))
                        user_profile.add_points(100)
                        user_profile.save()

            user_progress.update_streak()

            # ✅ Update lesson-related missions
            lesson_missions = MissionCompletion.objects.filter(
                user=request.user,
                mission__goal_type="complete_lesson",
                status__in=["not_started", "in_progress"]
            )
            for mission_completion in lesson_missions:
                mission_completion.update_progress()

            return Response(
                {"status": "Lesson completed", "streak": user_progress.user.profile.streak},
                status=status.HTTP_200_OK
            )

        except Lesson.DoesNotExist:
            return Response({"error": "Lesson not found"}, status=status.HTTP_404_NOT_FOUND)



    @action(detail=False, methods=["get"])
    def progress_summary(self, request):
        """Retrieve a summary of the user's progress across all courses and paths."""
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

    @action(detail=False, methods=['post'], url_path='complete_section')
    def complete_section(self, request):
        """Mark a specific section of a lesson as completed."""
        section_id = request.data.get('section_id')
        user = request.user
        try:
            section = LessonSection.objects.get(id=section_id)
            progress, _ = UserProgress.objects.get_or_create(
                user=user,
                course=section.lesson.course
            )
            progress.completed_sections.add(section)
            progress.save()
            return Response({"status": "Section completed"})
        except LessonSection.DoesNotExist:
            return Response({"error": "Invalid section"}, status=400)


class LeaderboardViewSet(APIView):
    """API view to retrieve the top 10 users based on points for the leaderboard."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Handle GET requests to fetch the top users for the leaderboard."""
        try:
            # Get time filter parameter
            time_filter = request.query_params.get('time_filter', 'all-time')
            
            # Apply time-based filtering
            if time_filter == 'week':
                one_week_ago = timezone.now().date() - timedelta(days=7)
                top_profiles = UserProfile.objects.filter(
                    last_completed_date__gte=one_week_ago
                ).order_by('-points')[:10]
            elif time_filter == 'month':
                one_month_ago = timezone.now().date() - timedelta(days=30)
                top_profiles = UserProfile.objects.filter(
                    last_completed_date__gte=one_month_ago
                ).order_by('-points')[:10]
            else:  # all-time
                top_profiles = UserProfile.objects.all().order_by('-points')[:10]
                
            serializer = LeaderboardSerializer(top_profiles, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Leaderboard error: {str(e)}")
            return Response({"error": str(e)}, status=500)
            
            
class UserRankView(APIView):
    """API view to retrieve the current user's rank in the leaderboard."""
    
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Handle GET requests to fetch the current user's rank."""
        try:
            user_profile = request.user.profile
            higher_ranked_users = UserProfile.objects.filter(points__gt=user_profile.points).count()
            
            # User's rank is the count of users with more points + 1
            rank = higher_ranked_users + 1
            
            return Response({
                "rank": rank,
                "points": user_profile.points,
                "user": {
                    "id": request.user.id,
                    "username": request.user.username,
                    "profile_avatar": user_profile.profile_avatar
                }
            })
        except Exception as e:
            logger.error(f"User rank error: {str(e)}")
            return Response({"error": str(e)}, status=500)


class UserSettingsView(APIView):
    """API view to retrieve and update user settings, including profile and preferences."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Handle GET requests to fetch the user's current settings."""
        user_profile = UserProfile.objects.get(user=request.user)
        return Response({
            "email_reminder_preference": user_profile.email_reminder_preference,
            "dark_mode": user_profile.dark_mode,
            "profile": {
                "username": request.user.username,
                "email": request.user.email,
                "first_name": request.user.first_name,
                "last_name": request.user.last_name,
                "dark_mode": user_profile.dark_mode,
            },
        })

    def patch(self, request):
        """Handle PATCH requests to update the user's settings."""
        user = request.user
        user_profile = user.profile

        # Update profile data
        profile_data = request.data.get('profile', {})
        if profile_data:
            user.username = profile_data.get('username', user.username)
            user.email = profile_data.get('email', user.email)
            user.first_name = profile_data.get('first_name', user.first_name)
            user.last_name = profile_data.get('last_name', user.last_name)
            user.save()

        # Update other settings
        dark_mode = request.data.get('dark_mode')
        if dark_mode is not None:
            user_profile.dark_mode = dark_mode

        email_reminder_preference = request.data.get('email_reminder_preference')
        if email_reminder_preference in dict(UserProfile.REMINDER_CHOICES):
            user_profile.email_reminder_preference = email_reminder_preference

        user_profile.save()
        
        # Return updated settings
        return Response({
            "message": "Settings updated successfully.",
            "dark_mode": user_profile.dark_mode,
            "email_reminder_preference": user_profile.email_reminder_preference
        })


class MissionView(APIView):
    """API view to retrieve and update user missions, including daily and weekly missions."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Handle GET requests to fetch the user's daily and weekly missions."""
        user = request.user
        try:
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
        """Handle POST requests to update the progress of a specific mission."""
        user = request.user
        try:
            mission_completion = MissionCompletion.objects.get(user=user, mission_id=mission_id)
            increment = request.data.get("progress", 0)

            if not isinstance(increment, int):
                return Response({"error": "Progress must be an integer."}, status=400)

            mission_completion.update_progress(increment)
            return Response({"message": "Mission progress updated.", "progress": mission_completion.progress}, status=200)

        except MissionCompletion.DoesNotExist:
            return Response({"error": "Mission not found for this user."}, status=404)
        except Exception as e:
            logging.error(f"Error updating mission progress for user {user.username}: {str(e)}")
            return Response({"error": "An error occurred while updating mission progress."}, status=500)


class SavingsAccountView(APIView):
    """API view to manage the user's simulated savings account, including retrieving the balance and adding funds."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Retrieve the current balance of the user's simulated savings account."""
        try:
            account, _ = SimulatedSavingsAccount.objects.get_or_create(user=request.user)
            return Response({"balance": float(account.balance)}, status=200)
        except Exception as e:
            logger.error(f"Error getting savings balance: {str(e)}")
            return Response({"error": "Failed to retrieve savings balance"}, status=500)

    def post(self, request):
        """Add funds to the user's simulated savings account and update related missions."""
        try:
            amount = Decimal(str(request.data.get("amount", 0)))
            if amount <= 0:
                return Response({"error": "Amount must be positive"}, status=400)

            today = timezone.now().date()
            user = request.user

            with transaction.atomic():
                # Update savings account
                account, created = SimulatedSavingsAccount.objects.select_for_update().get_or_create(
                    user=user,
                    defaults={'balance': amount}
                )
                if not created:
                    account.balance += amount
                    account.save()

                # Fetch all savings-related missions
                missions = MissionCompletion.objects.select_related('mission').filter(
                    user=user,
                    mission__goal_type="add_savings",
                    status__in=["not_started", "in_progress"]
                )

                for completion in missions:
                    mission_type = completion.mission.mission_type
                    target = Decimal(str(completion.mission.goal_reference.get('target', 100)))

                    # Daily savings: only update once per day
                    if mission_type == "daily":
                        if completion.completed_at is not None and completion.completed_at.date() == today:
                            continue  # Already completed today

                        increment = (amount / target) * 100
                        completion.progress = min(completion.progress + increment, 100)

                        if completion.progress >= 100:
                            completion.status = "completed"
                            completion.completed_at = timezone.now()

                    # Weekly savings: cumulative
                    elif mission_type == "weekly":
                        increment = (amount / target) * 100
                        completion.progress = min(completion.progress + increment, 100)

                        if completion.progress >= 100:
                            completion.status = "completed"
                            completion.completed_at = timezone.now()

                    completion.save()

                return Response({
                    "message": "Savings updated!",
                    "balance": float(account.balance)
                }, status=200)

        except (ValueError, InvalidOperation) as e:
            logger.error(f"Invalid amount: {str(e)}")
            return Response({"error": "Invalid numeric value"}, status=400)
        except Exception as e:
            logger.error(f"Savings error: {str(e)}", exc_info=True)
            return Response({"error": "Server error processing savings"}, status=500)


class FinanceFactView(APIView):
    """API view to manage finance facts, including retrieving unread facts and marking them as read."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Retrieve a random unread finance fact for the user."""
        try:
            # Get unread facts
            read_facts = UserFactProgress.objects.filter(
                user=request.user
            ).values_list('fact_id', flat=True)

            fact = FinanceFact.objects.filter(
                is_active=True
            ).exclude(id__in=read_facts).order_by('?').first()

            if not fact:
                return Response({"message": "No new facts available"}, status=404)

            return Response({
                "id": fact.id,
                "text": fact.text,
                "category": fact.category
            }, status=200)

        except Exception as e:
            logger.error(f"Fact fetch error: {str(e)}")
            return Response({"error": "Failed to get finance fact"}, status=500)


    def post(self, request):
        try:
            fact_id = request.data.get('fact_id')
            if not fact_id:
                return Response({"error": "Missing fact ID"}, status=400)

            fact = FinanceFact.objects.get(id=fact_id)
            today = now().date()

            # ✅ Prevent duplicate daily fact completion
            already_read_today = UserFactProgress.objects.filter(
                user=request.user,
                read_at__date=today
            ).exists()

            if already_read_today:
                return Response({"message": "You already completed today's finance fact."}, status=200)

            # ✅ Log the fact as read
            UserFactProgress.objects.create(user=request.user, fact=fact)

            # ✅ Progress both daily and weekly missions
            completions = MissionCompletion.objects.filter(
                user=request.user,
                mission__goal_type="read_fact",
                status__in=["not_started", "in_progress"]
            )

            for completion in completions:
                if completion.mission.mission_type == "daily":
                    completion.update_progress()  # 100% on 1st fact
                elif completion.mission.mission_type == "weekly":
                    completion.update_progress()  # +20% each time

            return Response({"message": "Fact marked as read!"}, status=200)

        except FinanceFact.DoesNotExist:
            return Response({"error": "Invalid fact ID"}, status=404)
        except Exception as e:
            logger.error(f"Fact completion error: {str(e)}")
            return Response({"error": "Failed to mark fact"}, status=500)




class ChatbotView(APIView):
    """API view to handle chatbot interactions, including sending user input to Dialogflow and receiving responses."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Handle POST requests to process user input and return a response from Dialogflow."""
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
        """Handle webhook requests from Dialogflow and provide appropriate responses based on the intent."""
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
    """API view to provide a list of tool categories available for users."""

    def get(self, request):
        """Handle GET requests to return a list of predefined tool categories."""
        tools = [
            {"category": "Forex Tools"},
            {"category": "Crypto Tools"},
            {"category": "News & Calendars"},
            {"category": "Basic Finance & Budgeting Tools"},
        ]
        return Response(tools)


class SavingsGoalCalculatorView(APIView):
    """API view to manage savings goal calculations and update user savings progress."""

    def post(self, request):
        """Handle POST requests to add a specified amount to the user's savings and update related missions."""
        amount = request.data.get("amount", 0)
        try:
            account, _ = SimulatedSavingsAccount.objects.get_or_create(user=request.user)
            account.add_to_balance(amount)

            mission_completions = MissionCompletion.objects.filter(
                user=request.user,
                mission__goal_type="add_savings"
            ).select_related('mission')

            for completion in mission_completions:
                target = completion.mission.goal_reference.get('target', 100)
                progress_increment = (amount / target) * 100
                completion.update_progress(increment=progress_increment, total=100)

            return Response({"message": "Savings updated!"}, status=200)
        except Exception as e:
            logger.error(f"Savings error: {str(e)}")
            return Response({"error": "Savings update failed"}, status=500)

class PasswordResetRequestView(APIView):
    """Handle password reset requests by generating a reset token and sending an email with the reset link."""

    permission_classes = [AllowAny]

    def post(self, request):
        """Process password reset requests by validating the email and sending a reset link."""
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
    """Handle password reset confirmation by validating the token and updating the user's password."""

    permission_classes = [AllowAny]

    def get(self, request, uidb64, token):
        """Validate the reset token and user ID to ensure the reset process can proceed."""
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
        """Reset the user's password after validating the token and ensuring the passwords match."""
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
    """Handle the retrieval and submission of questionnaire questions and answers."""

    permission_classes = [AllowAny]

    def get(self, request):
        """Retrieve and return all active questionnaire questions in order."""
        questions = Question.objects.order_by('order')
        serializer = QuestionSerializer(questions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        """Submit answers to the questionnaire and save them for the user."""
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
    """Provide personalized path recommendations based on user responses."""

    def get(self, request, user_id):
        """Retrieve user responses and recommend a learning path."""
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
    """Handle the submission of questionnaire answers by authenticated users."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Save user responses to the questionnaire and update their profile."""
        user = request.user
        answers = request.data.get('answers', {})

        if not answers:
            return Response({"error": "No answers provided."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            for question_id, answer in answers.items():
                question = Question.objects.get(id=question_id)
                UserResponse.objects.create(user=user, question=question, answer=answer)

            user_profile = UserProfile.objects.get(user=user)
            user_profile.save()

            return Response({"message": "Questionnaire submitted successfully."}, status=status.HTTP_201_CREATED)

        except Question.DoesNotExist:
            return Response({"error": "Invalid question ID."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"Error in QuestionnaireSubmitView: {e}")
            return Response({"error": "Something went wrong."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PersonalizedPathView(APIView):
    """API view to provide personalized learning paths for users based on their responses and preferences."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Retrieve personalized course recommendations for the user."""
        try:
            user_profile = UserProfile.objects.get(user=request.user)

            if not user_profile.has_paid:
                return Response({
                    "error": "Payment required for personalized path",
                    "redirect": "/payment-required"
                }, status=403)

            # Generate recommendations if not already present
            if not user_profile.recommended_courses:
                self.generate_recommendations(user_profile)

            recommended_courses = Course.objects.filter(
                id__in=user_profile.recommended_courses
            ).order_by('order')

            serializer = CourseSerializer(
                recommended_courses,
                many=True,
                context={'request': request}
            )

            # Cache control headers
            response = Response({
                "courses": serializer.data,
                "message": "Recommended courses based on your financial goals:"
            })
            response['Cache-Control'] = 'no-store, max-age=0'
            return response

        except Exception as e:
            logger.critical(f"Critical error in personalized path: {str(e)}", exc_info=True)
            return Response(
                {"error": "We're having trouble generating recommendations. Our team has been notified."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def generate_recommendations(self, user_profile):
        """Generate personalized course recommendations based on user responses."""
        responses = UserResponse.objects.filter(user=user_profile.user)
        path_weights = self.calculate_path_weights(responses)
        sorted_paths = sorted(path_weights.items(), key=lambda x: x[1], reverse=True)[:3]

        recommended_courses = self.get_recommended_courses(sorted_paths)
        user_profile.recommended_courses = [c.id for c in recommended_courses]
        user_profile.save()

    def get_basic_recommendations(self):
        """Provide basic course recommendations if no personalized data is available."""
        try:
            basic_courses = Course.objects.filter(
                is_active=True,
                path__title__iexact='Basic Finance'
            ).order_by('order')[:3]

            if not basic_courses.exists():
                logger.error("No basic courses found in database")
                return Response(
                    {"error": "No recommendations available"},
                    status=status.HTTP_404_NOT_FOUND
                )

            serializer = CourseSerializer(basic_courses, many=True)
            return Response({
                "courses": serializer.data,
                "message": "Here are some starter courses to begin your journey:"
            })

        except Exception as e:
            logger.critical(f"Basic recommendations failed: {str(e)}")
            return Response(
                {"error": "System temporarily unavailable. Please try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

    def calculate_path_weights(self, responses):
        """Calculate weights for different learning paths based on user responses."""
        path_weights = defaultdict(int)
        try:
            for response in responses:
                answer = response.answer
                try:
                    if response.question.type == 'budget_allocation' and isinstance(answer, str):
                        answer = json.loads(answer)
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON answer for question {response.question.id}")
                    continue

                if response.question.id == 1:
                    if isinstance(answer, str):
                        self.handle_risk_question(answer.lower().strip(), path_weights)

                elif response.question.id == 3:
                    if isinstance(answer, str):
                        answer = [a.strip().lower() for a in answer.split(',')]
                    self.handle_investment_question(answer, path_weights)

                elif response.question.id == 4:
                    self.handle_budget_question(answer, path_weights)

        except Exception as e:
            logger.error(f"Error calculating path weights: {str(e)}", exc_info=True)

        return path_weights

    def handle_risk_question(self, answer, weights):
        """Adjust path weights based on the user's risk tolerance."""
        risk_map = {
            'very uncomfortable': 0,
            'uncomfortable': 1,
            'neutral': 2,
            'comfortable': 3,
            'very comfortable': 4
        }
        normalized_answer = answer.lower().strip()
        score = risk_map.get(normalized_answer, 0)
        weights['Investing'] += score * 2
        weights['Cryptocurrency'] += score * 1.5

    def handle_investment_question(self, answer, weights):
        """Adjust path weights based on the user's investment preferences."""
        investment_map = {
            'real estate': 'Real Estate',
            'crypto': 'Cryptocurrency',
            'cryptocurrency': 'Cryptocurrency',
            'stocks': 'Investing',
            'stock market': 'Investing'
        }

        if isinstance(answer, str):
            answer = [a.strip().lower() for a in answer.split(',')]

        for selection in answer:
            normalized = selection.strip().lower()
            path = investment_map.get(normalized)
            if path:
                weights[path] += 3 if path == 'Real Estate' else 2

    def handle_budget_question(self, answer, weights):
        """Adjust path weights based on the user's budget allocation."""
        try:
            if isinstance(answer, str):
                allocation = json.loads(answer)
            else:
                allocation = answer

            allocation = {k.lower().strip(): v for k, v in allocation.items()}

            stock_weight = float(allocation.get('stocks', 0)) * 0.8
            real_estate_weight = float(allocation.get('real estate', 0)) * 0.8
            crypto_weight = float(allocation.get('crypto', 0)) * 1.2

            if stock_weight > 0:
                weights['Investing'] += stock_weight
            if real_estate_weight > 0:
                weights['Real Estate'] += real_estate_weight
            if crypto_weight > 0:
                weights['Cryptocurrency'] += crypto_weight

        except Exception as e:
            logger.error(f"Budget handling error: {str(e)}")

    def get_recommended_courses(self, sorted_paths):
        """Retrieve recommended courses based on the top weighted paths."""
        recommended_courses = []
        try:

            for path_name, _ in sorted_paths[:3]:
                courses = Course.objects.filter(
                    path__title__iexact=path_name,
                    is_active=True
                ).order_by('order')[:2]
                recommended_courses.extend(courses)

            if len(recommended_courses) < 10:
                additional = Course.objects.filter(
                    is_active=True
                ).exclude(id__in=[c.id for c in recommended_courses]
                ).order_by('-popularity')[:10-len(recommended_courses)]
                recommended_courses.extend(additional)

            return recommended_courses[:10]

        except Exception as e:
            logger.error(f"Course fetch error: {str(e)}")
            return Course.objects.filter(is_active=True).order_by('?')[:10]

class EnhancedQuestionnaireView(APIView):
    """API view to handle the enhanced questionnaire functionality, including fetching questions, submitting answers, and generating personalized paths."""

    def post(self, request):
        """Handle POST requests to submit questionnaire answers and initiate payment for personalized paths."""
        try:
            user = request.user

            # Prevent duplicate payments
            if user.profile.has_paid:
                return Response(
                    {"error": "You already have an active subscription"},
                    status=400
                )

            answers = request.data.get('answers', {})

            if not answers:
                return Response({"error": "No answers provided"}, status=400)

            with transaction.atomic():
                for qid, answer in answers.items():
                    try:
                        question = Question.objects.get(id=qid)
                        # Validate budget allocation sum
                        if question.type == 'budget_allocation':
                            total = sum(int(v) for v in answer.values())
                            if total != 100:
                                return Response(
                                    {"error": "Budget allocation must total 100%"},
                                    status=400
                                )

                        UserResponse.objects.update_or_create(
                            user=user,
                            question=question,
                            defaults={'answer': answer}
                        )
                    except Question.DoesNotExist:
                        logger.error(f"Question {qid} not found")
                        continue

                user_profile = user.profile
                user_profile.recommended_courses = []
                user_profile.save()

            # Configure Stripe with your API key
            stripe.api_key = settings.STRIPE_SECRET_KEY

            # Create Stripe Checkout Session
            checkout_session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price': 'price_1R9sQlBi8QnQXyou7cLlu0wF',
                    'quantity': 1,
                }],
                mode='payment',
                success_url=f'{settings.FRONTEND_URL}/#/personalized-path?session_id={{CHECKOUT_SESSION_ID}}',
                cancel_url=f'{settings.FRONTEND_URL}/#/questionnaire',
                metadata={'user_id': str(request.user.id)},
                client_reference_id=str(request.user.id)
            )

            return Response({
                "success": True,
                "redirect_url": checkout_session.url
            }, status=200)

        except Exception as e:
            logger.error(f"Stripe error: {str(e)}")
            return Response({"error": "Payment processing failed"}, status=500)

    def validate_budget_allocation(self, allocation):
        """Validate that the budget allocation percentages sum up to 100%."""
        total = sum(int(value) for value in allocation.values())
        return total == 100

    def generate_personalized_path(self, user, request):
        """Generate a personalized learning path for the user based on their questionnaire responses."""
        responses = UserResponse.objects.filter(user=user)
        path_weights = {
            'Basic Finance': 0,
            'Investing': 0,
            'Real Estate': 0,
            'Cryptocurrency': 0,
            'Advanced Strategies': 0
        }

        for response in responses:
            if response.question.id == 1:
                risk_score = ['Very Uncomfortable', 'Uncomfortable', 'Neutral',
                            'Comfortable', 'Very Comfortable'].index(response.answer)
                path_weights['Investing'] += risk_score * 2
                path_weights['Cryptocurrency'] += risk_score * 1.5

            elif response.question.id == 3:
                selected_options = response.answer
                if 'Real Estate' in selected_options:
                    path_weights['Real Estate'] += 3
                if 'Cryptocurrency' in selected_options:
                    path_weights['Cryptocurrency'] += 4
                if 'Stocks' in selected_options:
                    path_weights['Investing'] += 2

            elif response.question.id == 4:
                allocation = response.answer
                path_weights['Investing'] += int(allocation.get('Stocks', 0)) * 0.5
                path_weights['Real Estate'] += int(allocation.get('Real Estate', 0)) * 0.8
                path_weights['Cryptocurrency'] += int(allocation.get('Crypto', 0)) * 1.2

        sorted_paths = sorted(
            path_weights.items(),
            key=lambda x: x[1],
            reverse=True
        )[:3]

        recommended_courses = []
        for path_name, _ in sorted_paths:
            courses = Course.objects.filter(
                path__title=path_name
            ).order_by('order')[:2]
            recommended_courses.extend(courses)

        return {
            "recommended_paths": sorted_paths,
            "courses": CourseSerializer(
                recommended_courses,
                many=True,
                context={'request': request}
            ).data
        }

class StripeWebhookView(APIView):
    """Handle Stripe webhook events, specifically for processing completed checkout sessions."""

    permission_classes = [AllowAny]

    def post(self, request):
        """Process Stripe webhook payloads and update user payment status."""
        payload = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')

        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )

            if event['type'] == 'checkout.session.completed':
                session = event['data']['object']
                user_id = session['client_reference_id']

                with transaction.atomic():
                    user_profile = UserProfile.objects.select_for_update().get(user__id=user_id)
                    if not user_profile.has_paid:
                        user_profile.has_paid = True
                        user_profile.stripe_payment_id = session.payment_intent
                        user_profile.save(update_fields=['has_paid', 'stripe_payment_id'])

                        cache.delete_many([
                            f'user_payment_status_{user_id}',
                            f'user_profile_{user_id}'
                        ])

        except Exception as e:
            logger.error(f"Webhook error: {str(e)}")

        return HttpResponse(status=200)


class VerifySessionView(APIView):
    """Verify the payment status of a Stripe checkout session."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Check the payment status of a session and update the user's profile if paid."""
        try:
            session_id = request.data.get('session_id')
            if not session_id or not session_id.startswith('cs_'):
                return Response({"error": "Invalid session ID format"}, status=400)

            stripe.api_key = settings.STRIPE_SECRET_KEY
            session = stripe.checkout.Session.retrieve(
                session_id,
                expand=['payment_intent']
            )

            if session.payment_status == 'paid':
                with transaction.atomic():
                    profile = UserProfile.objects.select_for_update().get(user=request.user)
                    profile.has_paid = True
                    profile.stripe_payment_id = session.payment_intent.id
                    profile.save(update_fields=['has_paid', 'stripe_payment_id'])
                    cache.set(f'user_payment_status_{request.user.id}', 'paid', 300)
                    return Response({"status": "verified"})

            return Response({"status": "pending"}, status=202)
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error: {str(e)}")
            return Response({"error": "Payment verification failed"}, status=400)
        except Exception as e:
            logger.error(f"Verification error: {str(e)}")
            return Response({"error": "Server error"}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_exercise_progress(request, exercise_id):
    """Retrieve the progress of a specific exercise for the authenticated user."""
    try:
        lesson = Lesson.objects.get(id=exercise_id)
        user_progress = UserProgress.objects.filter(user=request.user, course=lesson.course).first()

        if user_progress:
            return Response({
                "completed": lesson in user_progress.completed_lessons.all(),
                "answers": {}
            })
        else:
            return Response({"completed": False, "answers": {}})
    except Lesson.DoesNotExist:
        return Response({"error": "Exercise not found."}, status=404)


class RecentActivityView(APIView):
    """API view to retrieve the user's recent activities, including completed lessons, quizzes, missions, and courses."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Handle GET requests to fetch and return the user's most recent activities."""
        user = request.user
        activities = []

        # Fetch completed lessons and add them to the activity list
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

        # Fetch completed quizzes and add them to the activity list
        quiz_completions = QuizCompletion.objects.filter(user=user).select_related('quiz')
        for qc in quiz_completions:
            activities.append({
                "type": "quiz",
                "action": "completed",
                "title": qc.quiz.title,
                "timestamp": qc.completed_at
            })

        # Fetch completed missions and add them to the activity list
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

        # Fetch completed courses and add them to the activity list
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

        # Sort activities by timestamp in descending order and limit to the 5 most recent
        sorted_activities = sorted(
            activities,
            key=lambda x: x["timestamp"],
            reverse=True
        )[:5]

        return Response({"recent_activities": sorted_activities})


class RewardViewSet(viewsets.ModelViewSet):
    """ViewSet to manage rewards, including retrieving active rewards for shopping or donation."""

    serializer_class = RewardSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Retrieve rewards filtered by type (shop or donate) if specified."""
        reward_type = self.kwargs.get('type', None)
        queryset = Reward.objects.filter(is_active=True)

        if reward_type in ['shop', 'donate']:
            queryset = queryset.filter(type=reward_type)

        return queryset


class UserPurchaseViewSet(viewsets.ModelViewSet):
    """ViewSet to manage user purchases, including listing and creating transactions."""

    serializer_class = UserPurchaseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Retrieve all purchases made by the authenticated user."""
        return UserPurchase.objects.filter(user=self.request.user)

    def create(self, request):
        """Handle POST requests to process a reward purchase for the user."""
        try:
            reward_id = request.data.get('reward_id')
            if not reward_id:
                return Response({"error": "Missing reward_id"}, status=400)

            user_profile = request.user.profile
            reward = Reward.objects.get(id=reward_id, is_active=True)

            # Check if the user has sufficient funds to purchase the reward
            if user_profile.earned_money < reward.cost:
                return Response({"error": "Insufficient funds"}, status=400)

            # Deduct the reward cost from the user's balance and save the purchase
            user_profile.earned_money -= reward.cost
            user_profile.save()

            purchase = UserPurchase.objects.create(
                user=request.user,
                reward=reward
            )

            return Response({
                "message": "Transaction successful!",
                "remaining_balance": float(user_profile.earned_money),
                "purchase": UserPurchaseSerializer(purchase).data
            }, status=201)

        except Reward.DoesNotExist:
            return Response({"error": "Reward not found or inactive"}, status=404)
        except Exception as e:
            logger.error(f"Purchase error: {str(e)}")
            return Response({"error": "Server error processing transaction"}, status=500)


class BadgeViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only ViewSet to retrieve active badges available in the system."""

    queryset = Badge.objects.filter(is_active=True)
    serializer_class = BadgeSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_context(self):
        """Provide additional context for the serializer."""
        return {'request': self.request}


class UserBadgeViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only ViewSet to retrieve badges earned by the authenticated user."""

    serializer_class = UserBadgeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Retrieve all badges associated with the authenticated user."""
        return UserBadge.objects.filter(user=self.request.user)


class ReferralView(APIView):
    """Handle referral functionality, including retrieving referrals and applying referral codes."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Retrieve all referrals made by the authenticated user."""
        try:
            referrals = Referral.objects.filter(referrer=request.user)
            serializer = ReferralSerializer(referrals, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error fetching referrals: {str(e)}")
            return Response({"error": "Error fetching referrals"}, status=500)

    def post(self, request):
        """Apply a referral code to the authenticated user's account."""
        referral_code = request.data.get('referral_code', '').strip().upper()

        if not referral_code:
            return Response({"error": "Referral code is required"}, status=400)

        try:
            referrer_profile = UserProfile.objects.get(referral_code=referral_code)

            if referrer_profile.user == request.user:
                return Response({"error": "You cannot use your own referral code"}, status=400)

            if Referral.objects.filter(referred_user=request.user).exists():
                return Response({"error": "You already used a referral code"}, status=400)

            Referral.objects.create(
                referrer=referrer_profile.user,
                referred_user=request.user
            )

            with transaction.atomic():
                UserProfile.objects.filter(pk=referrer_profile.pk).update(
                    points=F('points') + 100
                )
                UserProfile.objects.filter(user=request.user).update(
                    points=F('points') + 50
                )

            return Response({"message": "Referral applied successfully!"})

        except UserProfile.DoesNotExist:
            return Response({"error": "Invalid referral code"}, status=400)
        except Exception as e:
            logger.error(f"Referral error: {str(e)}")
            return Response({"error": "Server error processing referral"}, status=500)


class UserSearchView(APIView):
    """Handle user search functionality, allowing authenticated users to search for other users."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Search for users by username, excluding the authenticated user."""
        try:
            search_query = request.query_params.get('search', '').strip()

            if not search_query or len(search_query) < 3:
                return Response({"error": "Search query must be at least 3 characters"}, status=400)

            users = User.objects.filter(
                username__icontains=search_query
            ).exclude(id=request.user.id)[:5]

            serializer = UserSearchSerializer(users, many=True)
            return Response(serializer.data)

        except Exception as e:
            logger.error(f"User search error: {str(e)}")
            return Response({"error": "Error processing search"}, status=500)


class FriendRequestView(viewsets.ViewSet):
    """Handle friend request functionality, including sending, accepting, and rejecting requests."""

    permission_classes = [IsAuthenticated]

    def list(self, request):
        """Retrieve all pending friend requests for the authenticated user."""
        requests = FriendRequest.objects.filter(
            receiver=request.user,
            status='pending'
        )
        serializer = FriendRequestSerializer(requests, many=True)
        return Response(serializer.data)

    def create(self, request):
        """Send a friend request to another user."""
        receiver_id = request.data.get("receiver")

        if not receiver_id:
            return Response({"error": "Receiver ID is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            receiver = User.objects.get(id=receiver_id)

            if request.user == receiver:
                return Response({"error": "You cannot send a request to yourself"}, status=status.HTTP_400_BAD_REQUEST)

            existing_request = FriendRequest.objects.filter(sender=request.user, receiver=receiver, status="pending")
            if existing_request.exists():
                return Response({"error": "Friend request already sent"}, status=status.HTTP_400_BAD_REQUEST)

            FriendRequest.objects.create(sender=request.user, receiver=receiver)
            return Response({"message": "Friend request sent successfully"}, status=status.HTTP_201_CREATED)

        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    def update(self, request, pk=None):
        """Accept or reject a friend request."""
        action = request.data.get("action")

        if action not in ["accept", "reject"]:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            friend_request = FriendRequest.objects.get(id=pk, receiver=request.user)

            if action == "accept":
                friend_request.status = "accepted"
                friend_request.save()
                return Response({"message": "Friend request accepted."}, status=status.HTTP_200_OK)

            elif action == "reject":
                friend_request.status = "rejected"
                friend_request.save()
                return Response({"message": "Friend request rejected."}, status=status.HTTP_200_OK)

        except FriendRequest.DoesNotExist:
            return Response({"error": "Friend request not found."}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'])
    def get_sent_requests(self, request):
        """Retrieve all friend requests sent by the authenticated user."""
        requests = FriendRequest.objects.filter(sender=request.user)
        serializer = FriendRequestSerializer(requests, many=True)
        return Response(serializer.data)
        
    @action(detail=False, methods=['get'])
    def get_friends(self, request):
        """Retrieve all accepted friends of the authenticated user."""
        friends_ids = FriendRequest.objects.filter(
            models.Q(sender=request.user, status="accepted") | 
            models.Q(receiver=request.user, status="accepted")
        ).values_list(
            'receiver', 'sender'
        )
        
        # Flatten and remove duplicates
        user_ids = []
        for receiver_id, sender_id in friends_ids:
            if receiver_id != request.user.id:
                user_ids.append(receiver_id)
            if sender_id != request.user.id:
                user_ids.append(sender_id)
                
        friends = User.objects.filter(id__in=user_ids)
        serializer = UserSearchSerializer(friends, many=True)
        return Response(serializer.data)


class FriendsLeaderboardView(APIView):
    """Retrieve a leaderboard of the authenticated user's friends based on their points."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Fetch the top friends of the authenticated user sorted by points."""
        friends = User.objects.filter(
            id__in=FriendRequest.objects.filter(
                sender=request.user, status="accepted"
            ).values_list("receiver_id", flat=True)
        ) | User.objects.filter(
            id__in=FriendRequest.objects.filter(
                receiver=request.user, status="accepted"
            ).values_list("sender_id", flat=True)
        )

        friend_profiles = UserProfile.objects.filter(user__in=friends).order_by("-points")
        serializer = LeaderboardSerializer(friend_profiles, many=True)
        return Response(serializer.data)


class ExerciseViewSet(viewsets.ModelViewSet):
    """Manage exercises, including filtering by type, category, and difficulty."""

    queryset = Exercise.objects.all()
    serializer_class = ExerciseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Exercise.objects.all()
        exercise_type = self.request.query_params.get('type', None)
        category = self.request.query_params.get('category', None)
        difficulty = self.request.query_params.get('difficulty', None)

        if exercise_type:
            queryset = queryset.filter(type=exercise_type)
        if category:
            queryset = queryset.filter(category=category)
        if difficulty:
            queryset = queryset.filter(difficulty=difficulty)

        return queryset

    @action(detail=False, methods=['get'])
    def categories(self, request):
        """Get all unique exercise categories."""
        categories = Exercise.objects.values_list('category', flat=True).distinct()
        return Response(list(categories))

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit an answer for an exercise."""
        exercise = self.get_object()
        user_answer = request.data.get('user_answer')

        if not user_answer:
            return Response(
                {'error': 'User answer is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get or create user progress
        progress, created = UserExerciseProgress.objects.get_or_create(
            user=request.user,
            exercise=exercise
        )

        # Update progress
        progress.attempts += 1
        progress.user_answer = user_answer
        progress.last_attempt = timezone.now()

        # Check if answer is correct
        is_correct = exercise.correct_answer == user_answer
        if is_correct:
            progress.completed = True

        progress.save()

        return Response({
            'correct': is_correct,
            'attempts': progress.attempts,
            'explanation': exercise.explanation if hasattr(exercise, 'explanation') else None
        })


class UserExerciseProgressViewSet(viewsets.ModelViewSet):
    """Manage the progress of exercises completed by the authenticated user."""

    serializer_class = UserExerciseProgressSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Retrieve all exercise progress records for the authenticated user."""
        return UserExerciseProgress.objects.filter(user=self.request.user)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def complete_exercise(request):
    """Handle the completion of an exercise by saving the user's progress and marking the section as completed if the exercise is correct."""
    section_id = request.data.get('section_id')
    exercise_data = request.data.get('exercise_data')

    try:
        section = LessonSection.objects.get(id=section_id)
        exercise, _ = Exercise.objects.get_or_create(
            section=section,
            defaults={
                'type': section.exercise_type,
                'exercise_data': section.exercise_data
            }
        )

        completion, created = ExerciseCompletion.objects.get_or_create(
            user=request.user,
            exercise=exercise,
            section=section,
            defaults={'user_answer': exercise_data}
        )

        if not created:
            completion.attempts += 1
            completion.user_answer = exercise_data
            completion.save()

        # Mark section as completed if exercise is correct
        if exercise_data.get('is_correct', False):
            progress, _ = UserProgress.objects.get_or_create(
                user=request.user,
                course=section.lesson.course
            )
            progress.completed_sections.add(section)

        return Response({"status": "Exercise progress saved", "attempts": completion.attempts})

    except LessonSection.DoesNotExist:
        return Response({"error": "Section not found"}, status=404)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reset_exercise(request):
    exercise_id = request.data.get("exercise_id")
    section_id = request.data.get("section_id")
    
    if not exercise_id and not section_id:
        return Response({"error": "Either exercise_id or section_id is required"}, status=400)

    try:
        if section_id:
            # If section_id is provided, find the exercise through the section
            section = LessonSection.objects.get(id=section_id)
            exercise = Exercise.objects.get(section=section)
            exercise_id = exercise.id

        progress = UserExerciseProgress.objects.get(
            user=request.user, exercise_id=exercise_id
        )
        progress.attempts = 0
        progress.completed = False
        progress.save()
        return Response({"message": "Progress reset successfully."}, status=200)
    except (UserExerciseProgress.DoesNotExist, LessonSection.DoesNotExist, Exercise.DoesNotExist):
        return Response({"error": "No progress found to reset."}, status=404)


class LoginSecureView(APIView):
    """Enhanced login view that uses HttpOnly cookies for refresh tokens and returns access tokens."""
    
    permission_classes = [AllowAny]
    
    def post(self, request):
        """Handle POST requests to authenticate users and issue tokens."""
        username = request.data.get('username')
        password = request.data.get('password')
        # recaptcha_token = request.data.get('recaptcha_token')
        
        logger.info(f"Login attempt for username: {username}")
        logger.info(f"Debug: {settings.DEBUG}, RecaptchaKey: {'set' if settings.RECAPTCHA_PRIVATE_KEY else 'not set'}")
        
        # Only verify reCAPTCHA if in production and token is provided
        # if settings.RECAPTCHA_PRIVATE_KEY and not settings.DEBUG and recaptcha_token:
        #     if not verify_recaptcha(recaptcha_token):
        #         logger.warning(f"reCAPTCHA verification failed for {username}")
        #         return Response({"detail": "reCAPTCHA verification failed."}, status=400)
            
        if not username or not password:
            logger.warning("Login attempt with missing credentials")
            return Response({"detail": "Username and password are required."}, status=400)
        
        try:
            user = User.objects.get(username=username)
            if not user.check_password(password):
                logger.warning(f"Invalid password for {username}")
                return Response({"detail": "Invalid username or password."}, status=401)
                
            # Create tokens
            refresh = RefreshToken.for_user(user)
            access_token = str(refresh.access_token)
            refresh_token = str(refresh)
            
            logger.info(f"Successful login for {username}")
            
            logger.info(f"Generated access token for {username}")
            
            # Create response with access token in body
            response = Response({
                "access": access_token,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name
                }
            })
            
            # Set refresh token as HttpOnly cookie
            logger.info(f"Setting refresh token cookie for {username}")
            
            response.set_cookie(
                'refresh_token', 
                refresh_token, 
                httponly=True, 
                secure=False,  # Set to False for local development
                samesite='Lax',
                max_age=3600 * 24,  # 24 hours
                path="/"  # Use root path to ensure cookie is sent for all requests
            )
            
            # Update last login
            user.last_login = now()
            user.save(update_fields=['last_login'])
            
            return response
            
        except User.DoesNotExist:
            logger.warning(f"Login attempt for non-existent user: {username}")
            return Response({"detail": "Invalid username or password."}, status=401)
        except Exception as e:
            logger.error(f"Login error: {str(e)}")
            return Response({"detail": "An error occurred during login."}, status=500)


class RegisterSecureView(generics.CreateAPIView):
    """Enhanced registration view that uses HttpOnly cookies for refresh tokens."""
    
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Generate tokens
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)

        # Create response with access token
        response = Response({
            "access": access_token,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name
            },
            "next": "/all-topics"  # Redirect to all topics after registration
        }, status=status.HTTP_201_CREATED)

        # Set refresh token in HttpOnly cookie
        response.set_cookie(
            'refresh_token',
            str(refresh),
            httponly=True,
            secure=False,  # Set to False for local development
            samesite='Lax',
            max_age=3600 * 24,  # 24 hours
            path="/"  # Use root path to ensure cookie is sent for all requests
        )

        return response

class VerifyAuthView(APIView):
    """View to verify user authentication status and return user data if authenticated."""
    
    permission_classes = [AllowAny]  # Changed from IsAuthenticated to AllowAny
    
    def get(self, request):
        if request.user.is_authenticated:
            return Response({
                'isAuthenticated': True,
                'user': {
                    'id': request.user.id,
                    'username': request.user.username,
                    'email': request.user.email,
                },
                'access': request.auth.token if request.auth else None
            })
        return Response({
            'isAuthenticated': False,
            'user': None,
            'access': None
        })

class CustomTokenRefreshView(TokenRefreshView):
    """
    Custom token refresh view that extracts the refresh token from cookies
    instead of requiring it in the request body
    """
    permission_classes = [AllowAny]
    
    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get('refresh_token')
        
        if not refresh_token:
            logger.error("No refresh token found in cookies")
            return Response({"detail": "No refresh token found in cookies"}, status=400)
            
        # Include the token in the request data
        request.data['refresh'] = refresh_token
        
        try:
            # Call the parent's post method
            response = super().post(request, *args, **kwargs)
            
            # Get the access token from the response data
            access_token = response.data.get('access')
            
            if access_token:
                logger.info("Token refresh successful")
                
                # If we're using ROTATE_REFRESH_TOKENS, get the new refresh token
                if settings.SIMPLE_JWT.get('ROTATE_REFRESH_TOKENS', False):
                    new_refresh_token = response.data.get('refresh')
                    if new_refresh_token:
                        # Set the new refresh token cookie
                        response.set_cookie(
                            'refresh_token', 
                            new_refresh_token, 
                            httponly=True, 
                            secure=False,
                            samesite='Lax',
                            max_age=3600 * 24,  # 24 hours
                            path="/"  # Use root path to ensure cookie is sent for all requests
                        )
                        logger.info("New refresh token cookie set")
            
            return response
            
        except (InvalidToken, TokenError) as e:
            logger.error(f"Token refresh error: {str(e)}")
            response = Response({"detail": str(e)}, status=401)
            # Clear the invalid refresh token cookie
            response.delete_cookie('refresh_token', path="/")
            return response
        except Exception as e:
            logger.error(f"Unexpected error during token refresh: {str(e)}", exc_info=True)
            return Response({"detail": "An error occurred during token refresh."}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """Allow logged-in users to change their password."""
    user = request.user
    current_password = request.data.get('current_password')
    new_password = request.data.get('new_password')
    confirm_password = request.data.get('confirm_password')

    if not user.check_password(current_password):
        return Response({"error": "Current password is incorrect."}, status=400)

    if new_password != confirm_password:
        return Response({"error": "New passwords do not match."}, status=400)

    if len(new_password) < 8:
        return Response({"error": "Password must be at least 8 characters."}, status=400)

    user.set_password(new_password)
    user.save()
    update_session_auth_hash(request, user)  # Keep the user logged in

    return Response({"message": "Password changed successfully."}, status=200)

@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_account(request):
    """Delete the currently authenticated user's account."""
    user = request.user
    try:
        user.delete()
        return Response({"message": "Account deleted successfully."}, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(["POST"])
@permission_classes([AllowAny])
def contact_us(request):
    """Handle contact form submissions from users"""
    email = request.data.get("email")
    topic = request.data.get("topic", "General")
    message = request.data.get("message")
    user_id = None

    if request.user.is_authenticated:
        user_id = request.user.id

    if not email or not message:
        return Response({"error": "Email and message are required."}, status=400)

    try:
        # Send email to admin
        send_mail(
            subject=f"[Contact Form] {topic}",
            message=f"From: {email}\nUser ID: {user_id or 'Not logged in'}\nTopic: {topic}\n\n{message}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[settings.DEFAULT_FROM_EMAIL],  # Send to admin email
            fail_silently=False,
        )

        # Store contact in database (optional, for future implementation)
        # Contact.objects.create(
        #     email=email,
        #     topic=topic,
        #     message=message,
        #     user_id=user_id
        # )

        return Response({"message": "Your message has been sent successfully. We'll get back to you soon."})
    except Exception as e:
        logger.error(f"Contact form error: {str(e)}")
        return Response({"error": "Failed to send message. Please try again later."}, status=500)

# FAQ list view
class FAQListView(generics.ListAPIView):
    queryset = FAQ.objects.filter(is_active=True).order_by("category", "question")
    serializer_class = FAQSerializer
    permission_classes = [AllowAny]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

# FAQ voting endpoint
@api_view(["POST"])
@permission_classes([AllowAny])
def vote_faq(request, faq_id):
    vote = request.data.get("vote")
    try:
        faq = FAQ.objects.get(id=faq_id)
        user = request.user if request.user.is_authenticated else None
        
        # Check if user has already voted
        existing_feedback = FAQFeedback.objects.filter(faq=faq, user=user).first()
        if existing_feedback:
            # If user is changing their vote
            if existing_feedback.vote != vote:
                if existing_feedback.vote == 'helpful':
                    faq.helpful_count -= 1
                    faq.not_helpful_count += 1
                else:
                    faq.not_helpful_count -= 1
                    faq.helpful_count += 1
                existing_feedback.vote = vote
                existing_feedback.save()
            else:
                return Response({"message": "You have already voted this way"}, status=400)
        else:
            # New vote
            FAQFeedback.objects.create(faq=faq, user=user, vote=vote)
            if vote == "helpful":
                faq.helpful_count += 1
            elif vote == "not_helpful":
                faq.not_helpful_count += 1
            else:
                return Response({"error": "Invalid vote"}, status=400)
        
        faq.save()
        return Response({"message": "Thanks for your feedback!"})
    except FAQ.DoesNotExist:
        return Response({"error": "FAQ not found"}, status=404)

# Contact form submission handler
@api_view(["POST"])
@permission_classes([AllowAny])
def contact_us(request):
    email = request.data.get("email")
    topic = request.data.get("topic")
    message = request.data.get("message")

    if not email or not message:
        return Response({"error": "Email and message are required."}, status=400)

    # Save to database
    ContactMessage.objects.create(email=email, topic=topic, message=message)

    # Send email notification
    try:
        send_mail(
            f"[Contact Form] {topic}",
            f"From: {email}\n\n{message}",
            settings.DEFAULT_FROM_EMAIL,
            [settings.CONTACT_EMAIL],
        )
    except Exception as e:
        # Log the error but don't fail the request
        print(f"Error sending email: {str(e)}")

    return Response({"message": "Your message has been received!"})

class PortfolioViewSet(viewsets.ModelViewSet):
    serializer_class = PortfolioEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PortfolioEntry.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        portfolio = self.get_queryset()
        total_value = sum(entry.calculate_value() for entry in portfolio)
        total_gain_loss = sum(entry.calculate_gain_loss() for entry in portfolio)
        
        # Calculate allocation by asset type
        allocation = {}
        for entry in portfolio:
            value = entry.calculate_value()
            if entry.asset_type not in allocation:
                allocation[entry.asset_type] = 0
            allocation[entry.asset_type] += value

        return Response({
            'total_value': total_value,
            'total_gain_loss': total_gain_loss,
            'allocation': allocation
        })

class FinancialGoalViewSet(viewsets.ModelViewSet):
    serializer_class = FinancialGoalSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return FinancialGoal.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def add_funds(self, request, pk=None):
        goal = self.get_object()
        amount = Decimal(request.data.get('amount', 0))
        
        if amount <= 0:
            return Response(
                {'error': 'Amount must be greater than 0'},
                status=status.HTTP_400_BAD_REQUEST
            )

        goal.current_amount += amount
        goal.save()

        # Check if goal is completed
        if goal.current_amount >= goal.target_amount:
            # Create a mission completion for goal achievement
            MissionCompletion.objects.create(
                user=request.user,
                mission_type='goal_completion',
                description=f'Completed goal: {goal.goal_name}',
                points=100  # Award points for completing a goal
            )

        return Response(self.get_serializer(goal).data)