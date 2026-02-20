export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          badge_color: string | null
          created_at: string | null
          description: string
          icon: string
          id: string
          name: string
          requirement_type: string
          requirement_value: number
          xp_reward: number | null
        }
        Insert: {
          badge_color?: string | null
          created_at?: string | null
          description: string
          icon: string
          id?: string
          name: string
          requirement_type: string
          requirement_value: number
          xp_reward?: number | null
        }
        Update: {
          badge_color?: string | null
          created_at?: string | null
          description?: string
          icon?: string
          id?: string
          name?: string
          requirement_type?: string
          requirement_value?: number
          xp_reward?: number | null
        }
        Relationships: []
      }
      activities: {
        Row: {
          activity_type: string
          client_id: string | null
          created_at: string | null
          deal_id: string | null
          description: string | null
          id: string
          rep_id: string
        }
        Insert: {
          activity_type: string
          client_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          description?: string | null
          id?: string
          rep_id: string
        }
        Update: {
          activity_type?: string
          client_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          description?: string | null
          id?: string
          rep_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string | null
          flat_commission_amount: number | null
          id: string
          industry: string | null
          is_active: boolean | null
          name: string
          notes: string | null
          revenue_model: Database["public"]["Enums"]["revenue_model_type"]
          revenue_share_percent: number | null
          start_date: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          flat_commission_amount?: number | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          name: string
          notes?: string | null
          revenue_model?: Database["public"]["Enums"]["revenue_model_type"]
          revenue_share_percent?: number | null
          start_date?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          flat_commission_amount?: number | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          name?: string
          notes?: string | null
          revenue_model?: Database["public"]["Enums"]["revenue_model_type"]
          revenue_share_percent?: number | null
          start_date?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      commission_rules: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          offer_id: string | null
          rule_type: string
          tier_max: number | null
          tier_min: number | null
          updated_at: string | null
          value: number
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          offer_id?: string | null
          rule_type?: string
          tier_max?: number | null
          tier_min?: number | null
          updated_at?: string | null
          value?: number
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          offer_id?: string | null
          rule_type?: string
          tier_max?: number | null
          tier_min?: number | null
          updated_at?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "commission_rules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_rules_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stages: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          is_terminal: boolean | null
          name: string
          sort_order: number
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          is_terminal?: boolean | null
          name: string
          sort_order?: number
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          is_terminal?: boolean | null
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "deal_stages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          campaign: string | null
          cape_neto_share: number | null
          channel: Database["public"]["Enums"]["deal_channel"] | null
          client_id: string
          client_share: number | null
          closed_at: string | null
          created_at: string | null
          gross_revenue: number | null
          id: string
          lead_contact: string | null
          lead_name: string | null
          lost_reason: string | null
          notes: string | null
          offer_id: string
          rep_commission: number | null
          rep_id: string
          revenue: number | null
          stage_entered_at: string | null
          stage_id: string | null
          status: Database["public"]["Enums"]["deal_status"]
          updated_at: string | null
        }
        Insert: {
          campaign?: string | null
          cape_neto_share?: number | null
          channel?: Database["public"]["Enums"]["deal_channel"] | null
          client_id: string
          client_share?: number | null
          closed_at?: string | null
          created_at?: string | null
          gross_revenue?: number | null
          id?: string
          lead_contact?: string | null
          lead_name?: string | null
          lost_reason?: string | null
          notes?: string | null
          offer_id: string
          rep_commission?: number | null
          rep_id: string
          revenue?: number | null
          stage_entered_at?: string | null
          stage_id?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          updated_at?: string | null
        }
        Update: {
          campaign?: string | null
          cape_neto_share?: number | null
          channel?: Database["public"]["Enums"]["deal_channel"] | null
          client_id?: string
          client_share?: number | null
          closed_at?: string | null
          created_at?: string | null
          gross_revenue?: number | null
          id?: string
          lead_contact?: string | null
          lead_name?: string | null
          lost_reason?: string | null
          notes?: string | null
          offer_id?: string
          rep_commission?: number | null
          rep_id?: string
          revenue?: number | null
          stage_entered_at?: string | null
          stage_id?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "deal_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_scores: {
        Row: {
          created_at: string | null
          id: string
          period_end: string
          period_start: string
          points: number
          rep_id: string
          score_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          period_end: string
          period_start: string
          points?: number
          rep_id: string
          score_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          period_end?: string
          period_start?: string
          points?: number
          rep_id?: string
          score_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      kpi_targets: {
        Row: {
          client_id: string | null
          created_at: string | null
          end_date: string | null
          id: string
          metric_name: string
          period: string | null
          rep_id: string | null
          start_date: string
          target_value: number
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          metric_name: string
          period?: string | null
          rep_id?: string | null
          start_date?: string
          target_value: number
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          metric_name?: string
          period?: string | null
          rep_id?: string | null
          start_date?: string
          target_value?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_targets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      lost_reasons: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      objections: {
        Row: {
          created_at: string | null
          deal_id: string
          id: string
          objection_text: string
          rep_id: string
          response_text: string | null
        }
        Insert: {
          created_at?: string | null
          deal_id: string
          id?: string
          objection_text: string
          rep_id: string
          response_text?: string | null
        }
        Update: {
          created_at?: string | null
          deal_id?: string
          id?: string
          objection_text?: string
          rep_id?: string
          response_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objections_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          campaign_source: string | null
          client_id: string
          created_at: string | null
          default_commission_percent: number | null
          id: string
          is_active: boolean | null
          name: string
          ticket_size: number
          updated_at: string | null
        }
        Insert: {
          campaign_source?: string | null
          client_id: string
          created_at?: string | null
          default_commission_percent?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          ticket_size?: number
          updated_at?: string | null
        }
        Update: {
          campaign_source?: string | null
          client_id?: string
          created_at?: string | null
          default_commission_percent?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          ticket_size?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          current_streak: number | null
          full_name: string
          id: string
          is_active: boolean | null
          level: number | null
          longest_streak: number | null
          total_xp: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          current_streak?: number | null
          full_name: string
          id?: string
          is_active?: boolean | null
          level?: number | null
          longest_streak?: number | null
          total_xp?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          current_streak?: number | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          level?: number | null
          longest_streak?: number | null
          total_xp?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rep_client_assignments: {
        Row: {
          client_id: string
          commission_percent: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          rep_id: string
        }
        Insert: {
          client_id: string
          commission_percent?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          rep_id: string
        }
        Update: {
          client_id?: string
          commission_percent?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          rep_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_client_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      scorecards: {
        Row: {
          calls_made: number | null
          campaign_id: string
          conversations_started: number
          created_at: string | null
          date: string
          follow_ups_sent: number
          id: string
          notes: string | null
          paid_registrations: number
          revenue_collected: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          calls_made?: number | null
          campaign_id: string
          conversations_started?: number
          created_at?: string | null
          date?: string
          follow_ups_sent?: number
          id?: string
          notes?: string | null
          paid_registrations?: number
          revenue_collected?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          calls_made?: number | null
          campaign_id?: string
          conversations_started?: number
          created_at?: string | null
          date?: string
          follow_ups_sent?: number
          id?: string
          notes?: string | null
          paid_registrations?: number
          revenue_collected?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scorecards_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      targets: {
        Row: {
          campaign_id: string
          conversations_target: number | null
          created_at: string | null
          end_date: string | null
          id: string
          paid_registrations_target: number | null
          role: Database["public"]["Enums"]["app_role"] | null
          start_date: string
          updated_at: string | null
        }
        Insert: {
          campaign_id: string
          conversations_target?: number | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          paid_registrations_target?: number | null
          role?: Database["public"]["Enums"]["app_role"] | null
          start_date: string
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string
          conversations_target?: number | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          paid_registrations_target?: number | null
          role?: Database["public"]["Enums"]["app_role"] | null
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "targets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          earned_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          earned_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "sales_rep" | "team_lead"
      deal_channel:
        | "organic"
        | "paid"
        | "dream_100"
        | "event"
        | "affiliate"
        | "referral"
        | "other"
      deal_status: "open" | "won" | "lost" | "stalled"
      revenue_model_type:
        | "revenue_share"
        | "flat_commission"
        | "tiered"
        | "hybrid"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "sales_rep", "team_lead"],
      deal_channel: [
        "organic",
        "paid",
        "dream_100",
        "event",
        "affiliate",
        "referral",
        "other",
      ],
      deal_status: ["open", "won", "lost", "stalled"],
      revenue_model_type: [
        "revenue_share",
        "flat_commission",
        "tiered",
        "hybrid",
      ],
    },
  },
} as const
