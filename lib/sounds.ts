"use client";
import { useFeedback } from "@/stores/feedback";
export type SoundKind = "xp" | "lesson" | "practice" | "achievement" | "level" | "course" | "focus";
export const SOUND_NOTES: Record<SoundKind, number[]> = {
  xp: [659.25, 783.99], practice: [523.25, 659.25, 783.99], lesson: [523.25, 659.25, 1046.5],
  achievement: [587.33, 739.99, 880, 1174.66], level: [523.25, 659.25, 783.99, 1046.5, 1318.51],
  course: [392, 523.25, 659.25, 783.99, 1046.5, 1567.98], focus: [659.25, 830.61, 987.77],
};
let context: AudioContext | null = null;
let lastPlayed = -Infinity;
const voices = new Set<{ oscillator: OscillatorNode; gain: GainNode }>();
export async function unlockAudio(): Promise<boolean> {
  if (typeof window === "undefined" || !useFeedback.getState().soundEnabled) return false;
  try {
    const Audio = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) return false;
    if (!context || context.state === "closed") context = new Audio();
    if (context.state === "suspended") await context.resume();
    return context.state === "running";
  } catch { return false; }
}
export function stopSounds() {
  for (const voice of voices) {
    try { voice.oscillator.stop(); } catch {}
    voice.oscillator.disconnect(); voice.gain.disconnect();
  }
  voices.clear();
}
/** Plays only after a user gesture, never in a hidden tab or over a video in quiet mode. */
export function playFeedbackSound(kind: SoundKind, preview = false): boolean {
  const settings = useFeedback.getState();
  if (typeof document === "undefined" || document.hidden || !settings.soundEnabled || settings.volume <= 0 || !context || context.state !== "running") return false;
  if (!preview && settings.quietWhilePlaying && settings.videoPlaying) return false;
  if (!preview && context.currentTime - lastPlayed < 0.65) return false;
  lastPlayed = context.currentTime;
  stopSounds();
  try {
    const audio = context;
    SOUND_NOTES[kind].forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime + index * 0.105;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(settings.volume * 0.14, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
      oscillator.connect(gain); gain.connect(audio.destination);
      const voice = { oscillator, gain };
      voices.add(voice);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); voices.delete(voice); };
      oscillator.start(start); oscillator.stop(start + 0.45);
    });
    return true;
  } catch { stopSounds(); return false; }
}
