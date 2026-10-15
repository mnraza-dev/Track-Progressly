"use client";
import { SceneArtwork } from "@/components/three/scene-provider";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  ArrowLeft,
  Mail,
  LockKeyhole,
  User,
  LoaderCircle,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { browserSupabase, isConnected } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/app-shell";
const schema = z.object({
  email: z.union([z.email("Enter a valid email address."), z.literal("")]),
  password: z.string(),
  name: z.string(),
});
type Mode = "login" | "signup" | "forgot-password" | "reset-password";
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", name: "" },
  });
  const signup = mode === "signup";
  const forgot = mode === "forgot-password";
  const reset = mode === "reset-password";
  async function submit(values: z.infer<typeof schema>) {
    setError("");
    setMessage("");
    if (!reset && !values.email) {
      setError("Enter your email address.");
      return;
    }
    if (!isConnected) {
      setError(
        "Account features need Supabase. Connect your project using the setup guide, or explore the local workspace.",
      );
      return;
    }
    if (!forgot && values.password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const db = browserSupabase();
      if (signup) {
        const result = await db.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            data: { display_name: values.name },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (result.error) throw result.error;
        if (result.data.session) {
          router.push("/dashboard");
          router.refresh();
        } else
          setMessage(
            "Check your inbox to confirm your email. Then sign in to start learning.",
          );
      } else if (forgot) {
        const result = await db.auth.resetPasswordForEmail(values.email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        if (result.error) throw result.error;
        setMessage(
          "If an account exists for this email, a password reset link is on its way.",
        );
      } else if (reset) {
        const result = await db.auth.updateUser({ password: values.password });
        if (result.error) throw result.error;
        router.push("/dashboard");
        router.refresh();
      } else {
        const result = await db.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });
        if (result.error) throw result.error;
        router.push("/dashboard");
        router.refresh();
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function google() {
    setError("");
    try {
      const result = await browserSupabase().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (result.error) throw result.error;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Google sign-in is unavailable.",
      );
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-header">
        <Link href="/">
          <Logo />
        </Link>
        <Link href="/" className="text-link">
          Explore LearnTrack
          <ArrowUp />
        </Link>
      </div>
      <div className="auth-layout">
        <section className="auth-story">
          <span className="hero-kicker">
            <Sparkles size={15} />
            FOR YOUR EVER-CURIOUS MIND
          </span>
          <h1>
            Stop collecting.
            <br />
            Start completing<span>.</span>
          </h1>
          <p>
            A calmer home for your courses, your notes,
            <br />
            and the person you’re becoming.
          </p>
          <SceneArtwork
            kind="hero"
            interactive
            className="auth-scene"
            label="An interactive sculpture of books, a video lesson, and an orbit of ideas"
          />
          <span className="auth-story-footer">
            <ShieldCheck size={16} />
            Your learning is personal. Your data stays private.
          </span>
        </section>
        <section className="auth-card">
          <span className="eyebrow">
            {signup ? "A NEW CHAPTER STARTS HERE" : "A LITTLE PROGRESS AWAITS"}
          </span>
          <h2>
            {signup
              ? "Bring your curiosity."
              : forgot
                ? "Let’s get you back in."
                : reset
                  ? "A fresh start."
                  : "Welcome back."}
          </h2>
          <p className="muted">
            {signup
              ? "Create your free account. Make learning a habit."
              : forgot
                ? "We’ll send a link to reset your password."
                : reset
                  ? "Choose a new password for your account."
                  : "Sign in and pick up where you left off."}
          </p>
          {!forgot && !reset && (
            <>
              <Button
                variant="secondary"
                onClick={google}
                className="google-button"
              >
                <span className="google-g">G</span>Continue with Google
              </Button>
              <div className="auth-divider">
                <span>or continue with email</span>
              </div>
            </>
          )}
          <form className="form-stack" onSubmit={form.handleSubmit(submit)}>
            {signup && (
              <label>
                Your name
                <div className="input-with-icon">
                  <User size={17} />
                  <input
                    {...form.register("name")}
                    required
                    placeholder="What should we call you?"
                    autoComplete="name"
                  />
                </div>
              </label>
            )}
            {!reset && (
              <label>
                Email address
                <div className="input-with-icon">
                  <Mail size={17} />
                  <input
                    {...form.register("email")}
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
                {form.formState.errors.email && (
                  <span className="field-error">
                    {form.formState.errors.email.message}
                  </span>
                )}
              </label>
            )}
            {!forgot && (
              <label>
                Password
                <div className="input-with-icon">
                  <LockKeyhole size={17} />
                  <input
                    {...form.register("password")}
                    type="password"
                    placeholder="At least 8 characters"
                    autoComplete={
                      signup || reset ? "new-password" : "current-password"
                    }
                    minLength={8}
                    required
                  />
                </div>
              </label>
            )}
            {mode === "login" && (
              <Link href="/forgot-password" className="forgot-link">
                Forgot password?
              </Link>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={16} /> : null}
              {signup
                ? "Create free account"
                : forgot
                  ? "Send reset link"
                  : reset
                    ? "Save new password"
                    : "Sign in"}
              <ArrowRight size={16} />
            </Button>
          </form>
          {error && (
            <div className="import-error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="success-message" role="status">
              {message}
            </div>
          )}
          <p className="auth-switch">
            {signup ? "Already have an account?" : "New to LearnTrack?"}{" "}
            <Link href={signup ? "/login" : "/signup"}>
              {signup ? "Sign in" : "Create an account"}
            </Link>
          </p>
          {!isConnected && (
            <Link href="/dashboard" className="local-workspace-link">
              Explore the local workspace
              <ArrowRight size={15} />
            </Link>
          )}
          {forgot && (
            <Link href="/login" className="back-link">
              <ArrowLeft size={14} />
              Back to sign in
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}
function ArrowUp() {
  return <ArrowRight size={15} />;
}
