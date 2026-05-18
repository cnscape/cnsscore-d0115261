CREATE TABLE IF NOT EXISTS public.weekly_kpi_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id uuid NOT NULL,
  client_id uuid NOT NULL,
  week_start date NOT NULL,
  outreach_dms_target integer NOT NULL DEFAULT 30,
  calls_booked_target integer NOT NULL DEFAULT 6,
  conversion_rate_target numeric NOT NULL DEFAULT 15,
  closed_deals_target integer NOT NULL DEFAULT 4,
  carried_outreach integer NOT NULL DEFAULT 0,
  carried_calls integer NOT NULL DEFAULT 0,
  carried_deals integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (rep_id, client_id, week_start)
);

ALTER TABLE public.weekly_kpi_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage kpi assignments" ON public.weekly_kpi_assignments;
CREATE POLICY "Admins manage kpi assignments" ON public.weekly_kpi_assignments
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Reps view own kpi assignments" ON public.weekly_kpi_assignments;
CREATE POLICY "Reps view own kpi assignments" ON public.weekly_kpi_assignments
  FOR SELECT USING (auth.uid() = rep_id);

DROP TRIGGER IF EXISTS trg_weekly_kpi_assignments_updated ON public.weekly_kpi_assignments;
CREATE TRIGGER trg_weekly_kpi_assignments_updated
  BEFORE UPDATE ON public.weekly_kpi_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.weekly_todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.weekly_kpi_assignments(id) ON DELETE CASCADE,
  rep_id uuid NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  task_text text NOT NULL,
  task_type text NOT NULL DEFAULT 'other',
  target_count integer DEFAULT 1,
  completed_count integer DEFAULT 0,
  is_done boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.weekly_todos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage todos" ON public.weekly_todos;
CREATE POLICY "Admins manage todos" ON public.weekly_todos
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Reps view own todos" ON public.weekly_todos;
CREATE POLICY "Reps view own todos" ON public.weekly_todos
  FOR SELECT USING (auth.uid() = rep_id);
DROP POLICY IF EXISTS "Reps update own todos" ON public.weekly_todos;
CREATE POLICY "Reps update own todos" ON public.weekly_todos
  FOR UPDATE USING (auth.uid() = rep_id);


CREATE TABLE IF NOT EXISTS public.rep_roadblocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id uuid NOT NULL,
  assignment_id uuid REFERENCES public.weekly_kpi_assignments(id) ON DELETE SET NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  message text NOT NULL,
  suggestion text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.rep_roadblocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view all roadblocks" ON public.rep_roadblocks;
CREATE POLICY "Admins view all roadblocks" ON public.rep_roadblocks
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Reps view own roadblocks" ON public.rep_roadblocks;
CREATE POLICY "Reps view own roadblocks" ON public.rep_roadblocks
  FOR SELECT USING (auth.uid() = rep_id);
DROP POLICY IF EXISTS "Reps insert own roadblocks" ON public.rep_roadblocks;
CREATE POLICY "Reps insert own roadblocks" ON public.rep_roadblocks
  FOR INSERT WITH CHECK (auth.uid() = rep_id);

CREATE INDEX IF NOT EXISTS idx_roadblocks_rep_created ON public.rep_roadblocks(rep_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_todos_rep_assignment ON public.weekly_todos(rep_id, assignment_id);
CREATE INDEX IF NOT EXISTS idx_kpi_assign_rep_week ON public.weekly_kpi_assignments(rep_id, week_start);