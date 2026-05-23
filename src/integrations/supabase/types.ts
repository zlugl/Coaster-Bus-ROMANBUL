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
      buses: {
        Row: {
          capacity: number
          created_at: string
          current_lat: number | null
          current_lng: number | null
          departure_time: string | null
          driver_id: string | null
          eta_minutes: number
          id: string
          plate_number: string
          route_id: string | null
          status: Database["public"]["Enums"]["bus_status"]
        }
        Insert: {
          capacity?: number
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          departure_time?: string | null
          driver_id?: string | null
          eta_minutes?: number
          id?: string
          plate_number: string
          route_id?: string | null
          status?: Database["public"]["Enums"]["bus_status"]
        }
        Update: {
          capacity?: number
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          departure_time?: string | null
          driver_id?: string | null
          eta_minutes?: number
          id?: string
          plate_number?: string
          route_id?: string | null
          status?: Database["public"]["Enums"]["bus_status"]
        }
        Relationships: [
          {
            foreignKeyName: "buses_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          student_id: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          student_id?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          student_id?: string | null
        }
        Relationships: []
      }
      routes: {
        Row: {
          created_at: string
          dest_lat: number | null
          dest_lng: number | null
          destination: string
          fare: number
          id: string
          name: string
          origin: string
          origin_lat: number | null
          origin_lng: number | null
        }
        Insert: {
          created_at?: string
          dest_lat?: number | null
          dest_lng?: number | null
          destination: string
          fare?: number
          id?: string
          name: string
          origin: string
          origin_lat?: number | null
          origin_lng?: number | null
        }
        Update: {
          created_at?: string
          dest_lat?: number | null
          dest_lng?: number | null
          destination?: string
          fare?: number
          id?: string
          name?: string
          origin?: string
          origin_lat?: number | null
          origin_lng?: number | null
        }
        Relationships: []
      }
      bus_gcash: {
        Row: {
          id: string
          bus_id: string
          gcash_number: string
          updated_at: string
        }
        Insert: {
          id?: string
          bus_id: string
          gcash_number?: string
          updated_at?: string
        }
        Update: {
          id?: string
          bus_id?: string
          gcash_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bus_gcash_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: true
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          bus_id: string
          created_at: string
          id: string
          queue_position: number
          seat_number: number | null
          preferred_seat: number | null
          pickup_type: Database["public"]["Enums"]["pickup_type"]
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          status: Database["public"]["Enums"]["ticket_status"]
          ticket_code: string
          user_id: string
        }
        Insert: {
          bus_id: string
          created_at?: string
          id?: string
          queue_position: number
          seat_number?: number | null
          preferred_seat?: number | null
          pickup_type?: Database["public"]["Enums"]["pickup_type"]
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_code?: string
          user_id: string
        }
        Update: {
          bus_id?: string
          created_at?: string
          id?: string
          queue_position?: number
          seat_number?: number | null
          preferred_seat?: number | null
          pickup_type?: Database["public"]["Enums"]["pickup_type"]
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
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
          role: Database["public"]["Enums"]["app_role"]
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
    }
    Enums: {
      app_role: "admin" | "operator" | "student" | "driver" | "conductor"
      bus_status: "boarding" | "in_transit" | "arrived" | "idle"
      pickup_type: "highway" | "terminal"
      payment_method: "cash" | "gcash"
      payment_status: "pending" | "paid"
      ticket_status:
        | "queued"
        | "confirmed"
        | "boarded"
        | "completed"
        | "cancelled"
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
      app_role: ["admin", "operator", "student", "driver", "conductor"],
      bus_status: ["boarding", "in_transit", "arrived", "idle"],
      pickup_type: ["highway", "terminal"],
      payment_method: ["cash", "gcash"],
      payment_status: ["pending", "paid"],
      ticket_status: [
        "queued",
        "confirmed",
        "boarded",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
