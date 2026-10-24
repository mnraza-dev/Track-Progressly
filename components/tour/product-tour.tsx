"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useTour } from "./tour-context";
import {
  Play,
  Sparkles,
  Target,
  CheckCircle2,
  RotateCcw,
  Compass,
  BookOpen,
  X,
  ArrowRight,
  ArrowLeft,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ICONS = {
  play: Play,
  sparkles: Sparkles,
  target: Target,
  check: CheckCircle2,
  rotate: RotateCcw,
  compass: Compass,
  book: BookOpen,
};

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export function ProductTour() {
  const {
    isOpen,
    currentStep,
    steps,
    nextStep,
    prevStep,
    goToStep,
    closeTour,
  } = useTour();

  const [rect, setRect] = useState<Rect | null>(null);
  const [targetFound, setTargetFound] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardPosition, setCardPosition] = useState<{
    top: number;
    left: number;
  }>({
    top: 0,
    left: 0,
  });

  const step = steps[currentStep] || steps[0];

  const updatePosition = useCallback(() => {
    if (!isOpen || !step) return;

    let el = document.querySelector(step.target);

    // Fallbacks if target element is hidden (e.g. sidebar collapsed or not present)
    if (!el) {
      if (step.id === "sidebar-nav") {
        el =
          document.querySelector(".topbar") || document.querySelector("header");
      } else if (step.id === "resume-hero") {
        el =
          document.querySelector(".dashboard-hero") ||
          document.querySelector(".page-heading");
      }
    }

    if (el) {
      const b = el.getBoundingClientRect();
      const padding = 8;
      const targetRect: Rect = {
        top: Math.max(0, b.top - padding),
        left: Math.max(0, b.left - padding),
        width: b.width + padding * 2,
        height: b.height + padding * 2,
      };

      setRect(targetRect);
      setTargetFound(true);

      // Scroll into view if out of viewport
      if (b.top < 0 || b.bottom > window.innerHeight) {
        el.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
          block: "center",
        });
      }

      // Compute card position
      const cardEl = cardRef.current;
      const cardWidth = cardEl ? cardEl.offsetWidth : 420;
      const cardHeight = cardEl ? cardEl.offsetHeight : 240;
      const margin = 16;
      const placement = step.placement || "bottom";

      let top = 0;
      let left = 0;

      if (placement === "bottom") {
        top = targetRect.top + targetRect.height + margin;
        left = targetRect.left + targetRect.width / 2 - cardWidth / 2;
      } else if (placement === "top") {
        top = targetRect.top - cardHeight - margin;
        left = targetRect.left + targetRect.width / 2 - cardWidth / 2;
      } else if (placement === "right") {
        top = targetRect.top + targetRect.height / 2 - cardHeight / 2;
        left = targetRect.left + targetRect.width + margin;
      } else if (placement === "left") {
        top = targetRect.top + targetRect.height / 2 - cardHeight / 2;
        left = targetRect.left - cardWidth - margin;
      }

      // Viewport safety boundary clamping
      const viewportPadding = 16;
      left = Math.max(
        viewportPadding,
        Math.min(window.innerWidth - cardWidth - viewportPadding, left),
      );
      top = Math.max(
        viewportPadding,
        Math.min(window.innerHeight - cardHeight - viewportPadding, top),
      );

      // Fallback flip if bottom overflows viewport
      if (
        placement === "bottom" &&
        top + cardHeight > window.innerHeight - viewportPadding
      ) {
        top = Math.max(viewportPadding, targetRect.top - cardHeight - margin);
      }

      setCardPosition({ top, left });
    } else {
      // Element not in DOM, center modal
      setTargetFound(false);
      setRect(null);
      const cardEl = cardRef.current;
      const cardWidth = cardEl ? cardEl.offsetWidth : 420;
      const cardHeight = cardEl ? cardEl.offsetHeight : 240;
      setCardPosition({
        top: Math.max(20, (window.innerHeight - cardHeight) / 2),
        left: Math.max(20, (window.innerWidth - cardWidth) / 2),
      });
    }
  }, [isOpen, step]);

  useEffect(() => {
    if (!isOpen) return;

    const frame = requestAnimationFrame(updatePosition);

    const handleResize = () => updatePosition();
    const handleScroll = () => updatePosition();

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeTour();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        nextStep();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevStep();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, updatePosition, closeTour, nextStep, prevStep]);

  if (!isOpen || !step) return null;

  const IconComponent = step.icon ? ICONS[step.icon] || Sparkles : Sparkles;
  const isLast = currentStep === steps.length - 1;
  const progressPercent = ((currentStep + 1) / steps.length) * 100;

  return (
    <div
      className="product-tour-root"
      role="dialog"
      aria-modal="true"
      aria-label="Product tour"
    >
      {/* Backdrop overlay */}
      <div className="tour-backdrop" onClick={closeTour} />

      {/* Spotlight cutout around the target element */}
      {targetFound && rect && (
        <div
          className="tour-spotlight"
          style={{
            top: `${rect.top}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
          }}
        >
          <span className="tour-spotlight-pulse" />
        </div>
      )}

      {/* Interactive Tour Card */}
      <div
        ref={cardRef}
        className={cn("tour-card", !targetFound && "tour-card-centered")}
        style={{
          top: `${cardPosition.top}px`,
          left: `${cardPosition.left}px`,
        }}
      >
        {/* Top slender progress bar */}
        <div className="tour-card-progress-bar">
          <div
            className="tour-card-progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Card Header */}
        <div className="tour-card-header">
          <div className="tour-badge-row">
            <span className="tour-step-badge">
              STEP {String(currentStep + 1).padStart(2, "0")} OF{" "}
              {String(steps.length).padStart(2, "0")}
            </span>
            <span className="tour-feature-pill">TOUR</span>
          </div>
          <button
            className="tour-close-btn"
            onClick={closeTour}
            aria-label="Exit tour"
            title="Exit tour (Esc)"
          >
            <X size={15} />
          </button>
        </div>

        {/* Card Body */}
        <div className="tour-card-body">
          <div className="tour-icon-box">
            <IconComponent size={20} className="tour-step-icon" />
          </div>
          <div className="tour-copy">
            <h3>{step.title}</h3>
            <p>{step.description}</p>
          </div>
        </div>

        {/* Card Footer with Steps Dots & Buttons */}
        <div className="tour-card-footer">
          <div className="tour-dots" aria-label="Tour navigation dots">
            {steps.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => goToStep(idx)}
                className={cn(
                  "tour-dot",
                  idx === currentStep && "tour-dot-active",
                  idx < currentStep && "tour-dot-passed",
                )}
                aria-label={`Go to step ${idx + 1}`}
                title={`Step ${idx + 1}: ${steps[idx].title}`}
              />
            ))}
          </div>

          <div className="tour-actions">
            <button type="button" className="tour-skip-btn" onClick={closeTour}>
              Skip tour
            </button>

            {currentStep > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="tour-back-btn"
                onClick={prevStep}
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              className="tour-next-btn"
              onClick={nextStep}
            >
              <span>{isLast ? "Done" : "Next"}</span>
              {isLast ? <Check size={14} /> : <ArrowRight size={14} />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
