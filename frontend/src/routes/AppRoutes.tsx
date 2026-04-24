import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "components/auth/ProtectedRoute";
import ErrorBoundary from "components/common/ErrorBoundary";
import LegalPageWrapper from "components/legal/LegalPageWrapper";
import Login from "components/auth/Login";
import Register from "components/auth/Register";
import AuthCallback from "components/auth/AuthCallback";
import ForgotPassword from "components/auth/ForgotPassword";
import ResetPassword from "components/auth/ResetPassword";
import ResetPasswordDrfToken from "components/auth/ResetPasswordDrfToken";
import SubscriptionPlans from "components/billing/SubscriptionPlansPage";
import {
  Welcome,
  CoursePage,
  CourseFlowPage,
  Dashboard,
  Profile,
  Settings,
  QuizPage,
  Leaderboards,
  Missions,
  OnboardingQuestionnaire,
  ToolsPage,
  RewardsPage,
  SupportPage,
  FeedbackHubPage,
  ExercisePage,
  UpgradePage,
  SubscriptionManager,
  PaymentSuccessPage,
  PrivacyPolicy,
  CookiePolicy,
  TermsOfService,
  FinancialDisclaimer,
  PricingFunnelDashboard,
  MarketingPage,
} from "routes/lazyPages";

const protectedWithBoundary = (element: React.ReactNode) => (
  <ProtectedRoute>
    <ErrorBoundary>{element}</ErrorBoundary>
  </ProtectedRoute>
);

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route
        path="/privacy-policy"
        element={
          <LegalPageWrapper>
            <PrivacyPolicy />
          </LegalPageWrapper>
        }
      />
      <Route
        path="/cookie-policy"
        element={
          <LegalPageWrapper>
            <CookiePolicy />
          </LegalPageWrapper>
        }
      />
      <Route
        path="/terms-of-service"
        element={
          <LegalPageWrapper>
            <TermsOfService />
          </LegalPageWrapper>
        }
      />
      <Route
        path="/financial-disclaimer"
        element={
          <LegalPageWrapper>
            <FinancialDisclaimer />
          </LegalPageWrapper>
        }
      />
      <Route
        path="/no-financial-advice"
        element={<Navigate to="/financial-disclaimer#no-advice" replace />}
      />
      <Route
        path="/pricing"
        element={<Navigate to="/subscriptions" replace />}
      />
      <Route
        path="/onboarding"
        element={protectedWithBoundary(<OnboardingQuestionnaire />)}
      />
      <Route path="/upgrade" element={<UpgradePage />} />
      <Route
        path="/subscriptions"
        element={
          <ErrorBoundary>
            <SubscriptionPlans />
          </ErrorBoundary>
        }
      />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/all-topics"
        element={protectedWithBoundary(
          <Dashboard key="all-topics" activePage="all-topics" />
        )}
      />
      <Route
        path="/personalized-path"
        element={protectedWithBoundary(
          <Dashboard key="personalized-path" activePage="personalized-path" />
        )}
      />
      <Route path="/payment-required" element={<UpgradePage />} />
      <Route
        path="/payment-success"
        element={protectedWithBoundary(<PaymentSuccessPage />)}
      />
      <Route path="/profile" element={protectedWithBoundary(<Profile />)} />
      <Route path="/settings" element={protectedWithBoundary(<Settings />)} />
      <Route
        path="/billing"
        element={protectedWithBoundary(<SubscriptionManager />)}
      />
      <Route path="/rewards" element={protectedWithBoundary(<RewardsPage />)} />
      <Route
        path="/courses/:pathId"
        element={protectedWithBoundary(<CoursePage />)}
      />
      <Route
        path="/lessons/:courseId/flow"
        element={protectedWithBoundary(<CourseFlowPage />)}
      />
      <Route
        path="/courses/:pathId/lessons/:courseId/flow"
        element={protectedWithBoundary(<CourseFlowPage />)}
      />
      <Route
        path="/quiz/:courseId"
        element={protectedWithBoundary(<QuizPage />)}
      />
      <Route
        path="/leaderboards"
        element={protectedWithBoundary(<Leaderboards />)}
      />
      <Route path="/missions" element={protectedWithBoundary(<Missions />)} />
      <Route
        path="/pricing-dashboard"
        element={protectedWithBoundary(<PricingFunnelDashboard />)}
      />
      <Route path="/tools/*" element={protectedWithBoundary(<ToolsPage />)} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/marketing" element={<MarketingPage />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/password-reset" element={<ResetPasswordDrfToken />} />
      <Route
        path="/password-reset/:uidb64/:token"
        element={<ResetPassword />}
      />
      <Route
        path="/exercises"
        element={protectedWithBoundary(<ExercisePage />)}
      />
      <Route
        path="/exercise/:exerciseId"
        element={protectedWithBoundary(<ExercisePage />)}
      />
      <Route
        path="/support"
        element={
          <ErrorBoundary>
            <SupportPage />
          </ErrorBoundary>
        }
      />
      <Route
        path="/feedback"
        element={protectedWithBoundary(<FeedbackHubPage />)}
      />
    </Routes>
  );
};

export default AppRoutes;
