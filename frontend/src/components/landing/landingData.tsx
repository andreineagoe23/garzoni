import React from "react";
import {
  Robot,
  Trophy,
  BookHalf,
  LightningCharge,
  GraphUpArrow,
} from "react-bootstrap-icons";
import { useTranslation } from "react-i18next";

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

export const useLandingData = () => {
  const { t } = useTranslation("landing");
  const featureCopy = t("features", { returnObjects: true }) as FeatureCopy[];
  const reviewCopy = t("reviews", { returnObjects: true }) as ReviewCopy[];

  const features = featureCopy.map((feature, index) => ({
    ...feature,
    icon: FEATURE_ICONS[index],
  }));

  return { features, reviews: reviewCopy };
};
