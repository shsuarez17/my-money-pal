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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      fx_rates: {
        Row: {
          pair: string
          rate: number
          updated_at: string
        }
        Insert: {
          pair: string
          rate: number
          updated_at?: string
        }
        Update: {
          pair?: string
          rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      goal_contributions: {
        Row: {
          amount_usd: number
          created_at: string
          currency: string
          goal_id: string
          id: string
          occurred_at: string
          user_id: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          currency?: string
          goal_id: string
          id?: string
          occurred_at?: string
          user_id: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          currency?: string
          goal_id?: string
          id?: string
          occurred_at?: string
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          color: string | null
          created_at: string
          currency: string
          id: string
          name: string
          start_date: string | null
          target_amount_usd: number
          target_date: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          currency?: string
          id?: string
          name: string
          start_date?: string | null
          target_amount_usd: number
          target_date?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          currency?: string
          id?: string
          name?: string
          start_date?: string | null
          target_amount_usd?: number
          target_date?: string | null
          user_id?: string
        }
        Relationships: []
      }
      investments: {
        Row: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          avg_cost_usd: number
          created_at: string
          currency: string
          current_price_usd: number
          external_id: string | null
          id: string
          name: string
          notes: string | null
          platform: string | null
          price_updated_at: string | null
          purchase_date: string
          quantity: number
          source: string | null
          ticker: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          avg_cost_usd?: number
          created_at?: string
          currency?: string
          current_price_usd?: number
          external_id?: string | null
          id?: string
          name: string
          notes?: string | null
          platform?: string | null
          price_updated_at?: string | null
          purchase_date?: string
          quantity?: number
          source?: string | null
          ticker: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["asset_type"]
          avg_cost_usd?: number
          created_at?: string
          currency?: string
          current_price_usd?: number
          external_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          platform?: string | null
          price_updated_at?: string | null
          purchase_date?: string
          quantity?: number
          source?: string | null
          ticker?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      portfolio_snapshots: {
        Row: {
          created_at: string
          id: string
          invested_usd: number
          snapshot_date: string
          total_cop: number
          total_usd: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invested_usd: number
          snapshot_date: string
          total_cop: number
          total_usd: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invested_usd?: number
          snapshot_date?: string
          total_cop?: number
          total_usd?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          base_currency: string
          created_at: string
          custom_asset_types: string[]
          display_name: string | null
          id: string
          language: string
          updated_at: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          custom_asset_types?: string[]
          display_name?: string | null
          id: string
          language?: string
          updated_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          custom_asset_types?: string[]
          display_name?: string | null
          id?: string
          language?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_contributions: {
        Row: {
          active: boolean
          amount_usd: number
          asset_category: string | null
          created_at: string
          currency: string
          frequency: Database["public"]["Enums"]["recur_freq"]
          goal_id: string | null
          id: string
          investment_id: string | null
          last_run: string | null
          next_run: string
          user_id: string
        }
        Insert: {
          active?: boolean
          amount_usd: number
          asset_category?: string | null
          created_at?: string
          currency?: string
          frequency: Database["public"]["Enums"]["recur_freq"]
          goal_id?: string | null
          id?: string
          investment_id?: string | null
          last_run?: string | null
          next_run: string
          user_id: string
        }
        Update: {
          active?: boolean
          amount_usd?: number
          asset_category?: string | null
          created_at?: string
          currency?: string
          frequency?: Database["public"]["Enums"]["recur_freq"]
          goal_id?: string | null
          id?: string
          investment_id?: string | null
          last_run?: string | null
          next_run?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_contributions_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
        ]
      }
      snaptrade_users: {
        Row: {
          created_at: string
          snaptrade_user_id: string
          user_id: string
          user_secret: string
        }
        Insert: {
          created_at?: string
          snaptrade_user_id: string
          user_id: string
          user_secret: string
        }
        Update: {
          created_at?: string
          snaptrade_user_id?: string
          user_id?: string
          user_secret?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount_usd: number
          created_at: string
          fx_usd_cop: number | null
          id: string
          investment_id: string | null
          note: string | null
          occurred_at: string
          price_usd: number
          quantity: number
          tx_type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }
        Insert: {
          amount_usd?: number
          created_at?: string
          fx_usd_cop?: number | null
          id?: string
          investment_id?: string | null
          note?: string | null
          occurred_at?: string
          price_usd?: number
          quantity?: number
          tx_type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          fx_usd_cop?: number | null
          id?: string
          investment_id?: string | null
          note?: string | null
          occurred_at?: string
          price_usd?: number
          quantity?: number
          tx_type?: Database["public"]["Enums"]["tx_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      asset_type: "STOCK_US" | "STOCK_CO" | "ETF" | "CRYPTO" | "BOND" | "OTHER"
      recur_freq: "WEEKLY" | "BIWEEKLY" | "MONTHLY"
      tx_type: "BUY" | "SELL" | "DEPOSIT" | "DIVIDEND"
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
      asset_type: ["STOCK_US", "STOCK_CO", "ETF", "CRYPTO", "BOND", "OTHER"],
      recur_freq: ["WEEKLY", "BIWEEKLY", "MONTHLY"],
      tx_type: ["BUY", "SELL", "DEPOSIT", "DIVIDEND"],
    },
  },
} as const
