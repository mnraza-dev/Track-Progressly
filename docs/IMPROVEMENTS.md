# Progressly improvements

## Implemented

- ChaiCode-inspired dark surfaces, copper highlights, outlined cards, responsive layouts, and larger typography. Space Grotesk headings, DM Sans reading text, and Geist Mono labels are self-hosted. Light/system themes remain available.
- Exports for Markdown notes, lesson CSV, activity CSV, quiz-results CSV, complete JSON backups, and printable reports/save PDF. Course-scoped exports, formula-safe CSV cells, escaped reports, validated browser restore, and device-local file creation.
- Eight original collectible level badges, persistent one-time XP, daily quests, milestone achievements, reduced-motion celebrations, and opt-in sound effects with volume, preview, mute, and quiet-during-video preferences.
- Custom lesson quizzes with four-option questions, explanations, a 70% pass mark, retries, saved attempts, versioned edits, completion actions, and server-derived grading for accounts.
- Consistent learning time labels: 60 minutes displays as 1 Hour, 90 as 1 Hour 30 Minutes, with compact chart labels. Editable minute inputs and clocks keep their explicit units.
- Restored database baseline, account ownership constraints and RLS, immutable server reward ledger, private quizzes, streamed request limits, response security headers, bounded anonymous rate-limit storage, repaired course/player hooks, clearer analytics labels, and CI checks against a production build. Framework dependencies are pinned to 16.4.3.

## Recommended next

1. Complete the hosted launch checks in [Development](DEVELOPMENT.md#production-release): configure credentials, apply migrations, verify email/OAuth and two-account isolation, monitor errors, and test recovery.
2. Add a scheduled revision queue using existing notes and quiz mistakes.
3. Suggest realistic weekly plans from course deadlines and available study days.
4. Add transactional account backup restore with a conflict preview and recovery path. Browser restore is already available.
5. Add per-course loading for very large libraries and shared anonymous import limiting for multi-instance deployments.
6. Surface last-sync timestamps and actionable reconnect/retry status for cloud workspaces.

## Validation

Run `bun run lint --max-warnings 0`, `bun run typecheck`, `bun run test`, and `bun run build`. Run browser checks without Supabase environment variables, using `PLAYWRIGHT_SERVER_MODE=production PLAYWRIGHT_PORT=3300 bun run test:e2e` after a build. PostgreSQL tests use PGlite with authenticated roles and two users. Browser checks cover desktop/mobile layouts, exports, restoration, themes, courses, notes, practice, player chapters, charts, rewards, sounds, and quizzes. Hosted authentication, email, OAuth, monitoring, and real service configuration remain deployment checks.
