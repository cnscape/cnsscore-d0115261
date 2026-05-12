-- Fix Collections CRM: ensure tables exist
CREATE TABLE IF NOT EXISTS public.debt_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  client_contact text,
  client_id uuid,
  description text,
  original_amount numeric NOT NULL DEFAULT 0,
  commission_percent numeric NOT NULL DEFAULT 10,
  assigned_to uuid,
  priority text NOT NULL DEFAULT 'medium',
  stage text NOT NULL DEFAULT 'new',
  next_follow_up date,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.debt_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id uuid NOT NULL REFERENCES public.debt_records(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text,
  payment_reference text,
  notes text,
  proof_url text,
  added_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON public.debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_records_assigned ON public.debt_records(assigned_to);

ALTER TABLE public.debt_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage debts" ON public.debt_records;
CREATE POLICY "Admins manage debts" ON public.debt_records
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Assigned can view own debts" ON public.debt_records;
CREATE POLICY "Assigned can view own debts" ON public.debt_records
  FOR SELECT TO authenticated USING (auth.uid() = assigned_to);

DROP POLICY IF EXISTS "Admins manage payments" ON public.debt_payments;
CREATE POLICY "Admins manage payments" ON public.debt_payments
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Assigned can view payments for own debts" ON public.debt_payments;
CREATE POLICY "Assigned can view payments for own debts" ON public.debt_payments
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.debt_records d WHERE d.id = debt_id AND d.assigned_to = auth.uid())
  );

DROP TRIGGER IF EXISTS trg_debt_records_updated ON public.debt_records;
CREATE TRIGGER trg_debt_records_updated
  BEFORE UPDATE ON public.debt_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admins read payment proofs" ON storage.objects;
CREATE POLICY "Admins read payment proofs" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'payment-proofs' AND public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins upload payment proofs" ON storage.objects;
CREATE POLICY "Admins upload payment proofs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'payment-proofs' AND public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins update payment proofs" ON storage.objects;
CREATE POLICY "Admins update payment proofs" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'payment-proofs' AND public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins delete payment proofs" ON storage.objects;
CREATE POLICY "Admins delete payment proofs" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'payment-proofs' AND public.is_admin(auth.uid()));

NOTIFY pgrst, 'reload schema';
