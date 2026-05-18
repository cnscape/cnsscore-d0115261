# Admin KPI Targets, AI Weekly To-Dos, Carry-Over & Roadblocks

Build an admin-driven KPI + AI coaching system that assigns weekly targets per (client, team member), generates daily to-dos with AI, carries unmet work into next week, captures rep roadblocks via chat, and surfaces it all on an admin dashboard.

## 1. Database (new migration)

- **`weekly_kpi_assignments`** — admin-set weekly targets per (rep, client, week_start)
  - `id, rep_id, client_id, week_start (date, Monday), outreach_dms_target, calls_booked_target, conversion_rate_target, closed_deals_target, carried_outreach, carried_calls, carried_deals, notes, created_by, created_at, updated_at`
  - Unique (rep_id, client_id, week_start)
- **`weekly_todos`** — AI-generated daily task items
  - `id, assignment_id, rep_id, day_of_week (0–6), task_text, task_type (dm|call|follow_up|admin|other), target_count, completed_count, is_done, created_at`
- **`rep_roadblocks`** — rep ↔ AI coach chat log
  - `id, rep_id, assignment_id (nullable), role (user|assistant), message, suggestion (text, nullable), created_at`
- RLS: admins manage all; reps read/update own rows; reps can insert own roadblock messages.
- Helper view / SQL function `get_week_actuals(rep_id, client_id, week_start)` to count DMs (`lead_activities` `dm_sent`), calls (`call_made`/`meeting_booked`), closed_won (`deals.status='won'`) for that week.

## 2. Edge Functions (Lovable AI Gateway, `google/gemini-3-flash-preview`)

- **`generate-weekly-todos`** — input `{ assignment_id }`. Loads targets + carry-overs, asks AI for a Mon–Fri actionable daily plan, persists `weekly_todos` rows.
- **`carry-over-kpis`** — input `{ rep_id, client_id, week_start }`. Computes previous-week actuals vs targets, writes a new `weekly_kpi_assignments` row for the next Monday with `carried_*` deltas, then calls `generate-weekly-todos`.
- **`rep-roadblock-chat`** — input `{ message, assignment_id? }`. Logs user message, sends full thread + KPI context to AI, returns + persists assistant suggestion.

## 3. Admin UI — new page `/admin/kpi-targets`

- Sidebar link "KPI Targets" (admin only).
- **Assignment editor**: searchable rep picker + client picker + week selector → form with the 4 targets → Save. Then "Generate Weekly To-Dos" button calls the edge function.
- **Assignments table**: this week's assignments with progress bars (target vs actual), completion % of to-dos, status chips.
- **Trends**: 4-week mini bar chart per assignment (recharts).
- **Roadblocks panel**: latest rep messages + AI suggestions, filterable by rep.

## 4. Rep UI

- **DailyWorkPage**: add a "This Week's Plan" card listing today's AI to-dos with checkboxes (toggles `is_done`, increments `completed_count`).
- **"Talk to AI Coach" drawer**: chat thread powered by `rep-roadblock-chat`; shows past conversations + suggestions.

## 5. Visual style

- Keep operator-dark + International Orange accents. Use existing `Card`, `Badge`, `Progress`, `Tabs` primitives. Priority/status chips use existing tokens. Charts via recharts.

## Technical Notes

- Week start = Monday (ISO). Compute server-side in edge functions to avoid TZ drift; client passes a date and server snaps to Monday.
- AI prompts return strict JSON (use AI SDK `Output.object` or `response_format: json_object`) so we can persist structured to-dos reliably.
- Carry-over rule: `carried_x = max(0, target_x + previous_carried_x - actual_x)`.
- All AI calls go through Lovable AI Gateway with `LOVABLE_API_KEY` (already provisioned). Handle 429/402 with user-facing toasts.
- Files: migration `2026xxxx_kpi_todos_roadblocks.sql`; functions `generate-weekly-todos`, `carry-over-kpis`, `rep-roadblock-chat`; pages `AdminKpiTargetsPage.tsx`; edits to `App.tsx`, `Sidebar.tsx`, `DailyWorkPage.tsx`.

## Out of Scope (confirm if you want included)

- Automated cron to auto-run carry-over each Monday (manual "Roll Over Week" button for now).
- Per-client (non-rep) KPI dashboards separate from the rep assignments.
- Email/Slack alerts when KPIs miss/exceed (in-app alert card only).
