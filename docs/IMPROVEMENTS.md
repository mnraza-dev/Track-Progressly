# Progressly improvements

## Implemented

- A ChaiCode-inspired visual system: near-black surfaces, warm highlights, large headings, outlined cards, subtle geometric decoration, and responsive spacing. Progressly keeps its own identity. New visitors start in dark mode; saved theme choices still apply, and light/system themes remain available.
- A shared export panel in the workspace header and Settings: Markdown notes with timestamped YouTube links, lesson-level CSV, daily activity CSV, complete JSON backups, and a printable progress report that can be saved as PDF. Notes, progress, and reports support selecting one course. Activity and backup always cover the full workspace.
- UTF-8 spreadsheet exports with quoted cells and formula neutralization. Report text is HTML-escaped. Exports run on the device.
- Validated browser backup restore with a preview, replacement confirmation, persistence under the correct storage key, and inline errors. Account restore is explicitly unavailable until a server-side restore flow exists; account export still works.

## Recommended next, in priority order

1. **Repair the existing reliability checks.** Restore the missing `supabase/migrations/001_learntrack.sql` migration and resolve existing conditional hooks and effect issues in the course/player code. These checks currently prevent a clean full-suite result.
2. **Build a scheduled revision queue.** Notes already support “needs revision.” Add next-review dates and a short daily queue so learners know what to revisit.
3. **Make planning actionable.** Use course deadlines and available study days to suggest a realistic weekly lesson plan, then show one clear next action on the dashboard.
4. **Add account backup restore.** Validate on the server, preview conflicts, and restore transactionally with ownership checks and a recovery path. The current browser-only restore must not pretend to save account data.
5. **Simplify analytics language.** Prefer watch time, completed lessons, completed practice, and review backlog. Current retention/mastery-style labels are proxies based on activity, not measured knowledge; explain or rename them.
6. **Add resilient sync status.** Show when the last save completed and provide actionable retry feedback when connectivity or browser storage fails.

The Next.js dev server also reports a security advisory for the installed framework version. Review and apply the framework security upgrade in a separate change, then run the app's regression checks.
