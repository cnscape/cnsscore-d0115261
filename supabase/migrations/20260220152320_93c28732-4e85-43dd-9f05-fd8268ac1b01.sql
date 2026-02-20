
-- ===== NEW TABLES FOR SALES PERFORMANCE OPERATING SYSTEM =====

-- Revenue model enum
CREATE TYPE public.revenue_model_type AS ENUM ('revenue_share', 'flat_commission', 'tiered', 'hybrid');

-- Channel enum
CREATE TYPE public.deal_channel AS ENUM ('organic', 'paid', 'dream_100', 'event', 'affiliate', 'referral', 'other');

-- Deal status enum
CREATE TYPE public.deal_status AS ENUM ('open', 'won', 'lost', 'stalled');

-- ===== CLIENTS =====
CREATE TABLE public.clients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    industry text,
    start_date date NOT NULL DEFAULT CURRENT_DATE,
    revenue_model revenue_model_type NOT NULL DEFAULT 'revenue_share',
    revenue_share_percent numeric DEFAULT 0,
    flat_commission_amount numeric DEFAULT 0,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage clients" ON public.clients FOR ALL
    USING (public.is_admin(auth.uid()));
CREATE POLICY "Reps can view active clients" ON public.clients FOR SELECT
    USING (is_active = true);

-- ===== OFFERS =====
CREATE TABLE public.offers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    name text NOT NULL,
    ticket_size numeric NOT NULL DEFAULT 0,
    default_commission_percent numeric DEFAULT 10,
    campaign_source text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage offers" ON public.offers FOR ALL
    USING (public.is_admin(auth.uid()));
CREATE POLICY "Reps can view active offers" ON public.offers FOR SELECT
    USING (is_active = true);

-- ===== DEAL STAGES (customizable per client) =====
CREATE TABLE public.deal_stages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    name text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    is_terminal boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.deal_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage deal stages" ON public.deal_stages FOR ALL
    USING (public.is_admin(auth.uid()));
CREATE POLICY "Everyone can view deal stages" ON public.deal_stages FOR SELECT
    USING (true);

-- ===== DEALS =====
CREATE TABLE public.deals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id),
    offer_id uuid NOT NULL REFERENCES public.offers(id),
    rep_id uuid NOT NULL,
    stage_id uuid REFERENCES public.deal_stages(id),
    status deal_status NOT NULL DEFAULT 'open',
    channel deal_channel DEFAULT 'organic',
    campaign text,
    revenue numeric DEFAULT 0,
    gross_revenue numeric DEFAULT 0,
    client_share numeric DEFAULT 0,
    cape_neto_share numeric DEFAULT 0,
    rep_commission numeric DEFAULT 0,
    lost_reason text,
    lead_name text,
    lead_contact text,
    notes text,
    stage_entered_at timestamptz DEFAULT now(),
    closed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all deals" ON public.deals FOR ALL
    USING (public.is_admin(auth.uid()));
CREATE POLICY "Reps can view own deals" ON public.deals FOR SELECT
    USING (auth.uid() = rep_id);
CREATE POLICY "Reps can insert own deals" ON public.deals FOR INSERT
    WITH CHECK (auth.uid() = rep_id);
CREATE POLICY "Reps can update own deals" ON public.deals FOR UPDATE
    USING (auth.uid() = rep_id);

-- ===== REP-CLIENT ASSIGNMENTS =====
CREATE TABLE public.rep_client_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rep_id uuid NOT NULL,
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    commission_percent numeric DEFAULT 10,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    UNIQUE(rep_id, client_id)
);

ALTER TABLE public.rep_client_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage assignments" ON public.rep_client_assignments FOR ALL
    USING (public.is_admin(auth.uid()));
CREATE POLICY "Reps can view own assignments" ON public.rep_client_assignments FOR SELECT
    USING (auth.uid() = rep_id);

-- ===== COMMISSION RULES =====
CREATE TABLE public.commission_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
    offer_id uuid REFERENCES public.offers(id) ON DELETE CASCADE,
    rule_type text NOT NULL DEFAULT 'percent_of_gross',
    value numeric NOT NULL DEFAULT 10,
    tier_min numeric DEFAULT 0,
    tier_max numeric,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage commission rules" ON public.commission_rules FOR ALL
    USING (public.is_admin(auth.uid()));
CREATE POLICY "Reps can view commission rules" ON public.commission_rules FOR SELECT
    USING (true);

-- ===== ACTIVITIES =====
CREATE TABLE public.activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rep_id uuid NOT NULL,
    client_id uuid REFERENCES public.clients(id),
    deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
    activity_type text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all activities" ON public.activities FOR ALL
    USING (public.is_admin(auth.uid()));
CREATE POLICY "Reps can manage own activities" ON public.activities FOR SELECT
    USING (auth.uid() = rep_id);
CREATE POLICY "Reps can insert own activities" ON public.activities FOR INSERT
    WITH CHECK (auth.uid() = rep_id);

-- ===== OBJECTIONS =====
CREATE TABLE public.objections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
    rep_id uuid NOT NULL,
    objection_text text NOT NULL,
    response_text text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.objections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all objections" ON public.objections FOR ALL
    USING (public.is_admin(auth.uid()));
CREATE POLICY "Reps can manage own objections" ON public.objections FOR SELECT
    USING (auth.uid() = rep_id);
CREATE POLICY "Reps can insert own objections" ON public.objections FOR INSERT
    WITH CHECK (auth.uid() = rep_id);

-- ===== LOST REASONS =====
CREATE TABLE public.lost_reasons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.lost_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage lost reasons" ON public.lost_reasons FOR ALL
    USING (public.is_admin(auth.uid()));
CREATE POLICY "Everyone can view lost reasons" ON public.lost_reasons FOR SELECT
    USING (true);

-- ===== KPI TARGETS (per client) =====
CREATE TABLE public.kpi_targets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
    rep_id uuid,
    metric_name text NOT NULL,
    target_value numeric NOT NULL,
    period text DEFAULT 'daily',
    start_date date NOT NULL DEFAULT CURRENT_DATE,
    end_date date,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.kpi_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage kpi targets" ON public.kpi_targets FOR ALL
    USING (public.is_admin(auth.uid()));
CREATE POLICY "Everyone can view kpi targets" ON public.kpi_targets FOR SELECT
    USING (true);

-- ===== GAMIFICATION SCORES =====
CREATE TABLE public.gamification_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rep_id uuid NOT NULL,
    score_type text NOT NULL,
    points integer NOT NULL DEFAULT 0,
    period_start date NOT NULL,
    period_end date NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(rep_id, score_type, period_start)
);

ALTER TABLE public.gamification_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage gamification scores" ON public.gamification_scores FOR ALL
    USING (public.is_admin(auth.uid()));
CREATE POLICY "Reps can view own scores" ON public.gamification_scores FOR SELECT
    USING (auth.uid() = rep_id);
CREATE POLICY "Everyone can view scores for leaderboard" ON public.gamification_scores FOR SELECT
    USING (true);

-- ===== TRIGGERS for updated_at =====
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_offers_updated_at BEFORE UPDATE ON public.offers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_commission_rules_updated_at BEFORE UPDATE ON public.commission_rules
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_kpi_targets_updated_at BEFORE UPDATE ON public.kpi_targets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gamification_scores_updated_at BEFORE UPDATE ON public.gamification_scores
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== SEED: default lost reasons =====
INSERT INTO public.lost_reasons (name) VALUES
    ('Price too high'),
    ('Not ready to buy'),
    ('Went with competitor'),
    ('No response'),
    ('Bad timing'),
    ('Not a fit'),
    ('Other');

-- ===== SEED: default deal stages template =====
-- These will be cloned per client when created
