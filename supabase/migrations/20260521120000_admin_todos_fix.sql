-- Ensure admin_todos table exists (previous migration partially applied)
CREATE TABLE IF NOT EXISTS public.admin_todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id uuid NOT NULL,
  task_text text NOT NULL,
  is_done boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.admin_todos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage admin todos" ON public.admin_todos;
CREATE POLICY "Admins manage admin todos" ON public.admin_todos
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Reps view own admin todos" ON public.admin_todos;
CREATE POLICY "Reps view own admin todos" ON public.admin_todos
  FOR SELECT TO authenticated USING (auth.uid() = rep_id);

DROP POLICY IF EXISTS "Reps update own admin todos" ON public.admin_todos;
CREATE POLICY "Reps update own admin todos" ON public.admin_todos
  FOR UPDATE TO authenticated USING (auth.uid() = rep_id);

CREATE INDEX IF NOT EXISTS idx_admin_todos_rep ON public.admin_todos(rep_id, created_at DESC);
