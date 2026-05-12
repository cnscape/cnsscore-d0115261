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

CREATE OR REPLACE FUNCTION public.recalculate_debt_record(_debt_record_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_paid numeric := 0;
  target_amount numeric := 0;
  commission_pct numeric := 10;
  next_status text := 'unpaid';
BEGIN
  SELECT COALESCE(SUM(payment_amount), 0) INTO total_paid FROM public.debt_payments WHERE debt_record_id = _debt_record_id;
  SELECT original_amount, commission_percentage INTO target_amount, commission_pct FROM public.debt_records WHERE id = _debt_record_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF total_paid <= 0 THEN next_status := 'unpaid'; ELSIF total_paid >= target_amount THEN next_status := 'paid'; ELSE next_status := 'partial_paid'; END IF;
  UPDATE public.debt_records
  SET amount_paid = total_paid,
      outstanding_amount = GREATEST(target_amount - total_paid, 0),
      commission_amount = total_paid * (commission_pct / 100),
      status = next_status,
      updated_at = now()
  WHERE id = _debt_record_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_debt_record_amounts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.amount_paid := COALESCE(NEW.amount_paid, 0);
  NEW.original_amount := COALESCE(NEW.original_amount, 0);
  NEW.commission_percentage := COALESCE(NEW.commission_percentage, 10);
  NEW.outstanding_amount := GREATEST(NEW.original_amount - NEW.amount_paid, 0);
  NEW.commission_amount := NEW.amount_paid * (NEW.commission_percentage / 100);
  NEW.updated_at := now();
  IF NEW.amount_paid <= 0 AND COALESCE(NEW.status, 'unpaid') <> 'in_progress' THEN NEW.status := 'unpaid';
  ELSIF NEW.amount_paid >= NEW.original_amount AND NEW.original_amount > 0 THEN NEW.status := 'paid';
  ELSIF NEW.amount_paid > 0 THEN NEW.status := 'partial_paid';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_debt_record_from_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.recalculate_debt_record(COALESCE(NEW.debt_record_id, OLD.debt_record_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_debt_records_sync_amounts ON public.debt_records;
CREATE TRIGGER trg_debt_records_sync_amounts BEFORE INSERT OR UPDATE ON public.debt_records FOR EACH ROW EXECUTE FUNCTION public.sync_debt_record_amounts();

DROP TRIGGER IF EXISTS trg_debt_payments_recalculate ON public.debt_payments;
CREATE TRIGGER trg_debt_payments_recalculate AFTER INSERT OR UPDATE OR DELETE ON public.debt_payments FOR EACH ROW EXECUTE FUNCTION public.recalculate_debt_record_from_payment();

ALTER TABLE public.debt_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage debt records" ON public.debt_records;
CREATE POLICY "Admins manage debt records" ON public.debt_records FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins manage debt payments" ON public.debt_payments;
CREATE POLICY "Admins manage debt payments" ON public.debt_payments FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
