import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Check,
  ListVideo,
  StickyNote,
  Target,
  Play,
  ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
export function Landing() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <Logo />
        <nav>
          <Link href="#how-it-works">How it works</Link>
          <Link href="/login">Sign in</Link>
          <Button asChild>
            <Link href="/signup">
              Get started free
              <ArrowRight size={15} />
            </Link>
          </Button>
        </nav>
      </header>
      <main>
        <section className="landing-hero">
          <div>
            <span className="hero-kicker">FOR YOUR EVER-CURIOUS MIND</span>
            <h1>
              Stop collecting tutorials.
              <br />
              Start completing them<span>.</span>
            </h1>
            <p>
              A calmer home for your YouTube courses, notes, and learning goals.
              Turn “saved for later” into skills that stay.
            </p>
            <Button asChild>
              <Link href="/signup">
                Start your learning journey
                <ArrowRight size={16} />
              </Link>
            </Button>
            <span className="hero-footnote">
              <Check size={13} />
              Your pace. Your path. Always free.
            </span>
          </div>
          <Image
            src="/artwork/learning.svg"
            width={600}
            height={333}
            alt="Videos, notes, and steady progress, together in one place"
          />
        </section>
        <section id="how-it-works" className="landing-features">
          <div className="landing-section-heading">
            <span className="eyebrow">
              SMALL STEPS. EXTRAORDINARY PROGRESS.
            </span>
            <h2>
              A little less friction.
              <br />A lot more follow-through.
            </h2>
          </div>
          {[
            {
              icon: ListVideo,
              title: "Bring a link. Find a path.",
              body: "Import an entire YouTube playlist or build your own course. Every lesson stays in order, with progress that’s yours.",
            },
            {
              icon: Play,
              title: "Pick up where you left off.",
              body: "Keep your place in every video. Track what you watched and choose when a lesson is complete.",
            },
            {
              icon: StickyNote,
              title: "Make the knowledge yours.",
              body: "Capture ideas with Markdown notes, timestamp a useful explanation, and put your learning into practice.",
            },
            {
              icon: Target,
              title: "Show up for your future self.",
              body: "Set realistic goals, build a streak, and see your actual learning activity. One small step at a time.",
            },
          ].map((f) => (
            <article key={f.title} className="panel">
              <span className="goal-icon">
                <f.icon size={21} />
              </span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </section>
        <section className="landing-cta">
          <h2>Your next chapter is waiting.</h2>
          <p>Bring your curiosity. We’ll help with the follow-through.</p>
          <Button asChild>
            <Link href="/signup">
              Get started free
              <ArrowRight size={16} />
            </Link>
          </Button>
          <span>
            <ShieldCheck size={14} />
            Private by design. Free by choice.
          </span>
        </section>
      </main>
      <footer>
        <Logo />
        <span>Made for curious minds. Always learning.</span>
      </footer>
    </div>
  );
}
