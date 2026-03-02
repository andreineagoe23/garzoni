import React from "react";
import { useTranslation } from "react-i18next";
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
  icon?: React.ReactNode;
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

const FEATURE_IDS = [
  "learning-paths",
  "achievement-system",
  "ai-tutor",
  "real-time-tools",
  "market-insights",
];

const REVIEW_SEEDS = [
  { id: "sarah", name: "Sarah Johnson" },
  { id: "michael", name: "Michael Chen" },
  { id: "emily", name: "Emily Rodriguez" },
  { id: "david", name: "David Thompson" },
  { id: "lisa", name: "Lisa Anderson" },
];

export const useLandingData = () => {
  const { t } = useTranslation();
  const features: FeatureCopy[] = FEATURE_IDS.map((id, index) => ({
    title: t(`landing.features.items.${id}.title`),
    text: t(`landing.features.items.${id}.text`),
    bullets: [
      t(`landing.features.items.${id}.bullets.0`),
      t(`landing.features.items.${id}.bullets.1`),
      t(`landing.features.items.${id}.bullets.2`),
    ],
    icon: FEATURE_ICONS[index],
  }));

  const reviews: ReviewCopy[] = REVIEW_SEEDS.map((review) => ({
    id: review.id,
    name: review.name,
    title: t(`landing.reviews.items.${review.id}.title`),
    quote: t(`landing.reviews.items.${review.id}.quote`),
  }));

  return { features, reviews };
};
