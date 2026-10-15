import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Play,
  Check,
  ListVideo,
  StickyNote,
  Target,
  ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { SceneArtwork } from "@/components/three/scene-provider";
export function Landing() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <Link href="/" aria-label="LearnTrack homepage">
          <Logo />
        </Link>
        <nav>
          <Link href="#how-it-works">The idea</Link>
          <Link href="/login">Sign in</Link>
          <Button asChild>
            <Link href="/signup">
              Get started free
              <ArrowUpRight size={16} />
            </Link>
          </Button>
        </nav>
      </header>
      <main>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <span className="hero-kicker">
              <span />A LEARNING SPACE. A FRESH PERSPECTIVE.
            </span>
            <h1>
              Stop collecting tutorials.
              <br />
              <em>Start completing them.</em>
            </h1>
            <p>
              You’ve saved enough tutorials for a lifetime.
              <br />
              Give the next one a place to become a skill.
            </p>
            <Button asChild>
              <Link href="/signup">
                Start your learning journey
                <ArrowUpRight size={17} />
              </Link>
            </Button>
            <span className="hero-footnote">
              <Check size={13} />
              Free to start. Free to keep going.
            </span>
            <div className="landing-hero-index">
              <span>01 — WATCH</span>
              <span>02 — PRACTICE</span>
              <span>03 — REMEMBER</span>
            </div>
          </div>
          <div className="landing-art">
            <SceneArtwork
              kind="hero"
              interactive
              label="An interactive learning sculpture: books, a video lesson, and orbiting ideas. Drag or use arrow keys to explore."
            />
            <span className="landing-art-label">
              A LITTLE SHIFT IN PERSPECTIVE.
            </span>
          </div>
        </section>
        <div className="landing-manifesto">
          <span>LESS “SAVED FOR LATER.”</span>
          <span className="manifesto-star">✳</span>
          <span>MORE “LOOK WHAT I MADE.”</span>
        </div>
        <section id="how-it-works" className="landing-features">
          <div className="landing-section-heading">
            <span className="eyebrow">A PLACE FOR YOUR NEXT CHAPTER</span>
            <h2>
              Good things come
              <br />
              from <em>following through.</em>
            </h2>
            <p>Everything you need to turn watching into doing.</p>
          </div>
          {[
            {
              icon: ListVideo,
              kind: "code" as const,
              number: "01",
              title: "A path, from a playlist.",
              body: "Bring a YouTube link. Get an ordered learning path, with a clear view of what’s done and what comes next.",
            },
            {
              icon: Play,
              kind: "books" as const,
              number: "02",
              title: "Pick up. Move forward.",
              body: "Keep your place in each video. Resume where you stopped, then decide when a lesson is complete.",
            },
            {
              icon: StickyNote,
              kind: "design" as const,
              number: "03",
              title: "Make the idea yours.",
              body: "Keep notes with the lesson, bookmark a useful moment, and work through a practice checklist.",
            },
            {
              icon: Target,
              kind: "goal" as const,
              number: "04",
              title: "Make a little time.",
              body: "Set an intention you can keep. See your actual learning time, course progress, and days you showed up.",
            },
          ].map((f) => (
            <article key={f.title} className="panel landing-feature">
              <div className="landing-feature-art">
                <SceneArtwork
                  kind={f.kind}
                  label={`A sculptural illustration for ${f.title.toLowerCase()}`}
                />
              </div>
              <div className="landing-feature-copy">
                <span className="tiny-label">
                  {f.number} / <f.icon size={14} />
                </span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            </article>
          ))}
        </section>
        <section className="landing-cta">
          <SceneArtwork
            kind="orbit"
            className="landing-cta-art"
            label="A continuous, intertwined learning sculpture"
          />
          <div>
            <span className="eyebrow">ONE GOOD PLACE TO BEGIN</span>
            <h2>
              Your next skill
              <br />
              is <em>worth the time.</em>
            </h2>
            <p>Start with one course. See where it takes you.</p>
            <Button asChild>
              <Link href="/signup">
                Get started free
                <ArrowUpRight size={17} />
              </Link>
            </Button>
            <span className="landing-privacy">
              <ShieldCheck size={14} />
              Your notes. Your progress. Your space.
            </span>
          </div>
        </section>
      </main>
      <footer>
        <Logo />
        <span>A DAILY PRACTICE. A DIFFERENT PERSPECTIVE.</span>
        <Link href="/login">
          Back to your learning
          <ArrowRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
