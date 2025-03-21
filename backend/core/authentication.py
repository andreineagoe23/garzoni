from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

class HeaderJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        # Get raw token from Authorization header
        raw_token = self.get_raw_token(request)
        
        if raw_token is None:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
            user = self.get_user(validated_token)
            return (user, validated_token)
        except InvalidToken:
            return None

    def get_raw_token(self, request):
        header = self.get_header(request)
        if header is None:
            return None
            
        return self.get_raw_token_from_header(header)