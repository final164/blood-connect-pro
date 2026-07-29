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
      app_settings: {
        Row: {
          allow_anon_read: boolean
          app_name: string
          default_language: string
          emergency_hotline: string | null
          google_maps_api_key: string | null
          id: number
          updated_at: string
        }
        Insert: {
          allow_anon_read?: boolean
          app_name?: string
          default_language?: string
          emergency_hotline?: string | null
          google_maps_api_key?: string | null
          id?: number
          updated_at?: string
        }
        Update: {
          allow_anon_read?: boolean
          app_name?: string
          default_language?: string
          emergency_hotline?: string | null
          google_maps_api_key?: string | null
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      blood_requests: {
        Row: {
          area: string | null
          bags_needed: number
          blood_group: Database["public"]["Enums"]["blood_group"]
          city: string
          contact_phone: string
          created_at: string
          hospital_name: string
          id: string
          latitude: number | null
          longitude: number | null
          needed_by: string
          notes: string | null
          patient_name: string
          requester_id: string
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
          urgency: Database["public"]["Enums"]["urgency"]
        }
        Insert: {
          area?: string | null
          bags_needed?: number
          blood_group: Database["public"]["Enums"]["blood_group"]
          city: string
          contact_phone: string
          created_at?: string
          hospital_name: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          needed_by: string
          notes?: string | null
          patient_name: string
          requester_id: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency"]
        }
        Update: {
          area?: string | null
          bags_needed?: number
          blood_group?: Database["public"]["Enums"]["blood_group"]
          city?: string
          contact_phone?: string
          created_at?: string
          hospital_name?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          needed_by?: string
          notes?: string | null
          patient_name?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency"]
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      donations: {
        Row: {
          bags: number
          confirmed: boolean
          created_at: string
          donation_date: string
          donor_id: string
          id: string
          notes: string | null
          recipient_id: string | null
          request_id: string | null
        }
        Insert: {
          bags?: number
          confirmed?: boolean
          created_at?: string
          donation_date?: string
          donor_id: string
          id?: string
          notes?: string | null
          recipient_id?: string | null
          request_id?: string | null
        }
        Update: {
          bags?: number
          confirmed?: boolean
          created_at?: string
          donation_date?: string
          donor_id?: string
          id?: string
          notes?: string | null
          recipient_id?: string | null
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "blood_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "blood_requests_public"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          ciphertext: string
          conversation_id: string
          created_at: string
          id: string
          is_encrypted: boolean
          iv: string | null
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          ciphertext: string
          conversation_id: string
          created_at?: string
          id?: string
          is_encrypted?: boolean
          iv?: string | null
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          ciphertext?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_encrypted?: boolean
          iv?: string | null
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          id: string
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notif_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notif_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notif_type"]
          user_id?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          post_type: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          post_type?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          post_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          area: string | null
          avatar_url: string | null
          bio: string | null
          blood_group: Database["public"]["Enums"]["blood_group"] | null
          city: string | null
          created_at: string
          date_of_birth: string | null
          e2ee_public_key: string | null
          full_name: string | null
          gender: string | null
          id: string
          is_available: boolean
          is_donor: boolean
          is_recipient: boolean
          is_verified: boolean
          last_donation_date: string | null
          latitude: number | null
          lives_saved: number
          longitude: number | null
          medical_conditions_encrypted: string | null
          phone: string | null
          total_donations: number
          updated_at: string
          username: string | null
          weight_kg: number | null
        }
        Insert: {
          area?: string | null
          avatar_url?: string | null
          bio?: string | null
          blood_group?: Database["public"]["Enums"]["blood_group"] | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          e2ee_public_key?: string | null
          full_name?: string | null
          gender?: string | null
          id: string
          is_available?: boolean
          is_donor?: boolean
          is_recipient?: boolean
          is_verified?: boolean
          last_donation_date?: string | null
          latitude?: number | null
          lives_saved?: number
          longitude?: number | null
          medical_conditions_encrypted?: string | null
          phone?: string | null
          total_donations?: number
          updated_at?: string
          username?: string | null
          weight_kg?: number | null
        }
        Update: {
          area?: string | null
          avatar_url?: string | null
          bio?: string | null
          blood_group?: Database["public"]["Enums"]["blood_group"] | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          e2ee_public_key?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          is_available?: boolean
          is_donor?: boolean
          is_recipient?: boolean
          is_verified?: boolean
          last_donation_date?: string | null
          latitude?: number | null
          lives_saved?: number
          longitude?: number | null
          medical_conditions_encrypted?: string | null
          phone?: string | null
          total_donations?: number
          updated_at?: string
          username?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          e2ee_enabled: boolean
          e2ee_private_key_encrypted: string | null
          language: string
          notif_email: boolean
          notif_new_request: boolean
          notif_push: boolean
          radius_km: number
          share_location: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          e2ee_enabled?: boolean
          e2ee_private_key_encrypted?: string | null
          language?: string
          notif_email?: boolean
          notif_new_request?: boolean
          notif_push?: boolean
          radius_km?: number
          share_location?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          e2ee_enabled?: boolean
          e2ee_private_key_encrypted?: string | null
          language?: string
          notif_email?: boolean
          notif_new_request?: boolean
          notif_push?: boolean
          radius_km?: number
          share_location?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      blood_requests_public: {
        Row: {
          area: string | null
          bags_needed: number | null
          blood_group: Database["public"]["Enums"]["blood_group"] | null
          city: string | null
          contact_phone: string | null
          created_at: string | null
          hospital_name: string | null
          id: string | null
          latitude: number | null
          longitude: number | null
          needed_by: string | null
          notes: string | null
          patient_name: string | null
          requester_id: string | null
          status: Database["public"]["Enums"]["request_status"] | null
          updated_at: string | null
          urgency: Database["public"]["Enums"]["urgency"] | null
        }
        Insert: {
          area?: string | null
          bags_needed?: number | null
          blood_group?: Database["public"]["Enums"]["blood_group"] | null
          city?: string | null
          contact_phone?: never
          created_at?: string | null
          hospital_name?: string | null
          id?: string | null
          latitude?: number | null
          longitude?: number | null
          needed_by?: string | null
          notes?: string | null
          patient_name?: string | null
          requester_id?: string | null
          status?: Database["public"]["Enums"]["request_status"] | null
          updated_at?: string | null
          urgency?: Database["public"]["Enums"]["urgency"] | null
        }
        Update: {
          area?: string | null
          bags_needed?: number | null
          blood_group?: Database["public"]["Enums"]["blood_group"] | null
          city?: string | null
          contact_phone?: never
          created_at?: string | null
          hospital_name?: string | null
          id?: string | null
          latitude?: number | null
          longitude?: number | null
          needed_by?: string | null
          notes?: string | null
          patient_name?: string | null
          requester_id?: string | null
          status?: Database["public"]["Enums"]["request_status"] | null
          updated_at?: string | null
          urgency?: Database["public"]["Enums"]["urgency"] | null
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          area: string | null
          avatar_url: string | null
          bio: string | null
          blood_group: Database["public"]["Enums"]["blood_group"] | null
          city: string | null
          created_at: string | null
          e2ee_public_key: string | null
          full_name: string | null
          id: string | null
          is_available: boolean | null
          is_donor: boolean | null
          is_recipient: boolean | null
          is_verified: boolean | null
          lives_saved: number | null
          total_donations: number | null
          username: string | null
        }
        Insert: {
          area?: string | null
          avatar_url?: string | null
          bio?: string | null
          blood_group?: Database["public"]["Enums"]["blood_group"] | null
          city?: string | null
          created_at?: string | null
          e2ee_public_key?: string | null
          full_name?: string | null
          id?: string | null
          is_available?: boolean | null
          is_donor?: boolean | null
          is_recipient?: boolean | null
          is_verified?: boolean | null
          lives_saved?: number | null
          total_donations?: number | null
          username?: string | null
        }
        Update: {
          area?: string | null
          avatar_url?: string | null
          bio?: string | null
          blood_group?: Database["public"]["Enums"]["blood_group"] | null
          city?: string | null
          created_at?: string | null
          e2ee_public_key?: string | null
          full_name?: string | null
          id?: string | null
          is_available?: boolean | null
          is_donor?: boolean | null
          is_recipient?: boolean | null
          is_verified?: boolean | null
          lives_saved?: number | null
          total_donations?: number | null
          username?: string | null
        }
        Relationships: []
      }
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
      app_role: "admin" | "moderator" | "user"
      blood_group: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-"
      notif_type:
        | "request_match"
        | "new_message"
        | "post_like"
        | "post_comment"
        | "follow"
        | "donation_confirmed"
        | "system"
      request_status: "open" | "fulfilled" | "cancelled" | "expired"
      urgency: "normal" | "urgent" | "critical"
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
      app_role: ["admin", "moderator", "user"],
      blood_group: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      notif_type: [
        "request_match",
        "new_message",
        "post_like",
        "post_comment",
        "follow",
        "donation_confirmed",
        "system",
      ],
      request_status: ["open", "fulfilled", "cancelled", "expired"],
      urgency: ["normal", "urgent", "critical"],
    },
  },
} as const
