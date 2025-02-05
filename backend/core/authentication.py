from rest_framework.authentication import BaseAuthentication
from rest_framework_simplejwt.tokens import AccessToken
from django.conf import settings
from django.contrib.auth.models import User
from rest_framework.exceptions import AuthenticationFailed

class CookieJWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        auth_cookie = settings.SIMPLE_JWT.get('AUTH_COOKIE', 'access_token')
        access_token = request.COOKIES.get(auth_cookie)

        print(f"🔍 Extracted JWT Token from Cookie: {access_token}")

        if not access_token:
            print("❌ No Access Token Found in Cookies!")
            return None  

        try:
            validated_token = AccessToken(access_token)
            user = User.objects.get(id=validated_token["user_id"])
            print(f"✅ Successfully Authenticated User: {user.username}")
            return (user, validated_token)
        except User.DoesNotExist:
            print("❌ User Not Found for Token!")
            raise AuthenticationFailed("User not found")
        except Exception as e:
            print(f"❌ JWT Decoding Error: {str(e)}")
            raise AuthenticationFailed("Invalid or expired token")

