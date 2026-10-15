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
  Clock3,
  Bookmark,
  Code2,
  CornerDownRight,
} from "lucide-react";
import { Logo } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { SceneArtwork } from "@/components/three/scene-provider";
import { ProductStage } from "@/components/three/product-stage";

export function Landing() {
  return (
    <div className="product-landing">
      <header className="product-nav">
        <Link href="/" aria-label="Progressly homepage">
          <Logo />
        </Link>
        <nav aria-label="Product navigation">
          <a href="#the-method">The method</a>
          <a href="#inside">What’s inside</a>
          <Link href="/login">Sign in</Link>
          <Button asChild>
            <a href="/signup">
              Get started free <ArrowUpRight size={16} />
            </a>
          </Button>
        </nav>
      </header>
      <main>
        <section className="product-hero">
          <div className="product-hero-copy">
            <span className="product-eyebrow">
              <i /> YOUR YOUTUBE LEARNING STUDIO
            </span>
            <h1>
              Stop collecting tutorials.
              <br />
              <em>Start completing.</em>
              <span className="product-title-star" aria-hidden="true">
                ✳
              </span>
            </h1>
            <p>
              You already have the curiosity.
              <br />
              Give it a little structure, a place to practice,
              <br className="desktop-break" /> and a reason to come back
              tomorrow.
            </p>
            <div className="product-hero-actions">
              <Button asChild>
                <Link href="/dashboard">
                  Find your next chapter <ArrowUpRight size={18} />
                </Link>
              </Button>
              <a href="#the-method" className="product-quiet-link">
                Take a look around <ArrowRight size={15} />
              </a>
            </div>
            <span className="product-hero-note">
              <Check size={13} /> Start in your browser. Make it your own.
            </span>
            <div className="product-hero-signoff">
              <span>LESS “SAVED FOR LATER.”</span>
              <span>
                MORE “LOOK WHAT I MADE.” <CornerDownRight size={15} />
              </span>
            </div>
          </div>
          <ProductStage />
        </section>
        <div
          className="product-capability-rail"
          aria-label="Product capabilities"
        >
          <span>BUILT FOR FOLLOWING THROUGH</span>
          {[
            { icon: ListVideo, text: "Your courses" },
            { icon: Play, text: "Your pace" },
            { icon: StickyNote, text: "Your thinking" },
            { icon: Target, text: "Your progress" },
          ].map((item) => (
            <span key={item.text}>
              <item.icon size={18} />
              {item.text}
            </span>
          ))}
        </div>
        <section className="product-method" id="the-method">
          <div className="product-section-title">
            <span className="product-eyebrow">
              01 / A LITTLE STRUCTURE GOES A LONG WAY
            </span>
            <h2>
              A playlist is a start.
              <br />
              <em>A skill is the point.</em>
            </h2>
          </div>
          <p>
            The gap between watching something and knowing it? A little
            practice. A useful note. Picking up where you left off. Progressly
            gives those small things a home.
          </p>
          <div className="product-method-steps">
            {[
              {
                n: "01",
                title: "Bring the curiosity.",
                text: "Paste a YouTube playlist or video. Your next learning path is already out there.",
                icon: ListVideo,
              },
              {
                n: "02",
                title: "Make it a practice.",
                text: "Watch at your pace. Capture a thought. Try the idea for yourself.",
                icon: Code2,
              },
              {
                n: "03",
                title: "See yourself grow.",
                text: "Follow your real learning time, lessons completed, and the habits taking shape.",
                icon: Target,
              },
            ].map((step) => (
              <article key={step.n}>
                <div>
                  <span>{step.n}</span>
                  <step.icon size={22} strokeWidth={1.4} />
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="product-inside" id="inside">
          <div className="product-section-title">
            <span className="product-eyebrow">
              02 / EVERYTHING HAS ITS PLACE
            </span>
            <h2>
              Less scattered.
              <br />
              <em>More connected.</em>
            </h2>
            <p>One workspace for the whole learning process.</p>
          </div>
          <div className="product-bento">
            <article className="product-bento-library">
              <div className="product-feature-top">
                <span>THE LIBRARY</span>
                <ListVideo size={21} />
              </div>
              <h3>
                A home for your
                <br />
                next rabbit hole.
              </h3>
              <p>
                Playlists, single videos, or a course you put together yourself.
                Keep the order, see your progress, and know what’s next.
              </p>
              <div className="product-library-art">
                <SceneArtwork
                  kind="books"
                  label="Sculptural books illustrating your personal learning library"
                />
              </div>
              <Link href="/courses">
                Meet your library <ArrowUpRight size={16} />
              </Link>
            </article>
            <article className="product-bento-notes">
              <div className="product-feature-top">
                <span>THE GOOD BITS</span>
                <StickyNote size={21} />
              </div>
              <h3>
                A note to
                <br />
                <em>future you.</em>
              </h3>
              <div
                className="product-note-sample"
                aria-label="Illustrative lesson note"
              >
                <span>
                  <i /> EXAMPLE LESSON NOTE
                </span>
                <strong>Make the idea yours.</strong>
                <p>
                  Explain the concept in your own words.
                  <br />
                  Then build something small with it.
                </p>
                <div>
                  <Bookmark size={12} /> Saved alongside the lesson
                </div>
              </div>
              <p>
                Timestamped Markdown notes, useful bookmarks, and a place to
                return when an idea needs another look.
              </p>
            </article>
            <article className="product-bento-focus">
              <Clock3 size={25} strokeWidth={1.4} />
              <h3>
                Right where
                <br />
                you left off.
              </h3>
              <p>
                Your last position, saved. Your next session, a little easier to
                start.
              </p>
              <span>
                PRESS PLAY. KEEP GOING. <ArrowUpRight size={15} />
              </span>
            </article>
            <article className="product-bento-practice">
              <div className="product-feature-top">
                <span>MAKE IT STICK</span>
                <Code2 size={21} />
              </div>
              <h3>
                Watching is the start.
                <br />
                Doing is the difference.
              </h3>
              <p>
                Practice tasks live beside each lesson, so a good idea can turn
                into something you made.
              </p>
              <div className="product-practice-example">
                <span>
                  <Check size={13} /> Explain it in your own words
                </span>
                <span>
                  <span className="sample-checkbox" /> Try it without the
                  tutorial
                </span>
              </div>
              <small>EXAMPLE PRACTICE CHECKLIST</small>
            </article>
          </div>
        </section>
        <section className="product-perspective">
          <div className="product-perspective-art">
            <SceneArtwork
              kind="orbit"
              interactive
              label="An intertwined sculpture representing the connections between learning, practice, and progress"
            />
            <span>A DIFFERENT PERSPECTIVE, EVERY DAY.</span>
          </div>
          <div>
            <span className="product-eyebrow">03 / PROGRESS YOU CAN FEEL</span>
            <h2>
              Small efforts.
              <br />
              <em>A bigger picture.</em>
            </h2>
            <p>
              Charts that show your real learning time. Goals that fit your day.
              A 3D timeline that gives your week a new dimension.
            </p>
            <ul>
              <li>
                <Check size={15} /> Learning time from active playback
              </li>
              <li>
                <Check size={15} /> Completion you decide, lesson by lesson
              </li>
              <li>
                <Check size={15} /> Practice tracked alongside watching
              </li>
            </ul>
            <Link href="/analytics" className="product-quiet-link">
              Find your rhythm <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>
        <section className="product-faq">
          <div className="product-section-title">
            <span className="product-eyebrow">A FEW GOOD QUESTIONS</span>
            <h2>
              Before you
              <br />
              <em>make a start.</em>
            </h2>
          </div>
          <div>
            <details>
              <summary>Do I need a YouTube account?</summary>
              <p>
                No. Progressly uses public YouTube videos and playlists. You
                watch through the embedded YouTube player. Private videos and
                videos that cannot be embedded are unavailable.
              </p>
            </details>
            <details>
              <summary>Can I start without setting anything up?</summary>
              <p>
                Yes. The local workspace saves your courses, notes, and goals in
                this browser. You can build courses manually without API
                credentials. YouTube link imports require the server’s YouTube
                API key.
              </p>
            </details>
            <details>
              <summary>Can I take my learning across devices?</summary>
              <p>
                With Supabase configured, you can sign in and save to your
                account. A local workspace stays in the browser where you
                created it and is not automatically copied into a cloud account.
              </p>
            </details>
            <details>
              <summary>Does watching automatically complete a lesson?</summary>
              <p>
                You decide when a lesson is complete. If you prefer, enable
                automatic completion at 90% in Settings. Practice remains
                separate from what you watched.
              </p>
            </details>
          </div>
        </section>
        <section className="product-final">
          <span className="product-eyebrow">ONE GOOD PLACE TO BEGIN</span>
          <h2>
            Your next chapter
            <br />
            <em>starts with you.</em>
            <span aria-hidden="true">↗</span>
          </h2>
          <div>
            <p>
              One link. A little time.
              <br />
              Something you’ll be glad you started.
            </p>
            <Button asChild>
              <a href="/signup">
                Get started free <ArrowUpRight size={18} />
              </a>
            </Button>
          </div>
          <span className="product-final-note">
            <ShieldCheck size={14} /> Your notes. Your progress. Your space.
          </span>
        </section>
      </main>
      <footer className="product-footer">
        <Logo />
        <span>MADE FOR THE EVER-CURIOUS.</span>
        <Link href="/dashboard">
          Back to your learning <ArrowRight size={15} />
        </Link>
      </footer>
    </div>
  );
}
