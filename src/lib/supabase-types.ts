export type AppRole = 'admin' | 'sales_rep' | 'team_lead' | 'scout';

export type RAGStatus = 'green' | 'amber' | 'red';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
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
  client_id: string | null;
  paused_at: string | null;
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

export type DealStatus = 'open' | 'won' | 'lost' | 'stalled';
export type DealChannel = 'organic' | 'paid' | 'referral' | 'call' | 'phone' | 'email' | string;

export interface Deal {
  id: string;
  client_id: string;
  offer_id: string;
  rep_id: string;
  stage_id: string | null;
  status: DealStatus;
  channel: DealChannel | null;
  campaign: string | null;
  revenue: number | null;
  gross_revenue: number | null;
  client_share: number | null;
  cape_neto_share: number | null;
  rep_commission: number | null;
  commission_percent: number | null;
  lead_name: string | null;
  lead_contact: string | null;
  lead_link: string | null;
  notes: string | null;
  lost_reason_id: string | null;
  stage_entered_at: string | null;
  closed_at: string | null;
  // New schema additions
  expected_close_date: string | null;
  close_date_pushed_count: number | null;
  discount_percent: number | null;
  created_at: string;
  updated_at: string;
}

export interface DealStageHistory {
  id: number;
  deal_id: string;
  stage_name: string;
  entered_at: string | null;
  exited_at: string | null;
}

export interface StaleLead {
  id: string;
  lead_name: string | null;
  lead_contact: string | null;
  last_activity_at: string | null;
  days_inactive: number | null;
}

export interface StageVelocityRow {
  deal_id: string;
  stage_name: string;
  entered_at: string | null;
  exited_at: string | null;
  days_spent: number | null;
}

export interface StageVelocityAverage {
  stage_name: string;
  avg_days: number;
  sample_size: number;
}
