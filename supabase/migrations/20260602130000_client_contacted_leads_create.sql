CREATE TABLE IF NOT EXISTS public.client_contacted_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  rep_id uuid NOT NULL,
  lead_name text NOT NULL,
  company_name text,
  linkedin_url text,
  outreach_channel text,
  deal_value numeric DEFAULT 0,
  deal_status text NOT NULL DEFAULT 'discovery_scheduled',
  assigned_closer_id uuid,
  contacted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_contacted_leads TO authenticated;
GRANT ALL ON public.client_contacted_leads TO service_role;

ALTER TABLE public.client_contacted_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage all contacted leads" ON public.client_contacted_leads;
CREATE POLICY "Admins manage all contacted leads"
  ON public.client_contacted_leads FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Auth view contacted leads" ON public.client_contacted_leads;
CREATE POLICY "Auth view contacted leads"
  ON public.client_contacted_leads FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Reps insert own contacted leads" ON public.client_contacted_leads;
CREATE POLICY "Reps insert own contacted leads"
  ON public.client_contacted_leads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = rep_id);

DROP POLICY IF EXISTS "Reps update own contacted leads" ON public.client_contacted_leads;
CREATE POLICY "Reps update own contacted leads"
  ON public.client_contacted_leads FOR UPDATE TO authenticated
  USING (auth.uid() = rep_id);

CREATE INDEX IF NOT EXISTS idx_ccl_client ON public.client_contacted_leads(client_id, contacted_at DESC);

CREATE TABLE IF NOT EXISTS public.client_lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.client_contacted_leads(id) ON DELETE CASCADE,
  rep_id uuid NOT NULL,
  rep_name text,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_lead_notes TO authenticated;
GRANT ALL ON public.client_lead_notes TO service_role;

ALTER TABLE public.client_lead_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage all lead notes" ON public.client_lead_notes;
CREATE POLICY "Admins manage all lead notes"
  ON public.client_lead_notes FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Auth view lead notes" ON public.client_lead_notes;
CREATE POLICY "Auth view lead notes"
  ON public.client_lead_notes FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Reps insert own lead notes" ON public.client_lead_notes;
CREATE POLICY "Reps insert own lead notes"
  ON public.client_lead_notes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = rep_id);

CREATE INDEX IF NOT EXISTS idx_cln_lead ON public.client_lead_notes(lead_id, created_at);
