-- Create app_role enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'sales_rep', 'team_lead');

-- Profiles table for user info
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    total_xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'sales_rep',
    UNIQUE (user_id, role)
);

-- Campaigns table
CREATE TABLE public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT DEFAULT '#06b6d4',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Targets table (versioned by date range)
CREATE TABLE public.targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
    role app_role DEFAULT 'sales_rep',
    conversations_target INTEGER DEFAULT 15,
    paid_registrations_target NUMERIC(4,2) DEFAULT 0.5,
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Daily scorecards table
CREATE TABLE public.scorecards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    conversations_started INTEGER NOT NULL DEFAULT 0,
    follow_ups_sent INTEGER NOT NULL DEFAULT 0,
    paid_registrations INTEGER NOT NULL DEFAULT 0,
    calls_made INTEGER DEFAULT 0,
    revenue_collected NUMERIC(10,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, campaign_id, date)
);

-- Achievements table
CREATE TABLE public.achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    xp_reward INTEGER DEFAULT 100,
    badge_color TEXT DEFAULT '#fbbf24',
    requirement_type TEXT NOT NULL,
    requirement_value INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- User achievements (join table)
CREATE TABLE public.user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    achievement_id UUID REFERENCES public.achievements(id) ON DELETE CASCADE NOT NULL,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, achievement_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scorecards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.has_role(_user_id, 'admin')
$$;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update all profiles" ON public.profiles
    FOR UPDATE USING (public.is_admin(auth.uid()));

-- User roles policies
CREATE POLICY "Users can view their own roles" ON public.user_roles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
    FOR ALL USING (public.is_admin(auth.uid()));

-- Campaigns policies (everyone can view, only admins can modify)
CREATE POLICY "Everyone can view active campaigns" ON public.campaigns
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage campaigns" ON public.campaigns
    FOR ALL USING (public.is_admin(auth.uid()));

-- Targets policies
CREATE POLICY "Everyone can view targets" ON public.targets
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage targets" ON public.targets
    FOR ALL USING (public.is_admin(auth.uid()));

-- Scorecards policies
CREATE POLICY "Users can view their own scorecards" ON public.scorecards
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scorecards" ON public.scorecards
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scorecards" ON public.scorecards
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all scorecards" ON public.scorecards
    FOR SELECT USING (public.is_admin(auth.uid()));

-- Achievements policies
CREATE POLICY "Everyone can view achievements" ON public.achievements
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage achievements" ON public.achievements
    FOR ALL USING (public.is_admin(auth.uid()));

-- User achievements policies
CREATE POLICY "Users can view their own achievements" ON public.user_achievements
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all user achievements" ON public.user_achievements
    FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "System can insert user achievements" ON public.user_achievements
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON public.campaigns
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_targets_updated_at
    BEFORE UPDATE ON public.targets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scorecards_updated_at
    BEFORE UPDATE ON public.scorecards
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default campaigns
INSERT INTO public.campaigns (name, description, color) VALUES
    ('Platinum', 'Premium membership campaign', '#a855f7'),
    ('Amiri', 'Amiri product line campaign', '#06b6d4'),
    ('Creators', 'Creator partnership campaign', '#f59e0b');

-- Insert default achievements
INSERT INTO public.achievements (name, description, icon, xp_reward, badge_color, requirement_type, requirement_value) VALUES
    ('First Blood', 'Submit your first scorecard', '🎯', 50, '#22c55e', 'scorecards_submitted', 1),
    ('Week Warrior', '7-day submission streak', '🔥', 200, '#f59e0b', 'streak', 7),
    ('Conversation Starter', 'Hit 50 conversations total', '💬', 100, '#06b6d4', 'total_conversations', 50),
    ('Closer', 'Get 10 paid registrations', '💰', 300, '#a855f7', 'total_registrations', 10),
    ('Machine', '30-day submission streak', '⚡', 500, '#ef4444', 'streak', 30),
    ('Century Club', 'Hit 100 conversations in a day', '🏆', 250, '#fbbf24', 'daily_conversations', 100),
    ('Revenue King', 'Collect R10,000 total', '👑', 400, '#eab308', 'total_revenue', 10000),
    ('Consistency', 'Submit 30 scorecards', '📊', 150, '#8b5cf6', 'scorecards_submitted', 30);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'sales_rep');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();