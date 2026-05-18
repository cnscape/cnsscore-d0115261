# Dashboard Refactor & AI Daily Work Engine

## 1. Navigation & Module Cleanup

- **Remove Playbook module** entirely:
  - Delete sidebar links (`/playbook`, `/admin/playbook`) for all roles
  - Remove routes from `App.tsx`
  - Delete `PlaybookPage.tsx`
- **Nest History under Achievements**:
  - Remove standalone `/history` link from sidebars
  - Add a tabbed view inside `AchievementsPage` with "Achievements" + "History" tabs (reuse existing `HistoryPage` content as a tab panel)
- **Move Kanban into My Deals**:
  - `DealsPage` becomes a tabbed view: "Pipeline (Kanban)" tab embedding the CRM board + "Closed Deals" tab with the existing deals list
  - Remove the standalone "CRM Pipeline" sidebar link (or keep redirect to `/deals`)

## 2. Custom Client Channels (Admin-Managed)

- **New table `client_channels`**: `id, client_id, name, color, is_active, sort_order, created_at`
  - RLS: admins manage; authenticated read active
- **Admin UI**: Add a "Channels" panel inside `ClientsPage` (per-client) — list, add, edit, archive channels with name + color
- **Deal form refactor**: In `DealsPage` create/edit modal, replace the static `channel` enum dropdown with a dynamic select populated from `client_channels` filtered by selected client
- Store the channel name in the existing `deals.channel` text field (keep backwards compat — it's already a USER-DEFINED enum; we'll switch the column to `text` via migration so any client-defined channel name is allowed)

## 3. Admin KPI Controls + Weekly Trends

- Use the existing `kpi_targets` table (already supports per-rep, metric_name, target_value, period)
- **Admin page** (extend `AdminTeamPerformancePage` or add small editor): pick rep → set targets for the four metrics (`outreach_dms`, `calls_conducted`, `deals_closed`, `close_rate`) with sensible defaults (35, 10, 8, 25)
- **Weekly trend visualization**: Add a 4-week sparkline/bar chart per metric on the rep's performance view, computed from `lead_activities` (DMs/calls), `deals` (closed), and ratio for close rate

## 4. AI Daily Work Coach

- **Edge function** `daily-work-coach` (Lovable AI Gateway, model `google/gemini-3-flash-preview`):
  - Input: user_id
  - Server-side fetches: pipeline_leads counts by stage, this-week activity counts, KPI targets, gap to target
  - Output: short personalized "Plan of Action" markdown (3–5 bullet next-actions to hit KPIs)
- **UI**: Add a "Plan of Action" card at the top of `DailyWorkPage` (above the 4 stat cards) with refresh button, loading shimmer, markdown rendering. Auto-fetches on mount and once per day cache in localStorage.

## 5. Visual Polish

- Keep dark theme; ensure primary CTAs ("+ Add Client", "+ Add Offer", "Go to CRM", "Refresh Plan") use existing primary token (already orange-ish in the design system)
- Rounded status badges already in use — verify Active/Inactive badge styling on Clients & Channels lists
- Card-based KPI trend tiles with mini bar charts (recharts is already a project dep)

## Technical Notes

- New migration: create `client_channels` table + RLS; alter `deals.channel` from enum to text (preserve data with `USING channel::text`)
- New edge function: `supabase/functions/daily-work-coach/index.ts` using `@ai-sdk/openai-compatible` + `streamText`/`generateText` via Lovable AI Gateway
- Files touched: `App.tsx`, `Sidebar.tsx`, `DealsPage.tsx`, `AchievementsPage.tsx`, `ClientsPage.tsx`, `AdminTeamPerformancePage.tsx`, `DailyWorkPage.tsx`; delete `PlaybookPage.tsx`
- No changes to existing data; backwards compatible

## Out of Scope (confirm if you want included)

- Rebuilding `CRMPipelinePage` — will be embedded as-is inside Deals tab
- Changing existing color tokens — sticking with current orange primary
