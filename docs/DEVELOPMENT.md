# Developing Progressly

[← Back to the product](../README.md)

Setup, integrations, architecture, validation, and deployment for the Progressly application.

## Run locally

Requirements: Node.js 22+ and Bun 1.4+ (or npm).

```sh
bun install
cp .env.example .env.local
bun run dev
```

Open http://localhost:3000. With no Supabase variables, the application opens an explicitly labeled **local workspace**. Courses, notes, bookmarks, tasks, goals, and preferences persist in this browser using localStorage. There is no seeded or invented course data. Manual course creation works without any API credentials. Browser mode works in development and deployed builds; each browser keeps its own workspace, without accounts or cross-device sync. Local data is not automatically uploaded when cloud mode is configured.

The public product page is also available at `/welcome`. Once Supabase is configured, `/` displays this public homepage and application routes require sign-in.

## Deploy without Supabase

Deploy as a Next.js server application so `/api/youtube` is available. Add `YOUTUBE_API_KEY` to the hosting provider's server environment. Your local `.env.local` is ignored by Git and is not included in a Git-based deployment.

Leave both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` unset, then build and deploy. If these public variables were present in an earlier build, remove them from the hosting environment and redeploy: Next.js embeds their values into the browser bundle at build time. Setting only one Supabase variable keeps the app in browser mode.

YouTube imports and chapter metadata lookups need only the server-side YouTube key. Courses, progress, notes, tasks, and goals stay in browser storage. Authentication and cross-device sync require Supabase. Browser storage belongs to the deployed origin, so data saved on localhost does not appear automatically on the deployed domain.

Anonymous imports retain a ten-requests-per-minute, per-IP limit within each running server process. This is best-effort on serverless or multi-instance hosting; use the host's shared rate controls if you need a global limit. Cloud mode continues to require authentication and uses the database quota.

Behind a reverse proxy, forward the public hostname in `Host` or `X-Forwarded-Host`. Both API mutation routes validate browser origins against those host headers, so an internal Next.js request URL such as `http://localhost:3000` does not block requests from the deployed domain.

## Product design and Three.js studio

The product uses a ChaiCode-inspired shadcn/ui system: near-black surfaces, warm copper highlights, outlined cards, Space Grotesk headings, DM Sans body text, and Geist Mono labels. Next.js self-hosts the fonts. The dashboard and public page share an interactive Watch / Practice / Remember showcase; its controls switch between custom Three.js scenes and explain the learning process. Buttons, cards, dialogs, inputs, textareas, tabs, switches, badges, checkboxes, and separators use shadcn components backed by Radix. `next-themes` persists Light, Dark, or System and follows operating-system changes. Existing workspace and theme storage keys are retained so rebranding does not discard saved data.

The interface uses a shared Three.js WebGL renderer for the dashboard sculpture, physical daily-goal ring, category artwork, library empty state, learning goals, analytics insights, import guide, authentication, and public homepage. The scenes use custom procedural models, PBR materials, environment lighting, and pointer parallax. The hero can be rotated with a mouse drag or the arrow keys; Home and the reset control restore its orientation.

The Three.js module loads on the client. One canvas renders visible artwork using independent camera/scissor regions, with capped pixel density and a 30 fps rendering target. Off-screen scenes stop drawing, hidden tabs pause the render loop, and removed scenes dispose their geometry, materials, and textures. Reduced-motion preferences stop ambient animation. An HTML/CSS illustration remains available when WebGL is unavailable or its context is lost; supported contexts recover automatically.

The dashboard and analytics include a Three.js timeline built from the last seven days of saved activity. Switch between minutes and completed lessons, select a day to highlight its column, and rotate the scene with a mouse or keyboard. Column heights are relative to the largest value in that week; zero days have no raised column. Concentric rings on the goals page reflect progress toward the first three goals.

Interactive area/bar charts show learning activity with period and metric controls. A selectable donut splits available lessons by status, stacked bars compare courses, weekday bars show learning rhythm, and the goals chart overlays the daily minute target. Data tables and HTML legends provide the same information without relying on graphics. All charts use actual saved data; archived courses and unavailable lessons are excluded from library charts. Empty accounts display zero values.

The daily-goal ring uses actual saved learning progress. Learning data and playback behavior are unchanged by the visual redesign. The dashboard's quick import field forwards the pasted link to the validated importer.

## Connect Supabase

All database migrations are included and exercised by the PostgreSQL integration tests. Clerk authentication and the hosted Clerk/Supabase integration also require verification against your configured project.

1. Create a free Supabase project.
2. Apply every migration in `supabase/migrations/` in numeric order: `001_learntrack.sql`, `002_learning_rewards.sql`, `003_push_subscriptions.sql`, `004_lesson_quizzes.sql`, then `005_clerk_workspaces.sql`. Use the Supabase SQL editor or `supabase db push` after linking your project. Apply each migration once; existing installations should apply only migrations they have not already run. If an older installation already applied the former `003_lesson_quizzes.sql`, skip `004_lesson_quizzes.sql` because it restores the same quiz tables and RPCs.
3. Copy the project URL and **publishable key** from the project's Connect dialog into `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
YOUTUBE_API_KEY=YOUR_SERVER_ONLY_YOUTUBE_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=YOUR_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY=YOUR_CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
```

4. Activate the [Supabase integration in Clerk](https://clerk.com/docs/guides/development/integrations/databases/supabase) and copy the Clerk domain it displays. This adds the `authenticated` role to Clerk session tokens.
5. In Supabase Authentication → Sign In / Providers, add Clerk as a third-party provider with that domain. See [Supabase's Clerk guide](https://supabase.com/docs/guides/auth/third-party/clerk). Use native session tokens; the old Supabase JWT template integration is deprecated.
6. Configure email/password and any social sign-in providers in Clerk. Sign out and back in after enabling the integration so your session has the updated claims.
7. Restart `bun run dev` after changing environment variables.

The application never uses or requires a Supabase service-role key. Server endpoints verify the signed-in Clerk user, pass the Clerk session token to Supabase, and remain subject to RLS. `ensure_workspace_profile()` creates a UUID profile keyed by the verified token's Clerk subject; policies and RPCs resolve that mapping with `workspace_user_id()`. Existing Supabase accounts retain their profiles and UUIDs. Linking an existing account to a Clerk user requires an explicit trusted database update to `profiles.clerk_user_id`; the application never merges accounts by email. Next.js `proxy.ts` handles Clerk sessions and protects application routes.

### First access with an empty database

No sample data or pre-created Supabase Auth user is required. Apply the database migrations and configure Supabase to trust the Clerk instance first. On the first authenticated workspace request, `ensure_workspace_profile()` creates only that user's profile with default preferences. Courses, goals, quizzes, activity, and rewards start empty; the user can then save their first course. Repeated requests reuse the same profile.

An empty database still needs its tables, policies, and functions installed. A rejected Clerk token (`PGRST301`/`PGRST303`) occurs before any table data is read or created; inserting data cannot repair provider configuration. The server logs the gateway error code and reason with JWTs redacted. Expired tokens return 401; a provider configuration rejection returns 503 and identifies the verified Clerk issuer domain to configure in Supabase.

## Connect YouTube

1. Create a Google Cloud project and enable **YouTube Data API v3**.
2. Create an API key and restrict it to YouTube Data API v3.
3. Put it in the server-only `YOUTUBE_API_KEY` variable. Never prefix it with `NEXT_PUBLIC_`.

Imports accept playlists, videos, their IDs, and common YouTube URL formats. The server follows playlist pagination, batches video metadata requests in groups of 50, preserves order, excludes unavailable lessons from completion calculations, and caches public metadata for ten minutes. Each signed-in user has an atomic database rate limit of ten preview/refresh requests per minute. Concurrent duplicate imports are prevented by database constraints, and imports run in a transaction.

The importer supports up to 5,000 playlist videos. Repeated appearances of the same video are deduplicated in their first playlist position. Private, deleted, or non-embeddable lessons remain marked unavailable; metadata is never fabricated. A refresh retains lesson IDs, notes, bookmarks, tasks, and progress, marks removed videos unavailable, and adds/reorders available entries. Manual creation is always available if the API fails or quota is exhausted.

Player tracking uses the official YouTube IFrame API. Active time is measured while playback is running and the document is visible, saved about every 15 seconds, on pause, and best-effort on departure. It never infers learning time from a video's duration. Manual completion is the default. Automatic completion at 90% requires explicitly enabling it in Settings. Playback, seeking, and final saves depend on browser/YouTube restrictions; external YouTube playback cannot be tracked by this application.

## Architecture

### Course creation

After a successful import or manual course creation, the form clears its preview and fields before navigation. Next.js Cache Components preserves the route, so this reset allows the next Add course action to start fresh while unsuccessful submissions retain their input.

`lib/id.ts` generates UUID v4 IDs for courses, lessons, notes, practice, bookmarks, and goals. It uses native `crypto.randomUUID` when available and cryptographic `getRandomValues` otherwise, supporting browsers where the native UUID method is unavailable. See [Web Crypto compatibility](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID).

### Video chapter navigation

The lesson sidebar switches between course lessons and the current video's chapter timestamps. `lib/youtube/chapters.ts` reads timestamp/title lines from the saved video description, supports minute and hour formats, sorts and deduplicates sections, and discards timestamps beyond a known duration. The player reports its current position to highlight the active section. Chapter clicks use the IFrame Player API's `seekTo`, and a click during player loading is queued until readiness. Seeking does not add the skipped interval to learning time.

Imported descriptions are reused without another request. For manually added videos without a saved description, a client cache looks up public video metadata through the existing authenticated/rate-limited `/api/youtube` endpoint. Requests are deduplicated and cached for ten minutes; these lookups share the preview request limit. A failed lookup offers a retry. The integration reads creator timestamps from descriptions; YouTube-only automatically generated chapters without description timestamps are not displayed.

References: [video description metadata](https://developers.google.com/youtube/v3/docs/videos#snippet.description), [IFrame playback controls](https://developers.google.com/youtube/iframe_api_reference#seekTo). Browser tests use an IFrame API fixture to verify seek calls, pending seeks, section highlighting, metadata failures, and lesson switching without making live YouTube requests.

- `app/`: App Router pages, public authentication pages, auth callback, and authenticated route handlers.
- `components/`: shadcn/ui primitives, layout, courses, player, notes, dashboard, and Recharts analytics.
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

Route tests also cover production imports without Supabase, partially configured cloud credentials, anonymous and account quotas, public host forwarding, and rejected foreign origins. These tests mock YouTube metadata and cloud authentication without using real credentials.

Playwright checks rendered text contrast in both themes, theme persistence and operating-system changes, and the larger typography. It uses a clean browser context for each test and exercises manual course creation, completion, note autosave/reload, practice, goals, analytics, profile persistence, and URL validation on desktop and mobile. Run these tests without Supabase environment variables to exercise the independent local mode. Tests create data only in isolated browser contexts.

Refresh the README screenshots from an isolated illustrative workspace with `UPDATE_PRODUCT_SHOTS=1 bun run test:e2e tests/e2e/product.spec.ts --project=desktop`. Normal test runs leave the tracked product images unchanged.

## Deploy to Vercel

1. Push this repository to your Git host and import it into Vercel as a Next.js project.
2. Use `bun install --frozen-lockfile` for installation and `bun run build` as the build command. Alternatively, npm can install from `package.json` if you generate and commit an npm lockfile.
3. For browser mode, add only `YOUTUBE_API_KEY` to the correct Vercel environment and leave both Supabase variables unset. For cloud mode, add both Supabase variables too. Redeploy after changing environment variables.
4. For cloud mode, apply all pending migrations to your production Supabase project in numeric order.
5. For cloud mode, set Supabase's site URL to your production domain and allow its `/auth/callback` and password-reset callback. Add preview domains only if you need preview sign-in.
6. Deploy and verify playlist preview/confirm, video playback, completion, notes, and reload persistence. For cloud mode, also verify signup/email confirmation, Google OAuth, logout/login persistence, and isolation using two accounts.

No hosted deployment or live Supabase/YouTube connection is included without your project credentials. Cloud integration is implemented, but hosted account flows and live YouTube imports must be validated with those credentials before treating a deployment as production-ready.

## Production release

The app includes a production build, strict lint and TypeScript checks, PostgreSQL ownership tests, and desktop/mobile browser workflows. CI runs these checks, then exercises the compiled production app with `PLAYWRIGHT_SERVER_MODE=production`. Next.js and its ESLint config are pinned to 16.4.3. Response headers include frame protection, no-sniff, referrer policy, and restricted device permissions. JSON endpoints enforce streamed request size limits, validate mutations, and reject foreign origins.

### Rewards and feedback

Eight generated enamel/metal badges represent levels at 0, 150, 400, 800, 1,400, 2,200, 3,200, and 4,500 XP. The first badge welcomes new learners. A persistent ledger grants one-time lesson, note, practice, course, daily quest, focus, and achievement rewards. Undoing, archiving, deleting, or re-importing earned work does not replay its rewards. Moving the playback position or checking chapters does not grant learning XP. Account rewards are calculated by a private database function with an account lock and unique event keys; clients cannot insert XP.

Milestone chimes use the Web Audio API with device-level opt-in, volume control, preview, mute, and a quiet-during-video setting. Sounds do not play on initial load or replay after navigation. Hidden tabs suppress sounds; confetti respects reduced motion and the celebration preference. Automated browser checks verify sound scheduling; preview the chimes on real target devices before release.

### Lesson quizzes

Each available lesson has a personal multiple-choice quiz section. Learners can author 1–20 questions with four unique options, a correct answer, and an optional explanation. All questions must be answered; 70% passes. Results include answer review, retries, best score, and a completion action. Passing does not automatically erase unfinished lesson work. Video-ended navigation pauses for an unpassed quiz when one exists; explicit lesson navigation remains available.

Editing starts a new quiz version. Older attempts remain in the backup, while the current version controls the pass badge and best score. The latest 100 attempts per lesson are retained. Browser data persists with the workspace. Account quizzes and attempts use ownership constraints, read-only RLS policies, and validated RPCs; PostgreSQL computes scores from the saved questions. Question editing is personal study authoring, not an assessment certification or public exam system. Questions are custom; imports do not claim to include verified quizzes or AI-generated transcripts.

Export includes a course-scoped quiz-results CSV and complete quiz data in JSON backups. All learning time summaries use hour/minute labels, with compact labels on chart axes and small day cells. Numeric minute inputs and playback/countdown clocks retain their explicit units.

### Hosted launch checks

Configure the hosting domain, server-only YouTube key, Supabase project, redirect URLs, email/Google authentication, and all three migrations. Validate signup, confirmation, password reset, OAuth, cross-account isolation, live imports, video tracking, quizzes, rewards, and persistence against that environment. Configure production monitoring, database backup/recovery, and a shared anonymous import limiter if deploying across multiple instances; the current anonymous limiter is process-local. Browser-only workspaces require backups to move between devices.

No hosted deployment, email delivery, OAuth callback, or live service connection has been verified without your production credentials. The code checks do not replace those launch checks.
