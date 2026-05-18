
-- ============ DEBT / COLLECTIONS ============
CREATE TABLE IF NOT EXISTS public.debt_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  contact text,
  original_amount numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  outstanding_amount numeric NOT NULL DEFAULT 0,
  commission_percentage numeric NOT NULL DEFAULT 10,
  commission_amount numeric NOT NULL DEFAULT 0,
  description text,
  assignee_id uuid,
  assignee_name text,
  next_follow_up date,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'unpaid',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.debt_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_record_id uuid NOT NULL REFERENCES public.debt_records(id) ON DELETE CASCADE,
  payment_amount numeric NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text,
  payment_reference text,
  payment_note text,
  collected_by uuid,
  proof_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debt_records_assignee_id ON public.debt_records(assignee_id);
CREATE INDEX IF NOT EXISTS idx_debt_records_status ON public.debt_records(status);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_record_id ON public.debt_payments(debt_record_id);

CREATE OR REPLACE FUNCTION public.sync_debt_record_amounts()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.amount_paid := COALESCE(NEW.amount_paid, 0);
  NEW.original_amount := COALESCE(NEW.original_amount, 0);
  NEW.commission_percentage := COALESCE(NEW.commission_percentage, 10);
  NEW.outstanding_amount := GREATEST(NEW.original_amount - NEW.amount_paid, 0);
  NEW.commission_amount := NEW.amount_paid * (NEW.commission_percentage / 100);
  NEW.updated_at := now();
  IF NEW.amount_paid <= 0 AND COALESCE(NEW.status,'unpaid') <> 'in_progress' THEN NEW.status := 'unpaid';
  ELSIF NEW.amount_paid >= NEW.original_amount AND NEW.original_amount > 0 THEN NEW.status := 'paid';
  ELSIF NEW.amount_paid > 0 THEN NEW.status := 'partial_paid';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.recalculate_debt_record(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE total_paid numeric := 0; target_amount numeric := 0; commission_pct numeric := 10; next_status text := 'unpaid';
BEGIN
  SELECT COALESCE(SUM(payment_amount),0) INTO total_paid FROM public.debt_payments WHERE debt_record_id = _id;
  SELECT original_amount, commission_percentage INTO target_amount, commission_pct FROM public.debt_records WHERE id = _id;
  IF NOT FOUND THEN RETURN; END IF;
  IF total_paid <= 0 THEN next_status := 'unpaid';
  ELSIF total_paid >= target_amount THEN next_status := 'paid';
  ELSE next_status := 'partial_paid'; END IF;
  UPDATE public.debt_records SET amount_paid=total_paid,
    outstanding_amount=GREATEST(target_amount-total_paid,0),
    commission_amount=total_paid*(commission_pct/100),
    status=next_status, updated_at=now()
  WHERE id=_id;
END; $$;

CREATE OR REPLACE FUNCTION public.recalculate_debt_record_from_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN PERFORM public.recalculate_debt_record(COALESCE(NEW.debt_record_id, OLD.debt_record_id)); RETURN COALESCE(NEW,OLD); END; $$;

DROP TRIGGER IF EXISTS trg_debt_records_sync_amounts ON public.debt_records;
CREATE TRIGGER trg_debt_records_sync_amounts BEFORE INSERT OR UPDATE ON public.debt_records FOR EACH ROW EXECUTE FUNCTION public.sync_debt_record_amounts();
DROP TRIGGER IF EXISTS trg_debt_payments_recalculate ON public.debt_payments;
CREATE TRIGGER trg_debt_payments_recalculate AFTER INSERT OR UPDATE OR DELETE ON public.debt_payments FOR EACH ROW EXECUTE FUNCTION public.recalculate_debt_record_from_payment();

ALTER TABLE public.debt_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage debt records" ON public.debt_records FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Assigned view debt records" ON public.debt_records FOR SELECT TO authenticated USING (assignee_id = auth.uid());
CREATE POLICY "Admins manage debt payments" ON public.debt_payments FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Assigned view debt payments" ON public.debt_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.debt_records d WHERE d.id = debt_record_id AND d.assignee_id = auth.uid()));

-- ============ CLIENT CHANNELS ============
CREATE TABLE IF NOT EXISTS public.client_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#FF6B35',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage channels" ON public.client_channels FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Auth view channels" ON public.client_channels FOR SELECT TO authenticated USING (true);

-- ============ CLIENT CREDENTIALS ============
CREATE TABLE IF NOT EXISTS public.client_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  label text NOT NULL,
  url text,
  username text,
  password text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage credentials" ON public.client_credentials FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Assigned reps view credentials" ON public.client_credentials FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rep_client_assignments rca WHERE rca.rep_id = auth.uid() AND rca.client_id = client_credentials.client_id AND rca.is_active = true));

-- ============ CLIENT DRIVE DOCS ============
CREATE TABLE IF NOT EXISTS public.client_drive_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  description text,
  doc_type text DEFAULT 'drive',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_drive_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage drive docs" ON public.client_drive_docs FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Assigned reps view drive docs" ON public.client_drive_docs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rep_client_assignments rca WHERE rca.rep_id = auth.uid() AND rca.client_id = client_drive_docs.client_id AND rca.is_active = true));
