// Mood math and labels
import type { MoodLabel } from "../shared/types";

/** Convert a numeric mood (-100 to 100) to a public MoodLabel */
export function moodToLabel(mood: number): MoodLabel {
  if (mood <= -60) return "furious";
  if (mood <= -20) return "hostile";
  if (mood <= 19) return "wary";
  if (mood <= 59) return "warm";
  return "devoted";
}

/** Clamp mood to [-100, 100] range */
export function clampMood(mood: number): number {
  return Math.max(-100, Math.min(100, Math.round(mood)));
}

/** Apply a delta to mood, clamping to valid range */
export function applyMoodDelta(current: number, delta: number): number {
  return clampMood(current + delta);
}
