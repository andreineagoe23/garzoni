import React from "react";

export const Welcome = React.lazy(() => import("components/landing/Welcome"));
export const CoursePage = React.lazy(
  () => import("components/courses/CoursePage")
);
export const CourseFlowPage = React.lazy(
  () => import("components/courses/CourseFlowPage")
);
export const Dashboard = React.lazy(
  () => import("components/dashboard/Dashboard")
);
export const Navbar = React.lazy(() => import("components/layout/Navbar"));
export const Footer = React.lazy(() => import("components/layout/Footer"));
export const Profile = React.lazy(() => import("components/profile/Profile"));
export const Settings = React.lazy(() => import("components/profile/Settings"));
export const QuizPage = React.lazy(() => import("components/courses/QuizPage"));
export const Leaderboards = React.lazy(
  () => import("components/engagement/Leaderboard")
);
export const Missions = React.lazy(
  () => import("components/engagement/Missions")
);
export const OnboardingQuestionnaire = React.lazy(
  () => import("components/onboarding/OnboardingQuestionnaire")
);
export const ToolsPage = React.lazy(() => import("components/tools/ToolsPage"));
export const RewardsPage = React.lazy(
  () => import("components/rewards/RewardsPage")
);
export const SupportPage = React.lazy(
  () => import("components/support/SupportPage")
);
export const FeedbackHubPage = React.lazy(
  () => import("components/feedback/FeedbackHubPage")
);
export const ExercisePage = React.lazy(
  () => import("components/exercises/ExercisePage")
);
export const UpgradePage = React.lazy(
  () => import("components/billing/Upgrade")
);
export const SubscriptionManager = React.lazy(
  () => import("components/billing/SubscriptionManager")
);
export const PaymentSuccessPage = React.lazy(
  () => import("components/billing/PaymentSuccessPage")
);
export const PrivacyPolicy = React.lazy(
  () => import("components/legal/PrivacyPolicy")
);
export const CookiePolicy = React.lazy(
  () => import("components/legal/CookiePolicy")
);
export const TermsOfService = React.lazy(
  () => import("components/legal/TermsOfService")
);
export const FinancialDisclaimer = React.lazy(
  () => import("components/legal/FinancialDisclaimer")
);
export const PricingFunnelDashboard = React.lazy(
  () => import("components/analytics/PricingFunnelDashboard")
);

/** Optional route warm-up; keep heavy pages (e.g. CourseFlow + CKEditor) out — load on navigation only. */
export const preloaders = [
  () => import("components/dashboard/Dashboard"),
  () => import("components/courses/CoursePage"),
  () => import("components/billing/SubscriptionManager"),
  () => import("components/engagement/Missions"),
  () => import("components/profile/Profile"),
];
