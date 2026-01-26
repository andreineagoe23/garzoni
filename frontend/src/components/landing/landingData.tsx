import React from "react";
import {
  Robot,
  Trophy,
  BookHalf,
  LightningCharge,
  GraphUpArrow,
} from "react-bootstrap-icons";

type FeatureCopy = {
  title: string;
  text: string;
  bullets: string[];
};

type ReviewCopy = {
  id: string;
  name: string;
  title: string;
  quote: string;
};

const FEATURE_ICONS = [
  <BookHalf key="book" size={22} />,
  <Trophy key="trophy" size={22} />,
  <Robot key="robot" size={22} />,
  <LightningCharge key="bolt" size={22} />,
  <GraphUpArrow key="graph" size={22} />,
];

const FEATURE_DATA: FeatureCopy[] = [
  {
    title: "Comprehensive Learning Paths",
    text: "Structured courses designed to build your financial knowledge from the ground up.",
    bullets: [
      "Step-by-step learning modules",
      "Interactive quizzes and assessments",
      "Progress tracking and certificates",
    ],
  },
  {
    title: "Achievement System",
    text: "Gamified learning experience that keeps you motivated and engaged.",
    bullets: [
      "Earn badges and rewards",
      "Track your learning streak",
      "Compete on leaderboards",
    ],
  },
  {
    title: "AI-Powered Tutor",
    text: "Get personalized guidance and answers to your financial questions.",
    bullets: [
      "24/7 available assistant",
      "Context-aware responses",
      "Learning recommendations",
    ],
  },
  {
    title: "Real-Time Tools",
    text: "Access powerful financial calculators and analysis tools.",
    bullets: [
      "Portfolio analyzer",
      "Savings goal calculator",
      "Currency converter",
    ],
  },
  {
    title: "Market Insights",
    text: "Stay updated with the latest financial news and market trends.",
    bullets: [
      "Economic calendar",
      "Market analysis",
      "News aggregation",
    ],
  },
];

const REVIEW_DATA: ReviewCopy[] = [
  {
    id: "1",
    name: "Sarah Johnson",
    title: "Financial Advisor",
    quote: "Monevo has transformed how I learn about finance. The interactive courses are engaging and practical.",
  },
  {
    id: "2",
    name: "Michael Chen",
    title: "Entrepreneur",
    quote: "The AI tutor is incredibly helpful. It answers my questions instantly and helps me understand complex concepts.",
  },
  {
    id: "3",
    name: "Emily Rodriguez",
    title: "Student",
    quote: "I love the gamification aspect. Earning badges and competing on leaderboards makes learning fun!",
  },
  {
    id: "4",
    name: "David Thompson",
    title: "Investor",
    quote: "The financial tools are top-notch. The portfolio analyzer has been invaluable for my investment decisions.",
  },
  {
    id: "5",
    name: "Lisa Anderson",
    title: "Small Business Owner",
    quote: "Finally, a platform that makes financial education accessible and enjoyable. Highly recommend!",
  },
];

export const useLandingData = () => {
  const features = FEATURE_DATA.map((feature, index) => ({
    ...feature,
    icon: FEATURE_ICONS[index],
  }));

  return { features, reviews: REVIEW_DATA };
};
