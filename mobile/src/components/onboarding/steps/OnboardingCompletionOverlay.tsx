import TransitionScreen from "../../common/TransitionScreen";

type Props = {
  xp: number;
  coins: number;
  onContinue: () => void;
};

export default function OnboardingCompletionOverlay({
  xp,
  coins,
  onContinue,
}: Props) {
  return (
    <TransitionScreen
      variant="onboarding"
      xp={xp}
      coins={coins}
      onComplete={onContinue}
    />
  );
}
