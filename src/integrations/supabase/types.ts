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
      admin_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          id: string
          payload: Json
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          metadata: Json
          read: boolean
          severity: string
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          read?: boolean
          severity?: string
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          read?: boolean
          severity?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      ai_reports: {
        Row: {
          content: string
          created_at: string
          id: string
          kind: string
          metrics: Json
          report_date: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          kind?: string
          metrics?: Json
          report_date?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          kind?: string
          metrics?: Json
          report_date?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          button_link: string | null
          button_text: string | null
          created_at: string
          created_by: string | null
          description: string
          emailed_at: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          placements: string[]
          priority: number
          send_email: boolean
          starts_at: string
          status: string
          target_games: string[]
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          button_link?: string | null
          button_text?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          emailed_at?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          placements?: string[]
          priority?: number
          send_email?: boolean
          starts_at?: string
          status?: string
          target_games?: string[]
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          button_link?: string | null
          button_text?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          emailed_at?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          placements?: string[]
          priority?: number
          send_email?: boolean
          starts_at?: string
          status?: string
          target_games?: string[]
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      assistant_chats: {
        Row: {
          answer: string
          created_at: string
          id: string
          question: string
          rating: number | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          question: string
          rating?: number | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          question?: string
          rating?: number | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      assistant_faqs: {
        Row: {
          active: boolean
          answer: string
          category: string
          created_at: string
          id: string
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          answer: string
          category?: string
          created_at?: string
          id?: string
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          answer?: string
          category?: string
          created_at?: string
          id?: string
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      assistant_settings: {
        Row: {
          enabled: boolean
          extra_instructions: string | null
          id: number
          supported_games: string[]
          updated_at: string
          welcome_message: string
        }
        Insert: {
          enabled?: boolean
          extra_instructions?: string | null
          id?: number
          supported_games?: string[]
          updated_at?: string
          welcome_message?: string
        }
        Update: {
          enabled?: boolean
          extra_instructions?: string | null
          id?: number
          supported_games?: string[]
          updated_at?: string
          welcome_message?: string
        }
        Relationships: []
      }
      assistant_thread_messages: {
        Row: {
          attachments: Json
          content: string
          created_at: string
          id: string
          role: string
          sources: Json
          thread_id: string
          user_id: string
        }
        Insert: {
          attachments?: Json
          content: string
          created_at?: string
          id?: string
          role: string
          sources?: Json
          thread_id: string
          user_id: string
        }
        Update: {
          attachments?: Json
          content?: string
          created_at?: string
          id?: string
          role?: string
          sources?: Json
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_thread_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "assistant_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_threads: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          last_message: string | null
          last_message_at: string
          pinned: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          active: boolean
          button_link: string | null
          button_text: string | null
          created_at: string
          ends_at: string | null
          id: string
          image_url: string
          priority: number
          starts_at: string
          subtitle: string
          target_game: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          button_link?: string | null
          button_text?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url: string
          priority?: number
          starts_at?: string
          subtitle?: string
          target_game?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          button_link?: string | null
          button_text?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url?: string
          priority?: number
          starts_at?: string
          subtitle?: string
          target_game?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalog_products: {
        Row: {
          auto_pricing: boolean
          auto_status: boolean
          category: string | null
          category_id: string | null
          competitor_price_inr: number | null
          created_at: string
          description: string | null
          display_status: string
          featured: boolean
          id: string
          image_url: string | null
          low_stock_threshold: number
          min_safe_price_inr: number | null
          name: string | null
          price_inr: number
          product_slug: string
          product_type: string
          sort_order: number
          status: string
          stock: number
          stock_status: string
          supplier_cost_inr: number
          supplier_id: string | null
          supplier_name: string | null
          supplier_url: string | null
          tier_label: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          auto_pricing?: boolean
          auto_status?: boolean
          category?: string | null
          category_id?: string | null
          competitor_price_inr?: number | null
          created_at?: string
          description?: string | null
          display_status?: string
          featured?: boolean
          id?: string
          image_url?: string | null
          low_stock_threshold?: number
          min_safe_price_inr?: number | null
          name?: string | null
          price_inr?: number
          product_slug: string
          product_type?: string
          sort_order?: number
          status?: string
          stock?: number
          stock_status?: string
          supplier_cost_inr?: number
          supplier_id?: string | null
          supplier_name?: string | null
          supplier_url?: string | null
          tier_label: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          auto_pricing?: boolean
          auto_status?: boolean
          category?: string | null
          category_id?: string | null
          competitor_price_inr?: number | null
          created_at?: string
          description?: string | null
          display_status?: string
          featured?: boolean
          id?: string
          image_url?: string | null
          low_stock_threshold?: number
          min_safe_price_inr?: number | null
          name?: string | null
          price_inr?: number
          product_slug?: string
          product_type?: string
          sort_order?: number
          status?: string
          stock?: number
          stock_status?: string
          supplier_cost_inr?: number
          supplier_id?: string | null
          supplier_name?: string | null
          supplier_url?: string | null
          tier_label?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "catalog_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_flags: {
        Row: {
          ban_reason: string | null
          banned: boolean
          created_at: string
          internal_notes: string | null
          updated_at: string
          user_id: string
          vip_level: string
        }
        Insert: {
          ban_reason?: string | null
          banned?: boolean
          created_at?: string
          internal_notes?: string | null
          updated_at?: string
          user_id: string
          vip_level?: string
        }
        Update: {
          ban_reason?: string | null
          banned?: boolean
          created_at?: string
          internal_notes?: string | null
          updated_at?: string
          user_id?: string
          vip_level?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      game_news: {
        Row: {
          category: string
          created_at: string
          game_slug: string
          id: string
          published_at: string
          source_url: string | null
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          game_slug: string
          id?: string
          published_at?: string
          source_url?: string | null
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          game_slug?: string
          id?: string
          published_at?: string
          source_url?: string | null
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      game_servers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          label: string
          product_slug: string
          server_code: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          label: string
          product_slug: string
          server_code: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          label?: string
          product_slug?: string
          server_code?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      inventory_history: {
        Row: {
          actor_id: string | null
          catalog_product_id: string | null
          change: number
          created_at: string
          id: string
          new_stock: number | null
          note: string | null
          order_id: string | null
          reason: string
        }
        Insert: {
          actor_id?: string | null
          catalog_product_id?: string | null
          change: number
          created_at?: string
          id?: string
          new_stock?: number | null
          note?: string | null
          order_id?: string | null
          reason: string
        }
        Update: {
          actor_id?: string | null
          catalog_product_id?: string | null
          change?: number
          created_at?: string
          id?: string
          new_stock?: number | null
          note?: string | null
          order_id?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_history_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_history_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          announcements_enabled: boolean
          created_at: string
          email_enabled: boolean
          last_promo_email_at: string | null
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          announcements_enabled?: boolean
          created_at?: string
          email_enabled?: boolean
          last_promo_email_at?: string | null
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          announcements_enabled?: boolean
          created_at?: string
          email_enabled?: boolean
          last_promo_email_at?: string | null
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          announcement_id: string | null
          body: string
          category: string
          created_at: string
          game_slug: string | null
          id: string
          image_url: string | null
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          announcement_id?: string | null
          body?: string
          category?: string
          created_at?: string
          game_slug?: string | null
          id?: string
          image_url?: string | null
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          announcement_id?: string | null
          body?: string
          category?: string
          created_at?: string
          game_slug?: string | null
          id?: string
          image_url?: string | null
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          admin_notes: string | null
          amount_inr: number | null
          amount_usd: number | null
          cashback_credited: boolean
          cashback_inr: number
          catalog_product_id: string | null
          completed_at: string | null
          coupon_code: string | null
          created_at: string
          currency: string
          customer_contact: string | null
          customer_email: string | null
          discount_inr: number
          expired_at: string | null
          expires_at: string | null
          failed_at: string | null
          game_id: string | null
          id: string
          notes: string | null
          order_code: string
          payment_method: string | null
          player_name: string | null
          processing_at: string | null
          product_name: string
          product_slug: string
          quantity: number
          reason: string | null
          region: string
          rejected_at: string | null
          screenshot_url: string | null
          server_id: string | null
          server_region: string | null
          status: string
          stock_deducted: boolean
          tier_label: string
          updated_at: string
          user_id: string | null
          utr: string | null
          wallet_used_inr: number
        }
        Insert: {
          admin_notes?: string | null
          amount_inr?: number | null
          amount_usd?: number | null
          cashback_credited?: boolean
          cashback_inr?: number
          catalog_product_id?: string | null
          completed_at?: string | null
          coupon_code?: string | null
          created_at?: string
          currency?: string
          customer_contact?: string | null
          customer_email?: string | null
          discount_inr?: number
          expired_at?: string | null
          expires_at?: string | null
          failed_at?: string | null
          game_id?: string | null
          id?: string
          notes?: string | null
          order_code: string
          payment_method?: string | null
          player_name?: string | null
          processing_at?: string | null
          product_name: string
          product_slug: string
          quantity?: number
          reason?: string | null
          region?: string
          rejected_at?: string | null
          screenshot_url?: string | null
          server_id?: string | null
          server_region?: string | null
          status?: string
          stock_deducted?: boolean
          tier_label: string
          updated_at?: string
          user_id?: string | null
          utr?: string | null
          wallet_used_inr?: number
        }
        Update: {
          admin_notes?: string | null
          amount_inr?: number | null
          amount_usd?: number | null
          cashback_credited?: boolean
          cashback_inr?: number
          catalog_product_id?: string | null
          completed_at?: string | null
          coupon_code?: string | null
          created_at?: string
          currency?: string
          customer_contact?: string | null
          customer_email?: string | null
          discount_inr?: number
          expired_at?: string | null
          expires_at?: string | null
          failed_at?: string | null
          game_id?: string | null
          id?: string
          notes?: string | null
          order_code?: string
          payment_method?: string | null
          player_name?: string | null
          processing_at?: string | null
          product_name?: string
          product_slug?: string
          quantity?: number
          reason?: string | null
          region?: string
          rejected_at?: string | null
          screenshot_url?: string | null
          server_id?: string | null
          server_region?: string | null
          status?: string
          stock_deducted?: boolean
          tier_label?: string
          updated_at?: string
          user_id?: string | null
          utr?: string | null
          wallet_used_inr?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          ai_behaviour: string | null
          auto_ordering_enabled: boolean
          auto_pricing_mode: string
          discord_webhook_url: string | null
          email_alerts_enabled: boolean
          id: number
          low_profit_threshold_inr: number
          low_wallet_threshold_inr: number
          max_profit_inr: number
          max_profit_pct: number
          min_profit_inr: number
          min_profit_pct: number
          price_rounding: string
          telegram_alerts_enabled: boolean
          updated_at: string
        }
        Insert: {
          ai_behaviour?: string | null
          auto_ordering_enabled?: boolean
          auto_pricing_mode?: string
          discord_webhook_url?: string | null
          email_alerts_enabled?: boolean
          id?: number
          low_profit_threshold_inr?: number
          low_wallet_threshold_inr?: number
          max_profit_inr?: number
          max_profit_pct?: number
          min_profit_inr?: number
          min_profit_pct?: number
          price_rounding?: string
          telegram_alerts_enabled?: boolean
          updated_at?: string
        }
        Update: {
          ai_behaviour?: string | null
          auto_ordering_enabled?: boolean
          auto_pricing_mode?: string
          discord_webhook_url?: string | null
          email_alerts_enabled?: boolean
          id?: number
          low_profit_threshold_inr?: number
          low_wallet_threshold_inr?: number
          max_profit_inr?: number
          max_profit_pct?: number
          min_profit_inr?: number
          min_profit_pct?: number
          price_rounding?: string
          telegram_alerts_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      price_history: {
        Row: {
          ai_explanation: string | null
          catalog_product_id: string | null
          changed_by: string | null
          created_at: string
          id: string
          new_price_inr: number | null
          old_price_inr: number | null
          profit_inr: number | null
          reason: string | null
          supplier_cost_inr: number | null
          supplier_id: string | null
        }
        Insert: {
          ai_explanation?: string | null
          catalog_product_id?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          new_price_inr?: number | null
          old_price_inr?: number | null
          profit_inr?: number | null
          reason?: string | null
          supplier_cost_inr?: number | null
          supplier_id?: string | null
        }
        Update: {
          ai_explanation?: string | null
          catalog_product_id?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          new_price_inr?: number | null
          old_price_inr?: number | null
          profit_inr?: number | null
          reason?: string | null
          supplier_cost_inr?: number | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_history_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      price_schedules: {
        Row: {
          applied_at: string | null
          apply_at: string
          catalog_product_id: string
          created_at: string
          created_by: string | null
          id: string
          new_price_inr: number
          note: string | null
          status: string
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          apply_at: string
          catalog_product_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          new_price_inr: number
          note?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          apply_at?: string
          catalog_product_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          new_price_inr?: number
          note?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_schedules_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_schedules_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_views: {
        Row: {
          created_at: string
          device_type: string | null
          id: string
          product_slug: string
          session_id: string | null
          tier_label: string | null
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          id?: string
          product_slug: string
          session_id?: string | null
          tier_label?: string | null
        }
        Update: {
          created_at?: string
          device_type?: string | null
          id?: string
          product_slug?: string
          session_id?: string | null
          tier_label?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ai_history_enabled: boolean
          contact: string | null
          country: string | null
          created_at: string
          display_name: string | null
          email: string | null
          has_used_welcome_offer: boolean
          hide_popup: boolean
          id: string
          username: string | null
          wallet_balance: number
        }
        Insert: {
          ai_history_enabled?: boolean
          contact?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          has_used_welcome_offer?: boolean
          hide_popup?: boolean
          id: string
          username?: string | null
          wallet_balance?: number
        }
        Update: {
          ai_history_enabled?: boolean
          contact?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          has_used_welcome_offer?: boolean
          hide_popup?: boolean
          id?: string
          username?: string | null
          wallet_balance?: number
        }
        Relationships: []
      }
      reviews: {
        Row: {
          created_at: string
          display_name: string
          full_name: string
          id: string
          product_slug: string | null
          rating: number
          review: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string
          full_name: string
          id?: string
          product_slug?: string | null
          rating: number
          review: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          full_name?: string
          id?: string
          product_slug?: string | null
          rating?: number
          review?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      site_visitors: {
        Row: {
          browser: string | null
          country: string | null
          device_type: string | null
          first_seen_at: string
          last_seen_at: string
          referrer: string | null
          session_id: string
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          country?: string | null
          device_type?: string | null
          first_seen_at?: string
          last_seen_at?: string
          referrer?: string | null
          session_id: string
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          country?: string | null
          device_type?: string | null
          first_seen_at?: string
          last_seen_at?: string
          referrer?: string | null
          session_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      supplier_checks: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          response_ms: number | null
          status: string
          supplier_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          response_ms?: number | null
          status: string
          supplier_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          response_ms?: number | null
          status?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_checks_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          api_endpoint: string | null
          api_key_secret_name: string | null
          auto_ordering_enabled: boolean
          auto_pricing_enabled: boolean
          avg_response_ms: number | null
          created_at: string
          error_count: number
          id: string
          last_checked_at: string | null
          name: string
          notes: string | null
          priority: number
          status: string
          supported_products: string[]
          updated_at: string
          wallet_balance_inr: number
          website: string | null
        }
        Insert: {
          api_endpoint?: string | null
          api_key_secret_name?: string | null
          auto_ordering_enabled?: boolean
          auto_pricing_enabled?: boolean
          avg_response_ms?: number | null
          created_at?: string
          error_count?: number
          id?: string
          last_checked_at?: string | null
          name: string
          notes?: string | null
          priority?: number
          status?: string
          supported_products?: string[]
          updated_at?: string
          wallet_balance_inr?: number
          website?: string | null
        }
        Update: {
          api_endpoint?: string | null
          api_key_secret_name?: string | null
          auto_ordering_enabled?: boolean
          auto_pricing_enabled?: boolean
          avg_response_ms?: number | null
          created_at?: string
          error_count?: number
          id?: string
          last_checked_at?: string | null
          name?: string
          notes?: string | null
          priority?: number
          status?: string
          supported_products?: string[]
          updated_at?: string
          wallet_balance_inr?: number
          website?: string | null
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          contact: string | null
          created_at: string
          id: string
          message: string
          name: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          contact?: string | null
          created_at?: string
          id?: string
          message: string
          name?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          contact?: string | null
          created_at?: string
          id?: string
          message?: string
          name?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          admin_reply: string | null
          created_at: string
          email: string | null
          id: string
          message: string
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_reply?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_reply?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
      wallet_transactions: {
        Row: {
          amount_inr: number
          created_at: string
          description: string | null
          id: string
          order_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount_inr: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount_inr?: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      web_search_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          id: string
          provider: string
          query: string
          results: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string
          id?: string
          provider: string
          query: string
          results?: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          id?: string
          provider?: string
          query?: string
          results?: Json
        }
        Relationships: []
      }
    }
    Views: {
      catalog_products_public: {
        Row: {
          auto_status: boolean | null
          category: string | null
          category_id: string | null
          created_at: string | null
          description: string | null
          display_status: string | null
          featured: boolean | null
          id: string | null
          image_url: string | null
          low_stock_threshold: number | null
          name: string | null
          price_inr: number | null
          product_slug: string | null
          product_type: string | null
          sort_order: number | null
          status: string | null
          stock: number | null
          stock_status: string | null
          tier_label: string | null
          updated_at: string | null
          visible: boolean | null
        }
        Insert: {
          auto_status?: boolean | null
          category?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          display_status?: string | null
          featured?: boolean | null
          id?: string | null
          image_url?: string | null
          low_stock_threshold?: number | null
          name?: string | null
          price_inr?: number | null
          product_slug?: string | null
          product_type?: string | null
          sort_order?: number | null
          status?: string | null
          stock?: number | null
          stock_status?: string | null
          tier_label?: string | null
          updated_at?: string | null
          visible?: boolean | null
        }
        Update: {
          auto_status?: boolean | null
          category?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          display_status?: string | null
          featured?: boolean | null
          id?: string | null
          image_url?: string | null
          low_stock_threshold?: number | null
          name?: string | null
          price_inr?: number | null
          product_slug?: string | null
          product_type?: string | null
          sort_order?: number | null
          status?: string | null
          stock?: number | null
          stock_status?: string | null
          tier_label?: string | null
          updated_at?: string | null
          visible?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      public_orders_feed: {
        Row: {
          amount_inr: number | null
          created_at: string | null
          currency: string | null
          masked_buyer: string | null
          order_code: string | null
          product_name: string | null
          status: string | null
          tier_label: string | null
        }
        Relationships: []
      }
      reviews_public: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string | null
          product_slug: string | null
          rating: number | null
          review: string | null
          verified: boolean | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          product_slug?: string | null
          rating?: number | null
          review?: string | null
          verified?: never
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          product_slug?: string | null
          rating?: number | null
          review?: string | null
          verified?: never
        }
        Relationships: []
      }
    }
    Functions: {
      admin_catalog_products: {
        Args: never
        Returns: {
          auto_pricing: boolean
          auto_status: boolean
          category: string | null
          category_id: string | null
          competitor_price_inr: number | null
          created_at: string
          description: string | null
          display_status: string
          featured: boolean
          id: string
          image_url: string | null
          low_stock_threshold: number
          min_safe_price_inr: number | null
          name: string | null
          price_inr: number
          product_slug: string
          product_type: string
          sort_order: number
          status: string
          stock: number
          stock_status: string
          supplier_cost_inr: number
          supplier_id: string | null
          supplier_name: string | null
          supplier_url: string | null
          tier_label: string
          updated_at: string
          visible: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "catalog_products"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_product_views: {
        Args: { _days?: number }
        Returns: {
          product_slug: string
          tier_label: string
          views: number
        }[]
      }
      admin_visitor_breakdown: {
        Args: never
        Returns: {
          avg_session_seconds: number
          browser: string
          device_type: string
          referrer: string
          sessions: number
        }[]
      }
      admin_visitor_growth: {
        Args: { _days?: number }
        Returns: {
          day: string
          visitors: number
        }[]
      }
      compute_cashback_inr: { Args: { amount: number }; Returns: number }
      credit_wallet_topup: {
        Args: { _amount: number; _ref: string; _user_id: string }
        Returns: number
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      expire_stale_orders: { Args: never; Returns: undefined }
      get_assistant_stats: {
        Args: never
        Returns: {
          chats_today: number
          negative: number
          positive: number
          satisfaction: number
          total_chats: number
        }[]
      }
      get_category_stats: {
        Args: never
        Returns: {
          active_products: number
          category_id: string
          out_of_stock_products: number
          profit_inr: number
          revenue_inr: number
          total_inventory: number
          total_products: number
          total_sales: number
        }[]
      }
      get_leaderboard: {
        Args: { _limit?: number }
        Returns: {
          country: string
          level: string
          masked_username: string
          rank: number
          total_orders: number
          total_spent_inr: number
        }[]
      }
      get_order_stats: {
        Args: never
        Returns: {
          success_rate: number
          successful: number
          total_relevant: number
        }[]
      }
      get_visitor_stats: {
        Args: { _tz_offset_minutes?: number }
        Returns: {
          desktop: number
          mobile: number
          online: number
          tablet: number
          today: number
          total: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_verified_buyer: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      rate_assistant_chat: {
        Args: { _chat_id: string; _rating: number }
        Returns: undefined
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_product_view: {
        Args: {
          _device_type?: string
          _product_slug: string
          _session_id?: string
          _tier_label?: string
        }
        Returns: undefined
      }
      visitor_heartbeat: {
        Args: {
          _browser?: string
          _country?: string
          _device_type?: string
          _referrer?: string
          _session_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "customer"
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
      app_role: ["admin", "customer"],
    },
  },
} as const
