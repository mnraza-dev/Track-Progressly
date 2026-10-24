"use client";
import { useState } from "react";
import { Volume2, VolumeX, Play } from "lucide-react";
import { useFeedback } from "@/stores/feedback";
import { unlockAudio, playFeedbackSound, stopSounds } from "@/lib/sounds";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export function FeedbackControls() {
  const preferences = useFeedback();
  const [status, setStatus] = useState("");
  return (
    <div className="feedback-controls">
      <div className="feedback-control-heading">
        <Volume2 size={20} aria-hidden="true" />
        <div>
          <h3>Make progress feel good.</h3>
          <p>Short, original chimes for milestones. Your choice, always.</p>
        </div>
      </div>
      <div className="feedback-toggle">
        <div>
          <strong>Sound effects</strong>
          <small>Off by default. Applies to rewards and the focus timer.</small>
        </div>
        <Switch
          aria-label="Sound effects"
          checked={preferences.soundEnabled}
          onCheckedChange={(enabled) => {
            preferences.setSoundEnabled(enabled);
            setStatus("");
            if (enabled)
              void unlockAudio().then((ready) => {
                if (!ready)
                  setStatus(
                    "Audio is unavailable in this browser. Visual celebrations still work.",
                  );
              });
            else stopSounds();
          }}
        />
      </div>
      <label className="feedback-volume">
        Volume <span>{Math.round(preferences.volume * 100)}%</span>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          aria-label="Sound effect volume"
          value={Math.round(preferences.volume * 100)}
          onChange={(event) => {
            preferences.setVolume(Number(event.target.value) / 100);
            stopSounds();
          }}
        />
      </label>
      <Button
        variant="outline"
        disabled={!preferences.soundEnabled || preferences.volume === 0}
        onClick={async () => {
          const ready = await unlockAudio();
          setStatus(
            ready && playFeedbackSound("level", true)
              ? "Preview played."
              : "Audio is unavailable. Try allowing audio for this site.",
          );
        }}
      >
        <Play size={15} aria-hidden="true" />
        Preview celebration sound
      </Button>
      <div className="feedback-toggle">
        <div>
          <strong>Quiet while learning</strong>
          <small>Keep milestone sounds out of the way of video playback.</small>
        </div>
        <Switch
          aria-label="Quiet while learning"
          checked={preferences.quietWhilePlaying}
          onCheckedChange={preferences.setQuietWhilePlaying}
        />
      </div>
      <div className="feedback-toggle">
        <div>
          <strong>Celebration effects</strong>
          <small>Confetti follows your reduced-motion preference.</small>
        </div>
        <Switch
          aria-label="Celebration effects"
          checked={preferences.celebrationsEnabled}
          onCheckedChange={preferences.setCelebrationsEnabled}
        />
      </div>
      <p className="feedback-status" role="status">
        {status || (
          <>
            <VolumeX size={13} aria-hidden="true" />
            No sounds on page load. Settings stay on this device.
          </>
        )}
      </p>
    </div>
  );
}
