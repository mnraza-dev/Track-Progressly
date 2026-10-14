# LearnTrack

**Stop collecting tutorials. Start completing them.**

A responsive Next.js 16 application for organizing YouTube courses, tracking lesson progress, saving timestamped Markdown notes, practicing concepts, and building learning habits.

## Run locally

Requirements: Node.js 22+ and Bun 1.4+ (or npm).

```sh
bun install
cp .env.example .env.local
bun run dev
```

Open http://localhost:3000. With no Supabase variables, the application opens an explicitly labeled **local workspace**. Courses, notes, bookmarks, tasks, goals, and preferences persist in this browser using localStorage. There is no seeded or invented course data. Manual course creation works without any API credentials. This mode is for evaluation, not secure multi-user hosting. Local data is not automatically uploaded when cloud mode is configured.

The public product page is also available at `/welcome`. Once Supabase is configured, `/` displays this public homepage and application routes require sign-in.

## Connect Supabase

1. Create a free Supabase project.
2. Run **the entire** `supabase/migrations/001_learntrack.sql` in the Supabase SQL editor, or use `supabase db push` after linking your project. Apply this migration to a new database, once.
3. Copy the project URL and **publishable key** from the project's Connect dialog into `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
YOUTUBE_API_KEY=YOUR_SERVER_ONLY_YOUTUBE_KEY
```

4. Under Authentication → URL Configuration, set the site URL to `http://localhost:3000` and allow these redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/auth/callback?next=/reset-password`
5. Enable email/password authentication. Keep email confirmation enabled for production. Configure an SMTP provider if the built-in test email limits are insufficient.
6. For Google sign-in, enable the Google provider in Supabase and enter your Google OAuth client ID and secret. Register Supabase's displayed callback URL in the Google Cloud OAuth console. OAuth secrets belong in Supabase, never in this application's client bundle.
7. Restart `bun run dev` after changing environment variables.

The application never uses or requires a Supabase service-role key. Server endpoints verify the signed-in user, use the user's session, and remain subject to RLS. Next.js `proxy.ts` refreshes Supabase sessions and protects the application routes.

## Connect YouTube

1. Create a Google Cloud project and enable **YouTube Data API v3**.
2. Create an API key and restrict it to YouTube Data API v3.
3. Put it in the server-only `YOUTUBE_API_KEY` variable. Never prefix it with `NEXT_PUBLIC_`.

Imports accept playlists, videos, their IDs, and common YouTube URL formats. The server follows playlist pagination, batches video metadata requests in groups of 50, preserves order, excludes unavailable lessons from completion calculations, and caches public metadata for ten minutes. Each signed-in user has an atomic database rate limit of ten preview/refresh requests per minute. Concurrent duplicate imports are prevented by database constraints, and imports run in a transaction.

The importer supports up to 5,000 playlist videos. Repeated appearances of the same video are deduplicated in their first playlist position. Private, deleted, or non-embeddable lessons remain marked unavailable; metadata is never fabricated. A refresh retains lesson IDs, notes, bookmarks, tasks, and progress, marks removed videos unavailable, and adds/reorders available entries. Manual creation is always available if the API fails or quota is exhausted.

Player tracking uses the official YouTube IFrame API. Active time is measured while playback is running and the document is visible, saved about every 15 seconds, on pause, and best-effort on departure. It never infers learning time from a video's duration. Manual completion is the default. Automatic completion at 90% requires explicitly enabling it in Settings. Playback, seeking, and final saves depend on browser/YouTube restrictions; external YouTube playback cannot be tracked by this application.

## Architecture

- `app/`: App Router pages, public authentication pages, auth callback, and authenticated route handlers.
- `components/`: reusable Radix/shadcn-style UI primitives, layout, courses, player, notes, dashboard, and Recharts analytics.
- `features/`: authentication/import UI and pure local workspace mutations.
- `lib/`: Supabase SSR clients, YouTube service, Zod validation, formatting and progress utilities.
- `stores/`: lightweight Zustand workspace state; mutations are serialized to avoid stale state and update only after a successful persistence operation.
- `types/`: shared domain contracts.
- `supabase/migrations/`: PostgreSQL tables, indexes, policies, account profile trigger, atomic RPCs, and analytics aggregation.
- `tests/`: Vitest domain and PostgreSQL security tests, plus desktop/mobile Playwright workflows.

### Database relationships

`auth.users → profiles, courses, learning_goals`; `courses → course_videos`; `course_videos → video_progress, video_notes, video_bookmarks, practice_tasks`; `learning_sessions → courses + course_videos`.

All user-owned tables have RLS. Related-record policies verify both `user_id = auth.uid()` **and** ownership of the referenced course/video. Foreign keys cascade course deletion to dependent records. UUID primary keys, course/video uniqueness constraints, recent-activity indexes, and PostgreSQL full-text indexes are included. Atomic SQL functions handle imports, refreshes, and playback/completion updates.

Analytics returns database-aggregated daily rows, rather than every session. Streaks and daily metrics use the profile's IANA timezone. Completion is calculated from available lessons; watching and practice stay separate. Workspace reads paginate database rows in batches of 1,000 to avoid Supabase's default response limit. The MVP currently hydrates the user's complete course/notes library; very large multi-course libraries will benefit from moving detail loading to per-course endpoints. Lesson rendering is progressively paginated in groups of 50.

Markdown uses `react-markdown` with raw HTML disabled. React escapes user text. YouTube IDs and input URLs are strictly validated. Private responses are `private, no-store`. Only public YouTube metadata is cached.

## Checks

```sh
bun run typecheck
bun run lint
bun run test
bunx playwright install chromium
bun run test:e2e
bun run build
```

Vitest covers URL parsing, unavailable metadata, paginated imports, API quota failure, duration parsing, duplicate courses, completion/undo, notes persistence, input validation, and timezone streaks. PGlite runs the actual migration inside a local PostgreSQL engine, with two test users and authenticated roles, to verify RLS and ownership rejection, atomic imports, secure rate limits, notes/practice persistence, and refresh preservation. It stubs only Supabase's `auth.users`/`auth.uid()` surface; Supabase's hosted auth/email/OAuth flows still require testing against your configured project.

Playwright uses a clean browser context for each test and exercises manual course creation, completion, note autosave/reload, practice, goals, analytics, profile persistence, and URL validation on desktop and mobile. Run these tests without Supabase environment variables to exercise the independent local mode. Tests create data only in isolated browser contexts.

## Deploy to Vercel

1. Push this repository to your Git host and import it into Vercel as a Next.js project.
2. Use `bun install --frozen-lockfile` for installation and `bun run build` as the build command. Alternatively, npm can install from `package.json` if you generate and commit an npm lockfile.
3. Add all three environment variables from `.env.example` to the correct Vercel environment.
4. Apply the migration to your production Supabase project.
5. Set Supabase's site URL to your production domain and allow its `/auth/callback` and password-reset callback. Add preview domains only if you need preview sign-in.
6. Deploy and verify: signup/email confirmation, Google OAuth, playlist preview/confirm, video playback, completion, notes, logout/login persistence, and isolation using two accounts.

No hosted deployment or live Supabase/YouTube connection is included without your project credentials. Cloud integration is implemented, but hosted account flows and live YouTube imports must be validated with those credentials before treating a deployment as production-ready.
