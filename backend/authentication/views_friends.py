from rest_framework import status, viewsets, mixins
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.throttling import UserRateThrottle
from django.db import models

from django.contrib.auth.models import User

from authentication.user_display import user_display_dict
from authentication.models import UserProfile, FriendRequest, Referral
from authentication.serializers import FriendRequestSerializer, UserSearchSerializer
from authentication.throttles import LoginRateThrottle
from authentication.services.referrals import apply_referral


class FriendRequestView(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Handle friend request functionality, including sending, accepting, and rejecting requests."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [UserRateThrottle]
    serializer_class = FriendRequestSerializer

    def get_queryset(self):
        return FriendRequest.objects.filter(receiver=self.request.user, status="pending")

    def create(self, request):
        """Send a friend request to another user."""
        receiver_id = request.data.get("receiver")

        if not receiver_id:
            return Response(
                {"error": "Receiver ID is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            receiver = User.objects.get(id=receiver_id)

            if request.user == receiver:
                return Response(
                    {"error": "You cannot send a request to yourself"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            existing_request = FriendRequest.objects.filter(
                sender=request.user, receiver=receiver, status="pending"
            )
            if existing_request.exists():
                return Response(
                    {"error": "Friend request already sent"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            FriendRequest.objects.create(sender=request.user, receiver=receiver)
            return Response(
                {"message": "Friend request sent successfully"},
                status=status.HTTP_201_CREATED,
            )

        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    def update(self, request, pk=None):
        """Accept or reject a friend request."""
        action_value = request.data.get("action")

        if action_value not in ["accept", "reject"]:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            friend_request = FriendRequest.objects.get(id=pk, receiver=request.user)

            if action_value == "accept":
                friend_request.status = "accepted"
                friend_request.save()
                return Response({"message": "Friend request accepted."}, status=status.HTTP_200_OK)

            if action_value == "reject":
                friend_request.status = "rejected"
                friend_request.save()
                return Response({"message": "Friend request rejected."}, status=status.HTTP_200_OK)

        except FriendRequest.DoesNotExist:
            return Response(
                {"error": "Friend request not found."}, status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=["get"])
    def get_sent_requests(self, request):
        """Retrieve all friend requests sent by the authenticated user."""
        requests = FriendRequest.objects.filter(sender=request.user)
        serializer = FriendRequestSerializer(requests, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def get_friends(self, request):
        """Retrieve all accepted friends of the authenticated user."""
        friends_ids = FriendRequest.objects.filter(
            models.Q(sender=request.user, status="accepted")
            | models.Q(receiver=request.user, status="accepted")
        ).values_list("receiver", "sender")

        user_ids = []
        for receiver_id, sender_id in friends_ids:
            if receiver_id != request.user.id:
                user_ids.append(receiver_id)
            if sender_id != request.user.id:
                user_ids.append(sender_id)

        friends = User.objects.filter(id__in=user_ids)
        serializer = UserSearchSerializer(friends, many=True)
        return Response(serializer.data)


class ReferralApplyView(APIView):
    """Allow authenticated users to apply a referral code."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [UserRateThrottle]

    def post(self, request):
        referral_code = request.data.get("referral_code")

        if not referral_code:
            return Response({"message": "Referral code is required."}, status=400)

        try:
            referrer_profile = UserProfile.objects.get(referral_code=referral_code)
        except UserProfile.DoesNotExist:
            return Response({"message": "Invalid referral code."}, status=404)

        if referrer_profile.user_id == request.user.id:
            return Response({"message": "You cannot refer yourself."}, status=400)

        if Referral.objects.filter(referred_user=request.user).exists():
            return Response({"message": "Referral already applied."}, status=400)

        apply_referral(referrer_profile, request.user)

        return Response({"message": "Referral applied successfully"}, status=200)


class FriendsLeaderboardView(APIView):
    """Retrieve a leaderboard of the authenticated user's friends based on their points."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [UserRateThrottle]

    def get(self, request):
        """Fetch the top friends of the authenticated user sorted by points."""
        friends = (
            User.objects.filter(
                id__in=FriendRequest.objects.filter(
                    sender=request.user, status="accepted"
                ).values_list("receiver", flat=True)
            )
            .select_related("profile")
            .order_by("-profile__points")[:10]
        )

        leaderboard_data = [
            {
                "user": {
                    **user_display_dict(friend, include_id=True),
                    "profile_avatar": friend.profile.profile_avatar,
                },
                "points": friend.profile.points,
            }
            for friend in friends
        ]

        return Response(leaderboard_data)


class ReferralCodeValidationView(APIView):
    """Allow guests to check whether a referral code exists."""

    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def get(self, request):
        referral_code = (request.query_params.get("code") or "").strip()
        if not referral_code:
            return Response(
                {"valid": False, "message": "Referral code is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_valid = UserProfile.objects.filter(referral_code__iexact=referral_code).exists()
        if not is_valid:
            return Response({"valid": False, "message": "Invalid referral code."}, status=200)

        return Response({"valid": True, "message": "Referral code is valid."}, status=200)
