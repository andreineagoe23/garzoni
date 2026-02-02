type FeedbackChimeOptions = {
  enabled?: boolean;
  correct?: boolean;
};

export const playFeedbackChime = ({
  enabled = true,
  correct = true,
}: FeedbackChimeOptions = {}) => {
  if (!enabled || typeof window === "undefined") return;
  const AudioContextConstructor =
    window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextConstructor) return;

  const audioContext = new AudioContextConstructor();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(correct ? 740 : 330, now);
  oscillator.frequency.exponentialRampToValueAtTime(
    correct ? 880 : 220,
    now + 0.18
  );

  gainNode.gain.setValueAtTime(0.001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.25);

  oscillator.onended = () => {
    audioContext.close();
  };
};
