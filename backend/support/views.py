# support/views.py
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.db.models import F, Case, When, Value, IntegerField
import logging
import os
import re
import requests
import hashlib
import json
import time

from support.models import FAQ, FAQFeedback, ContactMessage
from support.serializers import FAQSerializer
from authentication.models import UserProfile
from authentication.entitlements import check_and_consume_entitlement
from education.models import Path, UserProgress
from support.tasks import send_contact_email
from support.throttles import ContactRateThrottle, OpenRouterPlanRateThrottle
from core.http_client import request_with_backoff

logger = logging.getLogger(__name__)


class FAQListView(generics.ListAPIView):
    queryset = FAQ.objects.filter(is_active=True).order_by("category", "question")
    serializer_class = FAQSerializer
    permission_classes = [AllowAny]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


@api_view(["POST"])
@permission_classes([AllowAny])
def vote_faq(request, faq_id):
    """Handle voting on FAQ helpfulness."""
    request_id = getattr(request, "request_id", None)
    vote = request.data.get("vote")
    if vote not in {"helpful", "not_helpful"}:
        return Response({"error": "Invalid vote", "request_id": request_id}, status=400)
    try:
        user = request.user if request.user.is_authenticated else None

        # Anonymous votes: update counters atomically, but do not store per-user feedback.
        if user is None:
            if vote == "helpful":
                updated = FAQ.objects.filter(id=faq_id).update(helpful_count=F("helpful_count") + 1)
            else:
                updated = FAQ.objects.filter(id=faq_id).update(not_helpful_count=F("not_helpful_count") + 1)

            if updated == 0:
                return Response({"error": "FAQ not found", "request_id": request_id}, status=404)
            return Response({"message": "Thanks for your feedback!"})

        with transaction.atomic():
            faq = FAQ.objects.select_for_update().get(id=faq_id)

            existing_feedback = (
                FAQFeedback.objects.select_for_update()
                .filter(faq=faq, user=user)
                .first()
            )

            if existing_feedback:
                if existing_feedback.vote == vote:
                    return Response({"message": "You have already voted this way"}, status=400)

                # Switching vote: decrement previous bucket (clamped at 0), increment new bucket.
                if existing_feedback.vote == "helpful" and vote == "not_helpful":
                    FAQ.objects.filter(id=faq_id).update(
                        helpful_count=Case(
                            When(helpful_count__gt=0, then=F("helpful_count") - 1),
                            default=Value(0),
                            output_field=IntegerField(),
                        ),
                        not_helpful_count=F("not_helpful_count") + 1,
                    )
                elif existing_feedback.vote == "not_helpful" and vote == "helpful":
                    FAQ.objects.filter(id=faq_id).update(
                        not_helpful_count=Case(
                            When(not_helpful_count__gt=0, then=F("not_helpful_count") - 1),
                            default=Value(0),
                            output_field=IntegerField(),
                        ),
                        helpful_count=F("helpful_count") + 1,
                    )

                existing_feedback.vote = vote
                existing_feedback.save(update_fields=["vote"])
                return Response({"message": "Thanks for your feedback!"})

            # New vote: create feedback + increment the correct counter atomically.
            FAQFeedback.objects.create(faq=faq, user=user, vote=vote)
            if vote == "helpful":
                FAQ.objects.filter(id=faq_id).update(helpful_count=F("helpful_count") + 1)
            else:
                FAQ.objects.filter(id=faq_id).update(not_helpful_count=F("not_helpful_count") + 1)

            return Response({"message": "Thanks for your feedback!"})
    except FAQ.DoesNotExist:
        return Response({"error": "FAQ not found", "request_id": request_id}, status=404)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([ContactRateThrottle])
def contact_us(request):
    """Handle contact form submissions from users"""
    email = request.data.get("email")
    topic = request.data.get("topic", "General")
    message = request.data.get("message")

    if not email or not message:
        return Response({"error": "Email and message are required."}, status=400)

    # Dedupe bursts: (email + topic + message hash + minute bucket)
    minute_bucket = int(time.time() // 60)
    dedupe_hash = hashlib.sha256(
        f"{email}|{topic}|{hashlib.sha256(message.encode('utf-8')).hexdigest()}|{minute_bucket}".encode(
            "utf-8"
        )
    ).hexdigest()
    dedupe_key = f"contact:dedupe:{dedupe_hash}"
    if not cache.add(dedupe_key, 1, timeout=120):
        return Response({"message": "Your message has been received!"}, status=202)

    # Save to database (only once per dedupe window)
    ContactMessage.objects.create(email=email, topic=topic, message=message)

    # Send email notification asynchronously (never silently drop)
    try:
        send_contact_email.delay(email=email, topic=topic, message=message)
    except Exception as e:
        request_id = getattr(request, "request_id", None)
        logger.error(
            "contact_email_queue_failed request_id=%s err=%s",
            request_id,
            str(e),
        )
        return Response(
            {
                "error": "We couldn't queue your message right now. Please try again.",
                "request_id": request_id,
            },
            status=503,
        )

    return Response({"message": "Your message has been received!"}, status=202)


class OpenRouterProxyView(APIView):
    """Proxy view for OpenRouter AI chatbot integration."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [OpenRouterPlanRateThrottle]

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
            paths = Path.objects.all().values('title', 'id')
            self.path_links = {p['title'].lower(): f"/all-topics#{p['id']}" for p in paths}
            return [p['title'] for p in paths]
        except Exception as e:
            logger.error(f"Error retrieving learning paths: {str(e)}")
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
            profile = UserProfile.objects.get(user=user)
            
            if hasattr(profile, 'experience_level'):
                if profile.experience_level == 'beginner':
                    return "Based on your profile, I recommend starting with our Basic Finance path to build a solid foundation."
                elif profile.experience_level == 'intermediate':
                    return "With your intermediate knowledge, our Investing path would be a great next step to grow your wealth."
                else:
                    return "Given your advanced experience, exploring our Real Estate or Cryptocurrency paths could provide valuable insights."
            
            return f"I recommend starting with our Basic Finance path to build a strong foundation. We also offer paths in {self.format_paths_for_message()}."
            
        except Exception as e:
            logger.error(f"Error generating recommendation: {str(e)}")
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
        request_id = getattr(request, "request_id", None)

        # Prevent abuse via huge payloads.
        if len(prompt) > settings.OPENROUTER_MAX_PROMPT_CHARS:
            return Response(
                {
                    "error": "Prompt is too long.",
                    "max_chars": settings.OPENROUTER_MAX_PROMPT_CHARS,
                    "request_id": request_id,
                },
                status=413,
            )

        # Validate chat history structure.
        if chat_history and not isinstance(chat_history, list):
            return Response({"error": "Invalid chatHistory.", "request_id": request_id}, status=400)
        if isinstance(chat_history, list) and len(chat_history) > settings.OPENROUTER_MAX_MESSAGES:
            chat_history = chat_history[-settings.OPENROUTER_MAX_MESSAGES :]
        
        if not prompt:
            return Response({"error": "Prompt is required."}, status=400)

        # Idempotency: if the client supplies a key, we ensure repeat submissions don't double-spend.
        idempotency_key = (
            request.headers.get("Idempotency-Key")
            or request.headers.get("X-Idempotency-Key")
            or request.data.get("idempotency_key")
        )
        if idempotency_key is not None:
            idempotency_key = str(idempotency_key).strip()
            if not idempotency_key or len(idempotency_key) > 128:
                return Response(
                    {"error": "Invalid Idempotency-Key.", "request_id": request_id},
                    status=400,
                )

        idem_cache_key = None
        idem_lock_key = None
        if idempotency_key:
            idem_cache_key = f"openrouter:idem:{request.user.id}:{idempotency_key}"
            cached_idem = cache.get(idem_cache_key)
            if cached_idem:
                return Response(cached_idem)

            # Lock early to prevent duplicate spend (including entitlement consumption).
            idem_lock_key = f"{idem_cache_key}:lock"
            if not cache.add(idem_lock_key, 1, timeout=settings.OPENROUTER_IDEMPOTENCY_TTL_SECONDS):
                cached_idem = cache.get(idem_cache_key)
                if cached_idem:
                    return Response(cached_idem)
                return Response(
                    {"error": "Request already in progress.", "request_id": request_id},
                    status=409,
                )

        # Optional caching (disabled by default). Cache is per-user because prompt includes user context.
        cache_ttl = int(getattr(settings, "OPENROUTER_CACHE_TTL_SECONDS", 0) or 0)
        if settings.DEBUG and cache_ttl <= 0:
            cache_ttl = 300
        cache_key = None

        try:
            allowed, entitlement_meta = check_and_consume_entitlement(request.user, "ai_tutor")
            if not allowed:
                status_code = status.HTTP_402_PAYMENT_REQUIRED if entitlement_meta.get("reason") == "upgrade" else status.HTTP_429_TOO_MANY_REQUESTS
                return Response(
                    {
                        "error": entitlement_meta.get("error", "AI tutor is not available for your plan."),
                        **entitlement_meta,
                    },
                    status=status_code,
                )

            if not hasattr(self, 'path_links'):
                self.get_available_paths()
                
            if self.is_greeting(prompt):
                return Response({
                    "response": "Hi! I'm your financial assistant. What would you like to learn about today?"
                })
                
            if self.is_reset_query(prompt):
                return Response({
                    "response": "I've reset our conversation. What financial topic would you like to discuss now?"
                })

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
                        for path in self.get_available_paths()[:2]
                    ]
                })

            is_finance_query = self.is_finance_related(prompt.lower())
            if is_finance_query:
                prompt = self.add_financial_context(prompt)

            user = request.user
            user_context = self.get_user_context(user)
            if user_context:
                prompt = f"{user_context}\n\n{prompt}"

            headers = {
                "Authorization": f"Bearer {os.environ.get('OPENROUTER_API_KEY', '')}",
                "HTTP-Referer": "https://monevo.com",
                "X-Title": "Monevo Financial Assistant",
                "Content-Type": "application/json",
            }

            if not headers.get("Authorization") or headers["Authorization"].endswith(" "):
                logger.error("OPENROUTER_API_KEY is not configured.")
                return Response({"error": "AI service unavailable."}, status=503)

            messages = []
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
            
            if chat_history and isinstance(chat_history, list) and len(chat_history) > 0:
                # Sanitize incoming messages to avoid huge payloads and invalid structures.
                sanitized = []
                for item in chat_history:
                    if not isinstance(item, dict):
                        continue
                    role = item.get("role")
                    content = item.get("content")
                    if role not in {"user", "assistant", "system"}:
                        continue
                    if not isinstance(content, str):
                        continue
                    content = content.strip()
                    if not content:
                        continue
                    if len(content) > settings.OPENROUTER_MAX_MESSAGE_CHARS:
                        content = content[: settings.OPENROUTER_MAX_MESSAGE_CHARS]
                    sanitized.append({"role": role, "content": content})
                    if len(sanitized) >= settings.OPENROUTER_MAX_MESSAGES:
                        break
                messages.extend(sanitized)
            else:
                if "User:" in prompt and "AI:" in prompt:
                    conversation_parts = []
                    for part in re.split(r'(User:|AI:)', prompt):
                        if part and part not in ["User:", "AI:"]:
                            conversation_parts.append(part.strip())
                    
                    for i, content in enumerate(conversation_parts):
                        role = "user" if i % 2 == 0 else "assistant"
                        messages.append({"role": role, "content": content})
                else:
                    messages.append({"role": "user", "content": prompt})
            
            # Clamp parameters to safe limits.
            requested_model = str(parameters.get("model") or "mistralai/mistral-7b-instruct")
            if requested_model not in settings.OPENROUTER_ALLOWED_MODELS_CSV:
                return Response(
                    {
                        "error": "Model not allowed.",
                        "request_id": request_id,
                    },
                    status=400,
                )

            try:
                max_tokens = int(parameters.get("max_new_tokens", 150))
            except Exception:
                max_tokens = 150
            max_tokens = max(1, min(max_tokens, settings.OPENROUTER_MAX_TOKENS))

            temperature = parameters.get("temperature", 0.7)
            try:
                temperature = float(temperature)
            except Exception:
                temperature = 0.7
            temperature = max(0.0, min(temperature, 1.5))

            api_params = {
                "model": requested_model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }

            if cache_ttl > 0:
                payload_hash = hashlib.sha256(
                    json.dumps(api_params, sort_keys=True, default=str).encode("utf-8")
                ).hexdigest()
                cache_key = f"openrouter:v2:{request.user.id}:{payload_hash}"
                cached = cache.get(cache_key)
                if cached:
                    return Response(cached)
            
            try:
                # Only retry POST if we have idempotency protection.
                result = request_with_backoff(
                    method="POST",
                    url="https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json=api_params,
                    allow_retry=bool(idem_cache_key),
                    max_attempts=3,
                )
                response = result.response
            except requests.Timeout:
                return Response(
                    {"error": "AI service timed out. Please try again.", "request_id": request_id},
                    status=504,
                )
            except requests.RequestException as exc:
                logger.warning(
                    "openrouter_request_failed request_id=%s err=%s",
                    request_id,
                    str(exc),
                )
                return Response({"error": "AI service unavailable.", "request_id": request_id}, status=502)
            
            if response.status_code == 200:
                response_data = response.json()
                if "choices" in response_data and len(response_data["choices"]) > 0:
                    ai_response = response_data["choices"][0]["message"]["content"]
                    cleaned_response = self.clean_response(ai_response, prompt)
                    
                    result = {"response": cleaned_response}
                    
                    for path_name in self.path_links.keys():
                        if path_name in cleaned_response.lower():
                            result["link"] = {
                                "text": f"View {path_name.title()} Path",
                                "path": self.path_links[path_name],
                                "icon": "📚"
                            }
                            break
                    
                    if cache_key and cache_ttl > 0:
                        cache.set(cache_key, result, timeout=cache_ttl)
                    if idem_cache_key:
                        cache.set(idem_cache_key, result, timeout=settings.OPENROUTER_IDEMPOTENCY_TTL_SECONDS)
                        
                    return Response(result)
                else:
                    return Response({"error": "No valid response from the model.", "request_id": request_id}, status=502)
            else:
                logger.warning(
                    "OpenRouter non-200 request_id=%s status=%s body=%s",
                    request_id,
                    response.status_code,
                    response.text[:200],
                )
                return Response({"error": "AI service error.", "request_id": request_id}, status=502)
                
        except Exception as e:
            # Never log raw prompts/bodies; include request_id for correlation.
            logger.error(
                "openrouter_unexpected_error request_id=%s",
                request_id,
                exc_info=True,
            )
            return Response(
                {"error": "Unexpected server error.", "request_id": request_id},
                status=500,
            )
        finally:
            if idem_lock_key:
                cache.delete(idem_lock_key)

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
            parts = prompt.split("User:", 1)
            return financial_context + "User:" + parts[1]
        else:
            return financial_context + prompt
    
    def get_user_context(self, user):
        """Get personalized context for the user."""
        try:
            context_parts = []
            
            try:
                profile = UserProfile.objects.get(user=user)
                if hasattr(profile, 'points'):
                    context_parts.append(f"The user has {profile.points} points in their account.")
                
                user_progress = UserProgress.objects.filter(user=user)
                if user_progress.exists():
                    paths = set()
                    for progress in user_progress:
                        if progress.course and progress.course.path:
                            paths.add(progress.course.path.title)
                    if paths:
                        context_parts.append(f"The user is currently following these learning paths: {', '.join(paths)}.")
                
                completed_lessons = user_progress.filter(is_course_complete=True).count()
                if completed_lessons > 0:
                    context_parts.append(f"The user has completed {completed_lessons} courses.")
                    
                if hasattr(profile, 'experience_level') and profile.experience_level:
                    context_parts.append(f"The user's financial experience level is: {profile.experience_level}.")
            except (UserProfile.DoesNotExist, Exception) as e:
                pass
                
            if context_parts:
                return "User context: " + " ".join(context_parts)
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting user context: {str(e)}")
            return None
    
    def clean_response(self, response_text, original_prompt):
        """Clean up the generated response text."""
        if "User:" in response_text:
            response_text = response_text.split("User:", 1)[0].strip()
        if "Human:" in response_text:
            response_text = response_text.split("Human:", 1)[0].strip()
        
        response_text = response_text.replace("I am a financial assistant.", "")
        response_text = response_text.replace("I am an AI assistant.", "")
        response_text = response_text.replace("As a financial advisor,", "")
        response_text = response_text.replace("As an AI assistant,", "")
        response_text = response_text.replace("As an AI language model,", "")
        
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
                if response_text.startswith(","):
                    response_text = response_text[1:].strip()
                    
        if len(response_text.strip()) < 10:
            return "I don't have enough information to answer that properly. Could you provide more details about your financial question?"
            
        return response_text.strip()

