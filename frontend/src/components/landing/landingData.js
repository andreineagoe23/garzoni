import React from "react";
import {
  Robot,
  Trophy,
  BookHalf,
  LightningCharge,
  GraphUpArrow,
} from "react-bootstrap-icons";

export const features = [
  {
    title: "Bite-sized lessons",
    text: "Learn in 3–7 minutes with clear takeaways you can apply immediately.",
    icon: <BookHalf size={22} />,
    bullets: ["Short, focused topics", "Interactive checks", "Repeat anytime"],
  },
  {
    title: "Gamification & missions",
    text: "Turn progress into momentum with points, streaks, and challenges.",
    icon: <Trophy size={22} />,
    bullets: ["Badges & streaks", "Weekly goals", "Leaderboards"],
  },
  {
    title: "AI finance assistant",
    text: "Ask questions, get explanations, and learn the “why” behind each step.",
    icon: <Robot size={22} />,
    bullets: [
      "Personalized guidance",
      "Explain concepts simply",
      "24/7 support",
    ],
  },
  {
    title: "Smart tools & practice",
    text: "Simulate decisions with calculators and exercises that build confidence.",
    icon: <LightningCharge size={22} />,
    bullets: ["Hands-on exercises", "Scenario practice", "Actionable insights"],
  },
  {
    title: "Track progress",
    text: "See growth over time with clear milestones and next-step nudges.",
    icon: <GraphUpArrow size={22} />,
    bullets: ["Milestones", "Progress snapshots", "Personalized next steps"],
  },
];

export const reviews = [
  {
    id: "amina",
    name: "Amina K.",
    title: "Student",
    quote:
      "I finally understand budgeting without feeling overwhelmed. The lessons are short and the missions keep me consistent.",
  },
  {
    id: "marco",
    name: "Marco R.",
    title: "Early-career professional",
    quote:
      "The AI assistant explains things like a friend. I stopped guessing and started making decisions with confidence.",
  },
  {
    id: "sofia",
    name: "Sofia D.",
    title: "Freelancer",
    quote:
      "The gamified streaks are addictive (in a good way). I’ve learned more in two weeks than months of random videos.",
  },
  {
    id: "daniel",
    name: "Daniel P.",
    title: "New investor",
    quote:
      "I used to procrastinate learning finance. The bite-sized lessons make it easy to show up daily.",
  },
  {
    id: "lina",
    name: "Lina S.",
    title: "Entrepreneur",
    quote:
      "The missions feel like a game, but the results are real. I’m tracking expenses consistently now.",
  },
  {
    id: "noah",
    name: "Noah T.",
    title: "College grad",
    quote:
      "The tools + explanations helped me finally understand interest, debt payoff, and how to prioritize.",
  },
];
