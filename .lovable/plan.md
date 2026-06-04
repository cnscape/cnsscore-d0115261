## Goal
When an admin creates a collection (debt record) and assigns it to a sales rep, that rep should be able to see it inside their own app — not just admins.

## Current state
- `CollectionsCRMPage` exists and renders the kanban shown in the screenshot.
- It's wired only to admin routes: `/admin/collections` (admin) and `/collections` redirects to admin.
- RLS on `debt_records` already allows `assignee_id = auth.uid()` to SELECT, so the data is reachable for reps — they just have no UI entry point.
- `useAuth` exposes `isAdmin`, already consumed inside the page.

## Changes

### 1. Routing (`src/App.tsx`)
- Add a non-admin route `/my-collections` → `<CollectionsCRMPage />` inside `ProtectedRoute` (no `adminOnly`).
- Keep `/admin/collections` for admins. Remove the `/collections → /admin/collections` redirect so non-admins aren't bounced.

### 2. Sidebar (`src/components/layout/Sidebar.tsx`)
- Add a "Collections" nav item for sales reps / team leads / scouts pointing to `/my-collections` (icon: `Wallet` or `Receipt`, matching the existing operator aesthetic).
- Keep the existing admin "Collections" link untouched.

### 3. Page behavior (`src/pages/CollectionsCRMPage.tsx`)
Rep-friendly, read-mostly mode driven by existing `isAdmin` flag:
- Hide "New Debt" button, delete actions, and assignee reassignment for non-admins.
- Allow non-admins to: view their assigned debts, log payments (insert into `debt_payments`), update `next_follow_up`, and move stage (their own records only — already enforced by RLS).
- Page title switches to "My Collections" for non-admins; totals card summarises only the rows they can see (already correct since the query returns only their rows under RLS).
- Empty state copy for reps: "No collections assigned to you yet."

### 4. Realtime nudge (optional, low-risk)
- Subscribe to `postgres_changes` on `debt_records` filtered by `assignee_id=eq.<userId>` so a newly assigned collection appears without refresh and shows a toast: "New collection assigned: {client_name}".

## Out of scope
- No schema changes. RLS is already correct.
- No change to admin creation flow or kanban styling.
- No commission logic changes.

## Technical notes
- `debt_payments` RLS must allow assignees to insert; if it currently blocks reps, we'll add a policy `assignee can insert payments for their debt records` in a new migration. Will verify before editing the page.
