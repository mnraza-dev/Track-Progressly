"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Keyboard, Command, Play, Bookmark, Sparkles } from "lucide-react";

type ShortcutsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SHORTCUT_GROUPS = [
  {
    title: "Global & Navigation",
    icon: Command,
    shortcuts: [
      { keys: ["⌘", "K"], label: "Quick search courses and notes" },
      { keys: ["["], label: "Toggle sidebar collapse" },
      { keys: ["?"], label: "Open keyboard shortcuts" },
      { keys: ["Esc"], label: "Close active modal or search" },
    ],
  },
  {
    title: "Video Playback",
    icon: Play,
    shortcuts: [
      { keys: ["Space", "or", "K"], label: "Play or pause video" },
      { keys: ["J"], label: "Rewind 10 seconds" },
      { keys: ["L"], label: "Fast-forward 10 seconds" },
      { keys: ["M"], label: "Mute or unmute audio" },
      { keys: ["0 – 9"], label: "Seek to percentage (0% to 90%)" },
    ],
  },
  {
    title: "Study Studio",
    icon: Bookmark,
    shortcuts: [
      { keys: ["N"], label: "Create or focus notes" },
      { keys: ["C"], label: "Switch to video chapters" },
      { keys: ["T"], label: "Launch interactive product tour" },
    ],
  },
];

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="shortcuts-modal-content">
        <DialogHeader>
          <div className="shortcuts-modal-kicker">
            <Keyboard size={18} className="text-primary" />
            <span>POWER LEARNER CONTROLS</span>
          </div>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Navigate, control video playback, and take notes without taking your hands off the keyboard.
          </DialogDescription>
        </DialogHeader>

        <div className="shortcuts-groups-stack">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="shortcuts-group">
              <div className="shortcuts-group-header">
                <group.icon size={14} className="text-muted-foreground" />
                <h4>{group.title}</h4>
              </div>
              <div className="shortcuts-list">
                {group.shortcuts.map((item) => (
                  <div key={item.label} className="shortcut-row">
                    <span className="shortcut-label">{item.label}</span>
                    <div className="shortcut-keys">
                      {item.keys.map((k, i) =>
                        k === "or" ? (
                          <span key={i} className="shortcut-or">
                            or
                          </span>
                        ) : (
                          <kbd key={i} className="shortcut-kbd">
                            {k}
                          </kbd>
                        ),
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="shortcuts-modal-footer">
          <Sparkles size={13} className="text-primary" />
          <span>Press <kbd className="shortcut-kbd">?</kbd> at any time to open this cheat sheet.</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
