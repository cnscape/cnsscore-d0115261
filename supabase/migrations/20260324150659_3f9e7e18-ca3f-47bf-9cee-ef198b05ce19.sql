
-- Pipeline leads table
CREATE TABLE public.pipeline_leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL,
    lead_name text NOT NULL,
    lead_contact text,
    platform text DEFAULT 'LinkedIn',
    lead_score text DEFAULT 'B' CHECK (lead_score IN ('A', 'B')),
    stage text NOT NULL DEFAULT 'new_lead' CHECK (stage IN ('new_lead', 'dm_sent', 'responded', 'discovery_booked', 'presentation', 'follow_up', 'closed_won', 'closed_lost')),
    follow_ups_completed integer DEFAULT 0,
    max_follow_ups integer DEFAULT 8,
    call_outcome text CHECK (call_outcome IN ('won', 'follow_up', 'lost', NULL)),
    notes text,
    deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
    last_activity_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.pipeline_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all leads" ON public.pipeline_leads FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Reps can view own leads" ON public.pipeline_leads FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Reps can insert own leads" ON public.pipeline_leads FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Reps can update own leads" ON public.pipeline_leads FOR UPDATE USING (auth.uid() = owner_id);

-- Lead activities table
CREATE TABLE public.lead_activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id uuid NOT NULL REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    activity_type text NOT NULL CHECK (activity_type IN ('dm_sent', 'reply_received', 'call_made', 'follow_up', 'note', 'stage_change', 'meeting_booked', 'meeting_held')),
    description text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all lead activities" ON public.lead_activities FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can view own lead activities" ON public.lead_activities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own lead activities" ON public.lead_activities FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Playbook sections (admin-curated content)
CREATE TABLE public.playbook_sections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    category text NOT NULL DEFAULT 'outreach' CHECK (category IN ('outreach', 'messaging', 'qualification', 'call_structure', 'closing', 'follow_up')),
    content text NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.playbook_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage playbook" ON public.playbook_sections FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Everyone can view playbook" ON public.playbook_sections FOR SELECT TO authenticated USING (true);

-- Training & SOPs table
CREATE TABLE public.training_resources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    category text NOT NULL DEFAULT 'training' CHECK (category IN ('sop', 'training', 'call_review', 'onboarding')),
    content_type text NOT NULL DEFAULT 'link' CHECK (content_type IN ('link', 'video', 'document')),
    content_url text NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.training_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage training" ON public.training_resources FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Everyone can view training" ON public.training_resources FOR SELECT TO authenticated USING (true);
