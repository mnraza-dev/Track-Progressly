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

The product uses a minimalist shadcn/ui system: warm chalk and deep teal surfaces, teal and copper accents, semantic light/dark tokens, Plus Jakarta Sans headings, and Inter body text. The dashboard and public page share an interactive Watch / Practice / Remember showcase; its controls switch between custom Three.js scenes and explain the learning process. Buttons, cards, dialogs, inputs, textareas, tabs, switches, badges, checkboxes, and separators use the official shadcn components backed by Radix. `next-themes` persists Light, Dark, or System and follows operating-system changes. Existing workspace and theme storage keys are retained so rebranding does not discard saved data.

The interface uses a shared Three.js WebGL renderer for the dashboard sculpture, physical daily-goal ring, category artwork, library empty state, learning goals, analytics insights, import guide, authentication, and public homepage. The scenes use custom procedural models, PBR materials, environment lighting, and pointer parallax. The hero can be rotated with a mouse drag or the arrow keys; Home and the reset control restore its orientation.

The Three.js module loads on the client. One canvas renders visible artwork using independent camera/scissor regions, with capped pixel density and a 30 fps rendering target. Off-screen scenes stop drawing, hidden tabs pause the render loop, and removed scenes dispose their geometry, materials, and textures. Reduced-motion preferences stop ambient animation. An HTML/CSS illustration remains available when WebGL is unavailable or its context is lost; supported contexts recover automatically.

The dashboard and analytics include a Three.js timeline built from the last seven days of saved activity. Switch between minutes and completed lessons, select a day to highlight its column, and rotate the scene with a mouse or keyboard. Column heights are relative to the largest value in that week; zero days have no raised column. Concentric rings on the goals page reflect progress toward the first three goals.

Interactive area/bar charts show learning activity with period and metric controls. A selectable donut splits available lessons by status, stacked bars compare courses, weekday bars show learning rhythm, and the goals chart overlays the daily minute target. Data tables and HTML legends provide the same information without relying on graphics. All charts use actual saved data; archived courses and unavailable lessons are excluded from library charts. Empty accounts display zero values.

The daily-goal ring uses actual saved learning progress. Learning data and playback behavior are unchanged by the visual redesign. The dashboard's quick import field forwards the pasted link to the validated importer.

## Connect Supabase

**Current checkout limitation:** `supabase/migrations/001_learntrack.sql` is missing. The steps below describe the expected setup, but cloud mode and the nine database integration tests cannot be verified until that migration is restored. The local workspace, YouTube integration, and UI do not require this migration.

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
4. For cloud mode, apply the migration to your production Supabase project.
5. For cloud mode, set Supabase's site URL to your production domain and allow its `/auth/callback` and password-reset callback. Add preview domains only if you need preview sign-in.
6. Deploy and verify playlist preview/confirm, video playback, completion, notes, and reload persistence. For cloud mode, also verify signup/email confirmation, Google OAuth, logout/login persistence, and isolation using two accounts.

No hosted deployment or live Supabase/YouTube connection is included without your project credentials. Cloud integration is implemented, but hosted account flows and live YouTube imports must be validated with those credentials before treating a deployment as production-ready.
