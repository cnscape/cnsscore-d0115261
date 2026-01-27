export type AppRole = 'admin' | 'sales_rep' | 'team_lead';

export type RAGStatus = 'green' | 'amber' | 'red';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  is_active: boolean;
  current_streak: number;
  longest_streak: number;
  total_xp: number;
  level: number;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Target {
  id: string;
  campaign_id: string;
  role: AppRole;
  conversations_target: number;
  paid_registrations_target: number;
  start_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Scorecard {
  id: string;
  user_id: string;
  campaign_id: string;
  date: string;
  conversations_started: number;
  follow_ups_sent: number;
  paid_registrations: number;
  calls_made: number | null;
  revenue_collected: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  xp_reward: number;
  badge_color: string;
  requirement_type: string;
  requirement_value: number;
  created_at: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  earned_at: string;
}

export interface ScorecardWithCampaign extends Scorecard {
  campaigns: Campaign;
}

export interface UserWithProfile {
  profile: Profile;
  roles: AppRole[];
}
