-- 1) Per-client custom channels
CREATE TABLE IF NOT EXISTS public.client_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#FF6B35',
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (client_id, name)
);

ALTER TABLE public.client_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage channels"
  ON public.client_channels FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated view active channels"
  ON public.client_channels FOR SELECT TO authenticated
  USING (is_active = true);

-- 2) Convert deals.channel from enum to free text so any custom client channel works
ALTER TABLE public.deals
  ALTER COLUMN channel TYPE text USING channel::text;

ALTER TABLE public.deals
  ALTER COLUMN channel SET DEFAULT 'organic';
