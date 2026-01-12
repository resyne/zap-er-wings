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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      accounting_entries: {
        Row: {
          account_code: string | null
          affects_income_statement: boolean | null
          ai_extracted_data: Json | null
          amount: number
          attachment_url: string
          center_percentage: number | null
          cfo_notes: string | null
          chart_account_id: string | null
          classified_at: string | null
          classified_by: string | null
          cost_center_id: string | null
          created_at: string
          direction: string
          document_date: string
          document_type: string
          economic_subject_id: string | null
          economic_subject_type: string | null
          event_type: string | null
          financial_status: string | null
          id: string
          imponibile: number | null
          is_recurring: boolean | null
          iva_aliquota: number | null
          iva_amount: number | null
          iva_mode: string | null
          note: string | null
          payment_date: string | null
          payment_method: string | null
          profit_center_id: string | null
          recurrence_end_date: string | null
          recurrence_period: string | null
          recurrence_start_date: string | null
          status: string
          subject_type: string | null
          temporal_competence: string | null
          totale: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_code?: string | null
          affects_income_statement?: boolean | null
          ai_extracted_data?: Json | null
          amount: number
          attachment_url: string
          center_percentage?: number | null
          cfo_notes?: string | null
          chart_account_id?: string | null
          classified_at?: string | null
          classified_by?: string | null
          cost_center_id?: string | null
          created_at?: string
          direction: string
          document_date: string
          document_type: string
          economic_subject_id?: string | null
          economic_subject_type?: string | null
          event_type?: string | null
          financial_status?: string | null
          id?: string
          imponibile?: number | null
          is_recurring?: boolean | null
          iva_aliquota?: number | null
          iva_amount?: number | null
          iva_mode?: string | null
          note?: string | null
          payment_date?: string | null
          payment_method?: string | null
          profit_center_id?: string | null
          recurrence_end_date?: string | null
          recurrence_period?: string | null
          recurrence_start_date?: string | null
          status?: string
          subject_type?: string | null
          temporal_competence?: string | null
          totale?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_code?: string | null
          affects_income_statement?: boolean | null
          ai_extracted_data?: Json | null
          amount?: number
          attachment_url?: string
          center_percentage?: number | null
          cfo_notes?: string | null
          chart_account_id?: string | null
          classified_at?: string | null
          classified_by?: string | null
          cost_center_id?: string | null
          created_at?: string
          direction?: string
          document_date?: string
          document_type?: string
          economic_subject_id?: string | null
          economic_subject_type?: string | null
          event_type?: string | null
          financial_status?: string | null
          id?: string
          imponibile?: number | null
          is_recurring?: boolean | null
          iva_aliquota?: number | null
          iva_amount?: number | null
          iva_mode?: string | null
          note?: string | null
          payment_date?: string | null
          payment_method?: string | null
          profit_center_id?: string | null
          recurrence_end_date?: string | null
          recurrence_period?: string | null
          recurrence_start_date?: string | null
          status?: string
          subject_type?: string | null
          temporal_competence?: string | null
          totale?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_entries_chart_account_id_fkey"
            columns: ["chart_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_entries_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_entries_profit_center_id_fkey"
            columns: ["profit_center_id"]
            isOneToOne: false
            referencedRelation: "profit_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_rules: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          incide_ce: boolean
          is_active: boolean | null
          iva_mode: Database["public"]["Enums"]["iva_mode"] | null
          output_template: string
          priority: number | null
          rule_id: string
          stato_finanziario:
            | Database["public"]["Enums"]["financial_status_type"]
            | null
          tipo_evento: Database["public"]["Enums"]["accounting_event_type"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          incide_ce: boolean
          is_active?: boolean | null
          iva_mode?: Database["public"]["Enums"]["iva_mode"] | null
          output_template: string
          priority?: number | null
          rule_id: string
          stato_finanziario?:
            | Database["public"]["Enums"]["financial_status_type"]
            | null
          tipo_evento: Database["public"]["Enums"]["accounting_event_type"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          incide_ce?: boolean
          is_active?: boolean | null
          iva_mode?: Database["public"]["Enums"]["iva_mode"] | null
          output_template?: string
          priority?: number | null
          rule_id?: string
          stato_finanziario?:
            | Database["public"]["Enums"]["financial_status_type"]
            | null
          tipo_evento?: Database["public"]["Enums"]["accounting_event_type"]
          updated_at?: string | null
        }
        Relationships: []
      }
      accounting_template_lines: {
        Row: {
          avere_conto_dynamic: string | null
          avere_conto_type: string
          created_at: string | null
          dare_conto_dynamic: string | null
          dare_conto_type: string
          id: string
          importo_type: string
          line_order: number
          note: string | null
          template_id: string
        }
        Insert: {
          avere_conto_dynamic?: string | null
          avere_conto_type: string
          created_at?: string | null
          dare_conto_dynamic?: string | null
          dare_conto_type: string
          id?: string
          importo_type: string
          line_order: number
          note?: string | null
          template_id: string
        }
        Update: {
          avere_conto_dynamic?: string | null
          avere_conto_type?: string
          created_at?: string | null
          dare_conto_dynamic?: string | null
          dare_conto_type?: string
          id?: string
          importo_type?: string
          line_order?: number
          note?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_template_lines_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "accounting_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_templates: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          template_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          template_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          template_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_activity_logs: {
        Row: {
          action_description: string
          action_type: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          request_summary: string
          response_summary: string | null
          success: boolean | null
          user_id: string | null
        }
        Insert: {
          action_description: string
          action_type: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          request_summary: string
          response_summary?: string | null
          success?: boolean | null
          user_id?: string | null
        }
        Update: {
          action_description?: string
          action_type?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          request_summary?: string
          response_summary?: string | null
          success?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          created_at: string | null
          id: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bom_inclusions: {
        Row: {
          created_at: string
          id: string
          included_bom_id: string
          notes: string | null
          parent_bom_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          included_bom_id: string
          notes?: string | null
          parent_bom_id: string
          quantity?: number
        }
        Update: {
          created_at?: string
          id?: string
          included_bom_id?: string
          notes?: string | null
          parent_bom_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "bom_inclusions_included_bom_id_fkey"
            columns: ["included_bom_id"]
            isOneToOne: false
            referencedRelation: "boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_inclusions_parent_bom_id_fkey"
            columns: ["parent_bom_id"]
            isOneToOne: false
            referencedRelation: "boms"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_items: {
        Row: {
          bom_id: string
          created_at: string
          id: string
          item_id: string
          quantity: number
        }
        Insert: {
          bom_id: string
          created_at?: string
          id?: string
          item_id: string
          quantity: number
        }
        Update: {
          bom_id?: string
          created_at?: string
          id?: string
          item_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "bom_items_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_products: {
        Row: {
          bom_id: string
          created_at: string
          id: string
          product_id: string
        }
        Insert: {
          bom_id: string
          created_at?: string
          id?: string
          product_id: string
        }
        Update: {
          bom_id?: string
          created_at?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_products_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      boms: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          level: number
          machinery_model: string | null
          material_id: string | null
          name: string
          notes: string | null
          parent_id: string | null
          product_id: string | null
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          level?: number
          machinery_model?: string | null
          material_id?: string | null
          name: string
          notes?: string | null
          parent_id?: string | null
          product_id?: string | null
          updated_at?: string
          version: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          level?: number
          machinery_model?: string | null
          material_id?: string | null
          name?: string
          notes?: string | null
          parent_id?: string | null
          product_id?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "boms_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boms_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boms_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_assets: {
        Row: {
          asset_name: string
          asset_type: string
          brand_name: string
          created_at: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          updated_at: string
        }
        Insert: {
          asset_name: string
          asset_type: string
          brand_name: string
          created_at?: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          updated_at?: string
        }
        Update: {
          asset_name?: string
          asset_type?: string
          brand_name?: string
          created_at?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      budget: {
        Row: {
          account_id: string
          actual_amount: number | null
          budgeted_amount: number
          cost_center_id: string | null
          created_at: string | null
          id: string
          month: number
          profit_center_id: string | null
          updated_at: string | null
          variance: number | null
          variance_percent: number | null
          year: number
        }
        Insert: {
          account_id: string
          actual_amount?: number | null
          budgeted_amount: number
          cost_center_id?: string | null
          created_at?: string | null
          id?: string
          month: number
          profit_center_id?: string | null
          updated_at?: string | null
          variance?: number | null
          variance_percent?: number | null
          year: number
        }
        Update: {
          account_id?: string
          actual_amount?: number | null
          budgeted_amount?: number
          cost_center_id?: string | null
          created_at?: string | null
          id?: string
          month?: number
          profit_center_id?: string | null
          updated_at?: string | null
          variance?: number | null
          variance_percent?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_profit_center_id_fkey"
            columns: ["profit_center_id"]
            isOneToOne: false
            referencedRelation: "profit_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      business_units: {
        Row: {
          code: string
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          all_day: boolean | null
          color: string | null
          created_at: string
          description: string | null
          end_date: string | null
          event_date: string
          event_type: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean | null
          color?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          event_date: string
          event_type?: string | null
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean | null
          color?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          event_date?: string
          event_type?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      call_records: {
        Row: {
          ai_actions: Json | null
          ai_processed_at: string | null
          ai_sentiment: string | null
          ai_summary: string | null
          call_date: string
          call_time: string
          called_number: string
          caller_number: string
          created_at: string | null
          direction: string | null
          duration_seconds: number
          extension_number: string | null
          id: string
          lead_id: string | null
          matched_by: string | null
          operator_id: string | null
          operator_name: string | null
          recording_url: string | null
          service: string
          transcription: string | null
          unique_call_id: string
          updated_at: string | null
        }
        Insert: {
          ai_actions?: Json | null
          ai_processed_at?: string | null
          ai_sentiment?: string | null
          ai_summary?: string | null
          call_date: string
          call_time: string
          called_number: string
          caller_number: string
          created_at?: string | null
          direction?: string | null
          duration_seconds: number
          extension_number?: string | null
          id?: string
          lead_id?: string | null
          matched_by?: string | null
          operator_id?: string | null
          operator_name?: string | null
          recording_url?: string | null
          service: string
          transcription?: string | null
          unique_call_id: string
          updated_at?: string | null
        }
        Update: {
          ai_actions?: Json | null
          ai_processed_at?: string | null
          ai_sentiment?: string | null
          ai_summary?: string | null
          call_date?: string
          call_time?: string
          called_number?: string
          caller_number?: string
          created_at?: string | null
          direction?: string | null
          duration_seconds?: number
          extension_number?: string | null
          id?: string
          lead_id?: string | null
          matched_by?: string | null
          operator_id?: string | null
          operator_name?: string | null
          recording_url?: string | null
          service?: string
          transcription?: string | null
          unique_call_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_records_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_type: string
          category: string | null
          code: string
          created_at: string | null
          default_competence: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_header: boolean | null
          level: number | null
          name: string
          parent_code: string | null
          requires_cost_center: boolean | null
          sort_order: number | null
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          account_type: string
          category?: string | null
          code: string
          created_at?: string | null
          default_competence?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_header?: boolean | null
          level?: number | null
          name: string
          parent_code?: string | null
          requires_cost_center?: boolean | null
          sort_order?: number | null
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          account_type?: string
          category?: string | null
          code?: string
          created_at?: string | null
          default_competence?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_header?: boolean | null
          level?: number | null
          name?: string
          parent_code?: string | null
          requires_cost_center?: boolean | null
          sort_order?: number | null
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          code: string
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          tax_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      configurator_links: {
        Row: {
          code: string
          configuration_data: Json | null
          created_at: string | null
          created_by: string | null
          customer_company: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          preselected_model: string | null
          preselected_power: string | null
          preselected_size: number | null
          selected_installation: string | null
          selected_model: string | null
          selected_power: string | null
          selected_size: number | null
          status: string | null
          submitted_at: string | null
          total_price: number | null
          updated_at: string | null
        }
        Insert: {
          code: string
          configuration_data?: Json | null
          created_at?: string | null
          created_by?: string | null
          customer_company?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          preselected_model?: string | null
          preselected_power?: string | null
          preselected_size?: number | null
          selected_installation?: string | null
          selected_model?: string | null
          selected_power?: string | null
          selected_size?: number | null
          status?: string | null
          submitted_at?: string | null
          total_price?: number | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          configuration_data?: Json | null
          created_at?: string | null
          created_by?: string | null
          customer_company?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          preselected_model?: string | null
          preselected_power?: string | null
          preselected_size?: number | null
          selected_installation?: string | null
          selected_model?: string | null
          selected_power?: string | null
          selected_size?: number | null
          status?: string | null
          submitted_at?: string | null
          total_price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      consultation_requests: {
        Row: {
          business_location: string
          business_name: string
          business_size: string | null
          business_type: string
          created_at: string | null
          custom_services: string[] | null
          id: string
          special_needs: string | null
          user_id: string | null
        }
        Insert: {
          business_location: string
          business_name: string
          business_size?: string | null
          business_type: string
          created_at?: string | null
          custom_services?: string[] | null
          id?: string
          special_needs?: string | null
          user_id?: string | null
        }
        Update: {
          business_location?: string
          business_name?: string
          business_size?: string | null
          business_type?: string
          created_at?: string | null
          custom_services?: string[] | null
          id?: string
          special_needs?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          company: string | null
          created_at: string | null
          email: string
          id: string
          message: string | null
          name: string
          phone: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          email: string
          id?: string
          message?: string | null
          name: string
          phone?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          email?: string
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      cost_centers: {
        Row: {
          account_code: string | null
          category: string | null
          center_type: string | null
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          responsible_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_code?: string | null
          category?: string | null
          center_type?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          responsible_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_code?: string | null
          category?: string | null
          center_type?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          responsible_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_draft_items: {
        Row: {
          created_at: string
          draft_id: string
          hours: number | null
          id: string
          machinery_id: string | null
          material_id: string | null
          name: string
          notes: string | null
          quantity: number
          technician_id: string | null
          total_cost: number
          type: string
          unit: string | null
          unit_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          draft_id: string
          hours?: number | null
          id?: string
          machinery_id?: string | null
          material_id?: string | null
          name: string
          notes?: string | null
          quantity: number
          technician_id?: string | null
          total_cost: number
          type: string
          unit?: string | null
          unit_cost: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          draft_id?: string
          hours?: number | null
          id?: string
          machinery_id?: string | null
          material_id?: string | null
          name?: string
          notes?: string | null
          quantity?: number
          technician_id?: string | null
          total_cost?: number
          type?: string
          unit?: string | null
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_draft_items_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "customer_cost_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_draft_items_machinery_id_fkey"
            columns: ["machinery_id"]
            isOneToOne: false
            referencedRelation: "boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_draft_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_draft_items_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_companies: {
        Row: {
          annual_revenue: number | null
          bigin_id: string | null
          billing_address: string | null
          created_at: string
          email: string | null
          employees_count: number | null
          id: string
          industry: string | null
          name: string
          phone: string | null
          shipping_address: string | null
          synced_at: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          annual_revenue?: number | null
          bigin_id?: string | null
          billing_address?: string | null
          created_at?: string
          email?: string | null
          employees_count?: number | null
          id?: string
          industry?: string | null
          name: string
          phone?: string | null
          shipping_address?: string | null
          synced_at?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          annual_revenue?: number | null
          bigin_id?: string | null
          billing_address?: string | null
          created_at?: string
          email?: string | null
          employees_count?: number | null
          id?: string
          industry?: string | null
          name?: string
          phone?: string | null
          shipping_address?: string | null
          synced_at?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      crm_contacts: {
        Row: {
          address: string | null
          bigin_id: string | null
          company_id: string | null
          company_name: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          job_title: string | null
          last_name: string | null
          lead_source: string | null
          mobile: string | null
          pec: string | null
          phone: string | null
          piva: string | null
          sdi_code: string | null
          shipping_address: string | null
          synced_at: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          bigin_id?: string | null
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          job_title?: string | null
          last_name?: string | null
          lead_source?: string | null
          mobile?: string | null
          pec?: string | null
          phone?: string | null
          piva?: string | null
          sdi_code?: string | null
          shipping_address?: string | null
          synced_at?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          bigin_id?: string | null
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          job_title?: string | null
          last_name?: string | null
          lead_source?: string | null
          mobile?: string | null
          pec?: string | null
          phone?: string | null
          piva?: string | null
          sdi_code?: string | null
          shipping_address?: string | null
          synced_at?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_contact_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          amount: number | null
          assigned_to: string | null
          attachment_urls: string[] | null
          bigin_id: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          description: string | null
          expected_close_date: string | null
          id: string
          name: string
          probability: number | null
          stage: string | null
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          assigned_to?: string | null
          attachment_urls?: string[] | null
          bigin_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          expected_close_date?: string | null
          id?: string
          name: string
          probability?: number | null
          stage?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          assigned_to?: string | null
          attachment_urls?: string[] | null
          bigin_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          expected_close_date?: string | null
          id?: string
          name?: string
          probability?: number | null
          stage?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_notes: {
        Row: {
          bigin_id: string | null
          company_id: string | null
          contact_id: string | null
          content: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          id: string
          synced_at: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          bigin_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          id?: string
          synced_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          bigin_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          id?: string
          synced_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_notes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_quotes: {
        Row: {
          carbon_cartridges_count: string | null
          client_billing_info: string | null
          client_company_name: string | null
          client_email: string | null
          client_legal_address: string | null
          client_phone: string | null
          client_service_address: string | null
          created_at: string
          created_by: string
          custom_services: string[]
          description: string | null
          discount_percentage: number | null
          filter_details: string | null
          id: string
          monthly_price: number
          selected_plan: string | null
          services: string[]
          setup_fee: number | null
          terms_and_conditions: string | null
          title: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          carbon_cartridges_count?: string | null
          client_billing_info?: string | null
          client_company_name?: string | null
          client_email?: string | null
          client_legal_address?: string | null
          client_phone?: string | null
          client_service_address?: string | null
          created_at?: string
          created_by: string
          custom_services?: string[]
          description?: string | null
          discount_percentage?: number | null
          filter_details?: string | null
          id?: string
          monthly_price: number
          selected_plan?: string | null
          services?: string[]
          setup_fee?: number | null
          terms_and_conditions?: string | null
          title: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          carbon_cartridges_count?: string | null
          client_billing_info?: string | null
          client_company_name?: string | null
          client_email?: string | null
          client_legal_address?: string | null
          client_phone?: string | null
          client_service_address?: string | null
          created_at?: string
          created_by?: string
          custom_services?: string[]
          description?: string | null
          discount_percentage?: number | null
          filter_details?: string | null
          id?: string
          monthly_price?: number
          selected_plan?: string | null
          services?: string[]
          setup_fee?: number | null
          terms_and_conditions?: string | null
          title?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      customer_cost_drafts: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string
          description: string | null
          draft_number: string
          id: string
          status: string | null
          total_cost: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name: string
          description?: string | null
          draft_number: string
          id?: string
          status?: string | null
          total_cost?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string
          description?: string | null
          draft_number?: string
          id?: string
          status?: string | null
          total_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_cost_drafts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_invoice_advances: {
        Row: {
          advance_date: string
          amount: number
          created_at: string | null
          customer_invoice_id: string
          id: string
          notes: string | null
          payment_method: string | null
          updated_at: string | null
        }
        Insert: {
          advance_date: string
          amount: number
          created_at?: string | null
          customer_invoice_id: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          updated_at?: string | null
        }
        Update: {
          advance_date?: string
          amount?: number
          created_at?: string | null
          customer_invoice_id?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_invoice_advances_customer_invoice_id_fkey"
            columns: ["customer_invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_invoice_checks: {
        Row: {
          amount: number
          bank: string | null
          check_date: string
          check_number: string
          created_at: string | null
          customer_invoice_id: string
          due_date: string
          id: string
          notes: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          bank?: string | null
          check_date: string
          check_number: string
          created_at?: string | null
          customer_invoice_id: string
          due_date: string
          id?: string
          notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          bank?: string | null
          check_date?: string
          check_number?: string
          created_at?: string | null
          customer_invoice_id?: string
          due_date?: string
          id?: string
          notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_invoice_checks_customer_invoice_id_fkey"
            columns: ["customer_invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_invoices: {
        Row: {
          aging_days: number | null
          amount: number
          created_at: string | null
          customer_id: string | null
          customer_name: string
          due_date: string
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          payment_date: string | null
          profit_center_id: string | null
          project_id: string | null
          status: string | null
          tax_amount: number | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          aging_days?: number | null
          amount: number
          created_at?: string | null
          customer_id?: string | null
          customer_name: string
          due_date: string
          id?: string
          invoice_date: string
          invoice_number: string
          notes?: string | null
          payment_date?: string | null
          profit_center_id?: string | null
          project_id?: string | null
          status?: string | null
          tax_amount?: number | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          aging_days?: number | null
          amount?: number
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          payment_date?: string | null
          profit_center_id?: string | null
          project_id?: string | null
          status?: string | null
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_invoices_profit_center_id_fkey"
            columns: ["profit_center_id"]
            isOneToOne: false
            referencedRelation: "profit_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "management_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          active: boolean | null
          address: string | null
          city: string | null
          code: string
          company_name: string | null
          country: string | null
          created_at: string | null
          credit_limit: number | null
          email: string | null
          id: string
          incomplete_registry: boolean | null
          name: string
          payment_terms: number | null
          pec: string | null
          phone: string | null
          postal_code: string | null
          province: string | null
          sdi_code: string | null
          shipping_address: string | null
          tax_id: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          city?: string | null
          code: string
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          credit_limit?: number | null
          email?: string | null
          id?: string
          incomplete_registry?: boolean | null
          name: string
          payment_terms?: number | null
          pec?: string | null
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          sdi_code?: string | null
          shipping_address?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          city?: string | null
          code?: string
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          credit_limit?: number | null
          email?: string | null
          id?: string
          incomplete_registry?: boolean | null
          name?: string
          payment_terms?: number | null
          pec?: string | null
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          sdi_code?: string | null
          shipping_address?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ddt_items: {
        Row: {
          created_at: string
          ddt_id: string
          description: string
          id: string
          notes: string | null
          quantity: number
          unit: string | null
        }
        Insert: {
          created_at?: string
          ddt_id: string
          description: string
          id?: string
          notes?: string | null
          quantity?: number
          unit?: string | null
        }
        Update: {
          created_at?: string
          ddt_id?: string
          description?: string
          id?: string
          notes?: string | null
          quantity?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ddt_items_ddt_id_fkey"
            columns: ["ddt_id"]
            isOneToOne: false
            referencedRelation: "ddts"
            referencedColumns: ["id"]
          },
        ]
      }
      ddts: {
        Row: {
          admin_status: string | null
          archived: boolean | null
          attachment_url: string | null
          counterpart_type: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          ddt_data: Json | null
          ddt_number: string
          direction: string | null
          document_date: string | null
          html_content: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          invoiced: boolean | null
          notes: string | null
          official_document_date: string | null
          pdf_data: string | null
          shipping_order_id: string | null
          status: string | null
          supplier_id: string | null
          unique_code: string | null
          uploaded_at: string | null
          uploaded_by: string | null
          work_order_id: string | null
        }
        Insert: {
          admin_status?: string | null
          archived?: boolean | null
          attachment_url?: string | null
          counterpart_type?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          ddt_data?: Json | null
          ddt_number: string
          direction?: string | null
          document_date?: string | null
          html_content?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoiced?: boolean | null
          notes?: string | null
          official_document_date?: string | null
          pdf_data?: string | null
          shipping_order_id?: string | null
          status?: string | null
          supplier_id?: string | null
          unique_code?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          work_order_id?: string | null
        }
        Update: {
          admin_status?: string | null
          archived?: boolean | null
          attachment_url?: string | null
          counterpart_type?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          ddt_data?: Json | null
          ddt_number?: string
          direction?: string | null
          document_date?: string | null
          html_content?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoiced?: boolean | null
          notes?: string | null
          official_document_date?: string | null
          pdf_data?: string | null
          shipping_order_id?: string | null
          status?: string | null
          supplier_id?: string | null
          unique_code?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ddts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ddts_shipping_order_id_fkey"
            columns: ["shipping_order_id"]
            isOneToOne: false
            referencedRelation: "shipping_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ddts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ddts_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automation_logs: {
        Row: {
          automation_id: string
          campaign_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          recipient_email: string
          recipient_name: string | null
          scheduled_for: string
          sent_at: string | null
          status: string | null
        }
        Insert: {
          automation_id: string
          campaign_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          recipient_email: string
          recipient_name?: string | null
          scheduled_for: string
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          automation_id?: string
          campaign_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          recipient_email?: string
          recipient_name?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_automation_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "email_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automations: {
        Row: {
          created_at: string | null
          created_by: string | null
          delay_days: number
          description: string | null
          email_list_id: string | null
          id: string
          is_active: boolean | null
          message: string
          name: string
          parent_campaign_id: string | null
          partner_type: string | null
          region: string | null
          sender_email: string
          sender_name: string
          subject: string
          target_audience: string
          template_id: string | null
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          delay_days?: number
          description?: string | null
          email_list_id?: string | null
          id?: string
          is_active?: boolean | null
          message: string
          name: string
          parent_campaign_id?: string | null
          partner_type?: string | null
          region?: string | null
          sender_email: string
          sender_name: string
          subject: string
          target_audience: string
          template_id?: string | null
          trigger_type?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          delay_days?: number
          description?: string | null
          email_list_id?: string | null
          id?: string
          is_active?: boolean | null
          message?: string
          name?: string
          parent_campaign_id?: string | null
          partner_type?: string | null
          region?: string | null
          sender_email?: string
          sender_name?: string
          subject?: string
          target_audience?: string
          template_id?: string | null
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_automations_email_list_id_fkey"
            columns: ["email_list_id"]
            isOneToOne: false
            referencedRelation: "email_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automations_parent_campaign_id_fkey"
            columns: ["parent_campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "newsletter_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          campaign_type: string
          created_at: string | null
          failure_count: number | null
          id: string
          message: string
          partner_type: string | null
          recipients_count: number | null
          region: string | null
          scheduled_at: string | null
          sent_at: string | null
          subject: string
          success_count: number | null
        }
        Insert: {
          campaign_type: string
          created_at?: string | null
          failure_count?: number | null
          id?: string
          message: string
          partner_type?: string | null
          recipients_count?: number | null
          region?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          subject: string
          success_count?: number | null
        }
        Update: {
          campaign_type?: string
          created_at?: string | null
          failure_count?: number | null
          id?: string
          message?: string
          partner_type?: string | null
          recipients_count?: number | null
          region?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          subject?: string
          success_count?: number | null
        }
        Relationships: []
      }
      email_list_contacts: {
        Row: {
          company: string | null
          created_at: string | null
          email: string
          email_list_id: string
          first_name: string | null
          id: string
          last_name: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          email: string
          email_list_id: string
          first_name?: string | null
          id?: string
          last_name?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          email?: string
          email_list_id?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_list_contacts_email_list_id_fkey"
            columns: ["email_list_id"]
            isOneToOne: false
            referencedRelation: "email_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      email_lists: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          attempts: number | null
          campaign_id: string | null
          created_at: string | null
          error_message: string | null
          html_content: string
          id: string
          max_attempts: number | null
          message: string
          metadata: Json | null
          recipient_email: string
          recipient_name: string
          scheduled_at: string | null
          sender_email: string | null
          sender_name: string | null
          sent_at: string | null
          status: string | null
          subject: string
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          campaign_id?: string | null
          created_at?: string | null
          error_message?: string | null
          html_content: string
          id?: string
          max_attempts?: number | null
          message: string
          metadata?: Json | null
          recipient_email: string
          recipient_name: string
          scheduled_at?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          campaign_id?: string | null
          created_at?: string | null
          error_message?: string | null
          html_content?: string
          id?: string
          max_attempts?: number | null
          message?: string
          metadata?: Json | null
          recipient_email?: string
          recipient_name?: string
          scheduled_at?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      emails: {
        Row: {
          body: string | null
          created_at: string
          email_date: string
          external_id: string
          from_address: string
          has_attachments: boolean
          html_body: string | null
          id: string
          is_read: boolean
          is_starred: boolean
          subject: string
          to_address: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          email_date: string
          external_id: string
          from_address: string
          has_attachments?: boolean
          html_body?: string | null
          id?: string
          is_read?: boolean
          is_starred?: boolean
          subject: string
          to_address: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          email_date?: string
          external_id?: string
          from_address?: string
          has_attachments?: boolean
          html_body?: string | null
          id?: string
          is_read?: boolean
          is_starred?: boolean
          subject?: string
          to_address?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      executions: {
        Row: {
          created_at: string
          end_time: string | null
          id: string
          notes: string | null
          operator_id: string | null
          start_time: string
          step_name: string
          updated_at: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          id?: string
          notes?: string | null
          operator_id?: string | null
          start_time?: string
          step_name: string
          updated_at?: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          end_time?: string | null
          id?: string
          notes?: string | null
          operator_id?: string | null
          start_time?: string
          step_name?: string
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "executions_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_movements: {
        Row: {
          amount: number
          attachments: string[] | null
          causale: string
          created_at: string
          date: string
          description: string | null
          id: string
          monitor: boolean | null
          movement_type: string
          notes: string | null
          payment_date: string | null
          payment_method: string
          payment_timing: string | null
          registered: boolean | null
          registration_number: string
          reporting_user: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          attachments?: string[] | null
          causale: string
          created_at?: string
          date: string
          description?: string | null
          id?: string
          monitor?: boolean | null
          movement_type: string
          notes?: string | null
          payment_date?: string | null
          payment_method: string
          payment_timing?: string | null
          registered?: boolean | null
          registration_number: string
          reporting_user: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          attachments?: string[] | null
          causale?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          monitor?: boolean | null
          movement_type?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string
          payment_timing?: string | null
          registered?: boolean | null
          registration_number?: string
          reporting_user?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      forecast: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          forecast_date: string
          forecast_type: string
          id: string
          probability: number | null
          project_id: string | null
          scenario: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          forecast_date: string
          forecast_type: string
          id?: string
          probability?: number | null
          project_id?: string | null
          scenario?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          forecast_date?: string
          forecast_type?: string
          id?: string
          probability?: number | null
          project_id?: string | null
          scenario?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forecast_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "management_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_entry: {
        Row: {
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          date: string
          description: string
          doc_ref: string | null
          doc_type: Database["public"]["Enums"]["gl_doc_type"]
          id: string
          job_id: string | null
          origin_module: Database["public"]["Enums"]["gl_origin_module"]
          profit_center_id: string | null
          status: Database["public"]["Enums"]["gl_status"]
          updated_at: string
        }
        Insert: {
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          description: string
          doc_ref?: string | null
          doc_type: Database["public"]["Enums"]["gl_doc_type"]
          id?: string
          job_id?: string | null
          origin_module?: Database["public"]["Enums"]["gl_origin_module"]
          profit_center_id?: string | null
          status?: Database["public"]["Enums"]["gl_status"]
          updated_at?: string
        }
        Update: {
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          doc_ref?: string | null
          doc_type?: Database["public"]["Enums"]["gl_doc_type"]
          id?: string
          job_id?: string | null
          origin_module?: Database["public"]["Enums"]["gl_origin_module"]
          profit_center_id?: string | null
          status?: Database["public"]["Enums"]["gl_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gl_entry_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "profit_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_entry_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "management_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_entry_profit_center_id_fkey"
            columns: ["profit_center_id"]
            isOneToOne: false
            referencedRelation: "profit_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_entry_line: {
        Row: {
          cost_center_id: string | null
          created_at: string
          credit: number | null
          debit: number | null
          gl_account_id: string
          gl_entry_id: string
          id: string
          job_id: string | null
          notes: string | null
          profit_center_id: string | null
          updated_at: string
          vat_rate: number | null
        }
        Insert: {
          cost_center_id?: string | null
          created_at?: string
          credit?: number | null
          debit?: number | null
          gl_account_id: string
          gl_entry_id: string
          id?: string
          job_id?: string | null
          notes?: string | null
          profit_center_id?: string | null
          updated_at?: string
          vat_rate?: number | null
        }
        Update: {
          cost_center_id?: string | null
          created_at?: string
          credit?: number | null
          debit?: number | null
          gl_account_id?: string
          gl_entry_id?: string
          id?: string
          job_id?: string | null
          notes?: string | null
          profit_center_id?: string | null
          updated_at?: string
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_entry_line_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "profit_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_entry_line_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_entry_line_gl_entry_id_fkey"
            columns: ["gl_entry_id"]
            isOneToOne: false
            referencedRelation: "gl_entry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_entry_line_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "management_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_entry_line_profit_center_id_fkey"
            columns: ["profit_center_id"]
            isOneToOne: false
            referencedRelation: "profit_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_presets: {
        Row: {
          ai_highlight_bottlenecks: boolean | null
          ai_highlight_production_risks: boolean | null
          ai_propose_objective: boolean | null
          ai_reject_non_measurable_kr: boolean | null
          ai_severity: string | null
          ai_suggest_focus: boolean | null
          ai_suggest_milestones: boolean | null
          ai_suggest_vision: boolean | null
          ai_validate_focus_okr_coherence: boolean | null
          ai_warning_load_timeline: boolean | null
          business_unit_id: string
          created_at: string
          focus_max_active: number | null
          focus_max_duration_months: number | null
          focus_max_okr_cycles: number | null
          focus_min_duration_months: number | null
          focus_required_for_okr: boolean | null
          guardrail_cash_buffer: boolean | null
          guardrail_margin_min: boolean | null
          guardrail_override_role: string | null
          guardrail_team_load_max: boolean | null
          guardrail_violation_action: string | null
          id: string
          kr_baseline_required: boolean | null
          kr_max_per_objective: number | null
          kr_metric_erp_required: boolean | null
          kr_min_per_objective: number | null
          kr_owner_required: boolean | null
          kr_target_required: boolean | null
          name: string
          objective_default_duration_days: number | null
          objective_focus_required: boolean | null
          objective_max_active: number | null
          objective_max_duration_days: number | null
          objective_scope_required: boolean | null
          philosophy: string | null
          task_cross_kr: boolean | null
          task_effort_required: boolean | null
          task_linked_to_kr: boolean | null
          task_without_kr_allowed: boolean | null
          temporal_auto_realign: boolean | null
          temporal_validation: boolean | null
          updated_at: string
          vision_kpi_observation: boolean | null
          vision_max_active: number | null
          vision_max_duration_months: number | null
          vision_min_duration_months: number | null
          vision_required_for_focus: boolean | null
        }
        Insert: {
          ai_highlight_bottlenecks?: boolean | null
          ai_highlight_production_risks?: boolean | null
          ai_propose_objective?: boolean | null
          ai_reject_non_measurable_kr?: boolean | null
          ai_severity?: string | null
          ai_suggest_focus?: boolean | null
          ai_suggest_milestones?: boolean | null
          ai_suggest_vision?: boolean | null
          ai_validate_focus_okr_coherence?: boolean | null
          ai_warning_load_timeline?: boolean | null
          business_unit_id: string
          created_at?: string
          focus_max_active?: number | null
          focus_max_duration_months?: number | null
          focus_max_okr_cycles?: number | null
          focus_min_duration_months?: number | null
          focus_required_for_okr?: boolean | null
          guardrail_cash_buffer?: boolean | null
          guardrail_margin_min?: boolean | null
          guardrail_override_role?: string | null
          guardrail_team_load_max?: boolean | null
          guardrail_violation_action?: string | null
          id?: string
          kr_baseline_required?: boolean | null
          kr_max_per_objective?: number | null
          kr_metric_erp_required?: boolean | null
          kr_min_per_objective?: number | null
          kr_owner_required?: boolean | null
          kr_target_required?: boolean | null
          name?: string
          objective_default_duration_days?: number | null
          objective_focus_required?: boolean | null
          objective_max_active?: number | null
          objective_max_duration_days?: number | null
          objective_scope_required?: boolean | null
          philosophy?: string | null
          task_cross_kr?: boolean | null
          task_effort_required?: boolean | null
          task_linked_to_kr?: boolean | null
          task_without_kr_allowed?: boolean | null
          temporal_auto_realign?: boolean | null
          temporal_validation?: boolean | null
          updated_at?: string
          vision_kpi_observation?: boolean | null
          vision_max_active?: number | null
          vision_max_duration_months?: number | null
          vision_min_duration_months?: number | null
          vision_required_for_focus?: boolean | null
        }
        Update: {
          ai_highlight_bottlenecks?: boolean | null
          ai_highlight_production_risks?: boolean | null
          ai_propose_objective?: boolean | null
          ai_reject_non_measurable_kr?: boolean | null
          ai_severity?: string | null
          ai_suggest_focus?: boolean | null
          ai_suggest_milestones?: boolean | null
          ai_suggest_vision?: boolean | null
          ai_validate_focus_okr_coherence?: boolean | null
          ai_warning_load_timeline?: boolean | null
          business_unit_id?: string
          created_at?: string
          focus_max_active?: number | null
          focus_max_duration_months?: number | null
          focus_max_okr_cycles?: number | null
          focus_min_duration_months?: number | null
          focus_required_for_okr?: boolean | null
          guardrail_cash_buffer?: boolean | null
          guardrail_margin_min?: boolean | null
          guardrail_override_role?: string | null
          guardrail_team_load_max?: boolean | null
          guardrail_violation_action?: string | null
          id?: string
          kr_baseline_required?: boolean | null
          kr_max_per_objective?: number | null
          kr_metric_erp_required?: boolean | null
          kr_min_per_objective?: number | null
          kr_owner_required?: boolean | null
          kr_target_required?: boolean | null
          name?: string
          objective_default_duration_days?: number | null
          objective_focus_required?: boolean | null
          objective_max_active?: number | null
          objective_max_duration_days?: number | null
          objective_scope_required?: boolean | null
          philosophy?: string | null
          task_cross_kr?: boolean | null
          task_effort_required?: boolean | null
          task_linked_to_kr?: boolean | null
          task_without_kr_allowed?: boolean | null
          temporal_auto_realign?: boolean | null
          temporal_validation?: boolean | null
          updated_at?: string
          vision_kpi_observation?: boolean | null
          vision_max_active?: number | null
          vision_max_duration_months?: number | null
          vision_min_duration_months?: number | null
          vision_required_for_focus?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_presets_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: true
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_employees: {
        Row: {
          created_at: string
          department: string | null
          email: string | null
          first_name: string
          fluida_id: string
          hire_date: string | null
          id: string
          last_name: string
          phone: string | null
          position: string | null
          salary: number | null
          status: string | null
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email?: string | null
          first_name: string
          fluida_id: string
          hire_date?: string | null
          id?: string
          last_name: string
          phone?: string | null
          position?: string | null
          salary?: number | null
          status?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string | null
          first_name?: string
          fluida_id?: string
          hire_date?: string | null
          id?: string
          last_name?: string
          phone?: string | null
          position?: string | null
          salary?: number | null
          status?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      hr_leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          days_requested: number
          employee_id: string
          end_date: string
          fluida_request_id: string | null
          id: string
          leave_type: string
          reason: string | null
          start_date: string
          status: string | null
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days_requested: number
          employee_id: string
          end_date: string
          fluida_request_id?: string | null
          id?: string
          leave_type: string
          reason?: string | null
          start_date: string
          status?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days_requested?: number
          employee_id?: string
          end_date?: string
          fluida_request_id?: string | null
          id?: string
          leave_type?: string
          reason?: string | null
          start_date?: string
          status?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_timesheets: {
        Row: {
          break_minutes: number | null
          clock_in: string | null
          clock_out: string | null
          created_at: string
          date: string
          employee_id: string
          fluida_timesheet_id: string | null
          id: string
          notes: string | null
          overtime_hours: number | null
          regular_hours: number | null
          status: string | null
          synced_at: string | null
          total_hours: number | null
          updated_at: string
        }
        Insert: {
          break_minutes?: number | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date: string
          employee_id: string
          fluida_timesheet_id?: string | null
          id?: string
          notes?: string | null
          overtime_hours?: number | null
          regular_hours?: number | null
          status?: string | null
          synced_at?: string | null
          total_hours?: number | null
          updated_at?: string
        }
        Update: {
          break_minutes?: number | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          fluida_timesheet_id?: string | null
          id?: string
          notes?: string | null
          overtime_hours?: number | null
          regular_hours?: number | null
          status?: string | null
          synced_at?: string | null
          total_hours?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_timesheets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      imap_config: {
        Row: {
          created_at: string | null
          folder: string | null
          host: string
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          name: string
          password_encrypted: string
          pbx_id: string | null
          port: number
          search_criteria: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          folder?: string | null
          host: string
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          name: string
          password_encrypted: string
          pbx_id?: string | null
          port?: number
          search_criteria?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          folder?: string | null
          host?: string
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          name?: string
          password_encrypted?: string
          pbx_id?: string | null
          port?: number
          search_criteria?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "imap_config_pbx_id_fkey"
            columns: ["pbx_id"]
            isOneToOne: false
            referencedRelation: "pbx_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      imap_sync_state: {
        Row: {
          config_id: string | null
          created_at: string | null
          emails_processed: number | null
          id: string
          last_sync_at: string | null
          last_uid: number | null
        }
        Insert: {
          config_id?: string | null
          created_at?: string | null
          emails_processed?: number | null
          id?: string
          last_sync_at?: string | null
          last_uid?: number | null
        }
        Update: {
          config_id?: string | null
          created_at?: string | null
          emails_processed?: number | null
          id?: string
          last_sync_at?: string | null
          last_uid?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "imap_sync_state_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: true
            referencedRelation: "imap_config"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_registry: {
        Row: {
          account_splits: Json | null
          accounting_entry_id: string | null
          contabilizzazione_valida: boolean | null
          cost_account_id: string | null
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          data_storno: string | null
          due_date: string | null
          event_type: string | null
          evento_lockato: boolean | null
          financial_status: string
          id: string
          imponibile: number
          invoice_date: string
          invoice_number: string
          invoice_type: string
          iva_amount: number
          iva_rate: number
          motivo_storno: string | null
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          periodo_chiuso: boolean | null
          prima_nota_id: string | null
          profit_center_id: string | null
          registered_at: string | null
          registered_by: string | null
          revenue_account_id: string | null
          scadenza_id: string | null
          scrittura_stornata_id: string | null
          scrittura_storno_id: string | null
          source_document_id: string | null
          source_document_type: string | null
          status: string
          stornato: boolean | null
          subject_id: string | null
          subject_name: string
          subject_type: string
          total_amount: number
          updated_at: string
          utente_storno: string | null
          vat_regime: string
        }
        Insert: {
          account_splits?: Json | null
          accounting_entry_id?: string | null
          contabilizzazione_valida?: boolean | null
          cost_account_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          data_storno?: string | null
          due_date?: string | null
          event_type?: string | null
          evento_lockato?: boolean | null
          financial_status?: string
          id?: string
          imponibile?: number
          invoice_date: string
          invoice_number: string
          invoice_type: string
          iva_amount?: number
          iva_rate?: number
          motivo_storno?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          periodo_chiuso?: boolean | null
          prima_nota_id?: string | null
          profit_center_id?: string | null
          registered_at?: string | null
          registered_by?: string | null
          revenue_account_id?: string | null
          scadenza_id?: string | null
          scrittura_stornata_id?: string | null
          scrittura_storno_id?: string | null
          source_document_id?: string | null
          source_document_type?: string | null
          status?: string
          stornato?: boolean | null
          subject_id?: string | null
          subject_name: string
          subject_type: string
          total_amount?: number
          updated_at?: string
          utente_storno?: string | null
          vat_regime?: string
        }
        Update: {
          account_splits?: Json | null
          accounting_entry_id?: string | null
          contabilizzazione_valida?: boolean | null
          cost_account_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          data_storno?: string | null
          due_date?: string | null
          event_type?: string | null
          evento_lockato?: boolean | null
          financial_status?: string
          id?: string
          imponibile?: number
          invoice_date?: string
          invoice_number?: string
          invoice_type?: string
          iva_amount?: number
          iva_rate?: number
          motivo_storno?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          periodo_chiuso?: boolean | null
          prima_nota_id?: string | null
          profit_center_id?: string | null
          registered_at?: string | null
          registered_by?: string | null
          revenue_account_id?: string | null
          scadenza_id?: string | null
          scrittura_stornata_id?: string | null
          scrittura_storno_id?: string | null
          source_document_id?: string | null
          source_document_type?: string | null
          status?: string
          stornato?: boolean | null
          subject_id?: string | null
          subject_name?: string
          subject_type?: string
          total_amount?: number
          updated_at?: string
          utente_storno?: string | null
          vat_regime?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_registry_accounting_entry_id_fkey"
            columns: ["accounting_entry_id"]
            isOneToOne: false
            referencedRelation: "accounting_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_registry_cost_account_id_fkey"
            columns: ["cost_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_registry_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_registry_prima_nota_id_fkey"
            columns: ["prima_nota_id"]
            isOneToOne: false
            referencedRelation: "prima_nota"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_registry_profit_center_id_fkey"
            columns: ["profit_center_id"]
            isOneToOne: false
            referencedRelation: "profit_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_registry_revenue_account_id_fkey"
            columns: ["revenue_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_registry_scadenza_id_fkey"
            columns: ["scadenza_id"]
            isOneToOne: false
            referencedRelation: "scadenze"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_registry_scrittura_stornata_id_fkey"
            columns: ["scrittura_stornata_id"]
            isOneToOne: false
            referencedRelation: "prima_nota"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_registry_scrittura_storno_id_fkey"
            columns: ["scrittura_storno_id"]
            isOneToOne: false
            referencedRelation: "prima_nota"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_reminders: {
        Row: {
          created_at: string
          customer_invoice_id: string
          id: string
          notes: string | null
          reminder_type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer_invoice_id: string
          id?: string
          notes?: string | null
          reminder_type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer_invoice_id?: string
          id?: string
          notes?: string | null
          reminder_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_reminders_customer_invoice_id_fkey"
            columns: ["customer_invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          active: boolean | null
          category: string | null
          code: string
          cost: number | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          price: number | null
          type: string
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          code: string
          cost?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          price?: number | null
          type: string
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          category?: string | null
          code?: string
          cost?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          price?: number | null
          type?: string
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          created_by: string | null
          description: string
          document_number: string | null
          document_type: string | null
          entry_date: string
          entry_type: string
          id: string
          import_source: string | null
          is_imported: boolean | null
          profit_center_id: string | null
          reference_number: string | null
          sales_order_id: string | null
          status: string
          supplier_customer_name: string | null
          total_amount: number
          updated_at: string
          vat_amount: number | null
        }
        Insert: {
          account_id: string
          amount?: number
          created_at?: string
          created_by?: string | null
          description: string
          document_number?: string | null
          document_type?: string | null
          entry_date?: string
          entry_type: string
          id?: string
          import_source?: string | null
          is_imported?: boolean | null
          profit_center_id?: string | null
          reference_number?: string | null
          sales_order_id?: string | null
          status?: string
          supplier_customer_name?: string | null
          total_amount?: number
          updated_at?: string
          vat_amount?: number | null
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string
          document_number?: string | null
          document_type?: string | null
          entry_date?: string
          entry_type?: string
          id?: string
          import_source?: string | null
          is_imported?: boolean | null
          profit_center_id?: string | null
          reference_number?: string | null
          sales_order_id?: string | null
          status?: string
          supplier_customer_name?: string | null
          total_amount?: number
          updated_at?: string
          vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_profit_center_id_fkey"
            columns: ["profit_center_id"]
            isOneToOne: false
            referencedRelation: "profit_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      key_results: {
        Row: {
          created_at: string
          current_value: number | null
          deadline: string | null
          description: string | null
          id: string
          objective_id: string
          priority: number | null
          project_id: string | null
          status: string | null
          target_value: number
          title: string
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          description?: string | null
          id?: string
          objective_id: string
          priority?: number | null
          project_id?: string | null
          status?: string | null
          target_value: number
          title: string
          unit: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          description?: string | null
          id?: string
          objective_id?: string
          priority?: number | null
          project_id?: string | null
          status?: string | null
          target_value?: number
          title?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "key_results_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "strategic_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_results_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "management_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_drivers: {
        Row: {
          created_at: string | null
          current_value: number | null
          description: string | null
          id: string
          name: string
          period_type: string | null
          target_value: number | null
          unit: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_value?: number | null
          description?: string | null
          id?: string
          name: string
          period_type?: string | null
          target_value?: number | null
          unit: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_value?: number | null
          description?: string | null
          id?: string
          name?: string
          period_type?: string | null
          target_value?: number | null
          unit?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lead_activities: {
        Row: {
          activity_date: string
          activity_type: string
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          id: string
          lead_id: string
          notes: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          activity_date: string
          activity_type: string
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          lead_id: string
          notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          activity_date?: string
          activity_type?: string
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          lead_id?: string
          notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activity_comments: {
        Row: {
          activity_id: string
          comment: string
          created_at: string
          id: string
          mentions: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          comment: string
          created_at?: string
          id?: string
          mentions?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          comment?: string
          created_at?: string
          id?: string
          mentions?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activity_comments_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "lead_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_comments: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          lead_id: string
          tagged_users: string[] | null
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          lead_id: string
          tagged_users?: string[] | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          lead_id?: string
          tagged_users?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_comments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_files: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          lead_id: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          lead_id: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          lead_id?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_files_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          archived: boolean | null
          assigned_to: string | null
          city: string | null
          company_name: string
          configurator_has_quote: boolean | null
          configurator_history: Json | null
          configurator_last_updated: string | null
          configurator_link: string | null
          configurator_model: string | null
          configurator_opened: boolean | null
          configurator_opened_at: string | null
          configurator_quote_price: number | null
          configurator_session_id: string | null
          configurator_status: string | null
          contact_name: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          custom_fields: Json | null
          customer_id: string | null
          email: string | null
          external_configurator_link: string | null
          id: string
          next_activity_assigned_to: string | null
          next_activity_date: string | null
          next_activity_notes: string | null
          next_activity_type: string | null
          notes: string | null
          phone: string | null
          pipeline: string | null
          priority: string | null
          source: string | null
          status: string | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          archived?: boolean | null
          assigned_to?: string | null
          city?: string | null
          company_name: string
          configurator_has_quote?: boolean | null
          configurator_history?: Json | null
          configurator_last_updated?: string | null
          configurator_link?: string | null
          configurator_model?: string | null
          configurator_opened?: boolean | null
          configurator_opened_at?: string | null
          configurator_quote_price?: number | null
          configurator_session_id?: string | null
          configurator_status?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_fields?: Json | null
          customer_id?: string | null
          email?: string | null
          external_configurator_link?: string | null
          id?: string
          next_activity_assigned_to?: string | null
          next_activity_date?: string | null
          next_activity_notes?: string | null
          next_activity_type?: string | null
          notes?: string | null
          phone?: string | null
          pipeline?: string | null
          priority?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          archived?: boolean | null
          assigned_to?: string | null
          city?: string | null
          company_name?: string
          configurator_has_quote?: boolean | null
          configurator_history?: Json | null
          configurator_last_updated?: string | null
          configurator_link?: string | null
          configurator_model?: string | null
          configurator_opened?: boolean | null
          configurator_opened_at?: string | null
          configurator_quote_price?: number | null
          configurator_session_id?: string | null
          configurator_status?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_fields?: Json | null
          customer_id?: string | null
          email?: string | null
          external_configurator_link?: string | null
          id?: string
          next_activity_assigned_to?: string | null
          next_activity_date?: string | null
          next_activity_notes?: string | null
          next_activity_type?: string | null
          notes?: string | null
          phone?: string | null
          pipeline?: string | null
          priority?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          amount: number
          bank_account: string | null
          cost_center_id: string | null
          created_at: string | null
          created_by: string | null
          customer_invoice_id: string | null
          description: string
          entry_date: string
          entry_type: string
          id: string
          profit_center_id: string | null
          reference_number: string | null
          supplier_invoice_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          bank_account?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_invoice_id?: string | null
          description: string
          entry_date: string
          entry_type: string
          id?: string
          profit_center_id?: string | null
          reference_number?: string | null
          supplier_invoice_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          bank_account?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_invoice_id?: string | null
          description?: string
          entry_date?: string
          entry_type?: string
          id?: string
          profit_center_id?: string | null
          reference_number?: string | null
          supplier_invoice_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_customer_invoice_id_fkey"
            columns: ["customer_invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_profit_center_id_fkey"
            columns: ["profit_center_id"]
            isOneToOne: false
            referencedRelation: "profit_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_supplier_invoice_id_fkey"
            columns: ["supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_expenses: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          expense_date: string
          expense_type: string
          id: string
          project_id: string
          supplier_name: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          expense_date: string
          expense_type: string
          id?: string
          project_id: string
          supplier_name?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          expense_date?: string
          expense_type?: string
          id?: string
          project_id?: string
          supplier_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logistics_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "management_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      mail_messages: {
        Row: {
          created_at: string | null
          date: string | null
          flags: string[] | null
          folder: string
          from_address: string | null
          has_attachments: boolean | null
          id: string
          snippet: string | null
          subject: string | null
          synced_at: string | null
          to_address: string | null
          uid: number
          updated_at: string | null
          user_email: string
        }
        Insert: {
          created_at?: string | null
          date?: string | null
          flags?: string[] | null
          folder?: string
          from_address?: string | null
          has_attachments?: boolean | null
          id?: string
          snippet?: string | null
          subject?: string | null
          synced_at?: string | null
          to_address?: string | null
          uid: number
          updated_at?: string | null
          user_email: string
        }
        Update: {
          created_at?: string | null
          date?: string | null
          flags?: string[] | null
          folder?: string
          from_address?: string | null
          has_attachments?: boolean | null
          id?: string
          snippet?: string | null
          subject?: string | null
          synced_at?: string | null
          to_address?: string | null
          uid?: number
          updated_at?: string | null
          user_email?: string
        }
        Relationships: []
      }
      mail_sync_state: {
        Row: {
          folder: string
          id: string
          last_sync_at: string | null
          uidnext: number | null
          uidvalidity: number | null
          user_email: string
        }
        Insert: {
          folder: string
          id?: string
          last_sync_at?: string | null
          uidnext?: number | null
          uidvalidity?: number | null
          user_email: string
        }
        Update: {
          folder?: string
          id?: string
          last_sync_at?: string | null
          uidnext?: number | null
          uidvalidity?: number | null
          user_email?: string
        }
        Relationships: []
      }
      management_projects: {
        Row: {
          actual_costs: number | null
          actual_revenue: number | null
          code: string
          created_at: string | null
          customer_id: string | null
          customer_name: string
          end_date: string | null
          estimated_costs: number | null
          estimated_revenue: number | null
          id: string
          key_result_id: string | null
          machine_model: string | null
          objective_id: string | null
          profit_center_id: string | null
          project_type: string
          start_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          actual_costs?: number | null
          actual_revenue?: number | null
          code: string
          created_at?: string | null
          customer_id?: string | null
          customer_name: string
          end_date?: string | null
          estimated_costs?: number | null
          estimated_revenue?: number | null
          id?: string
          key_result_id?: string | null
          machine_model?: string | null
          objective_id?: string | null
          profit_center_id?: string | null
          project_type: string
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_costs?: number | null
          actual_revenue?: number | null
          code?: string
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string
          end_date?: string | null
          estimated_costs?: number | null
          estimated_revenue?: number | null
          id?: string
          key_result_id?: string | null
          machine_model?: string | null
          objective_id?: string | null
          profit_center_id?: string | null
          project_type?: string
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "management_projects_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "key_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_projects_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "strategic_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_projects_profit_center_id_fkey"
            columns: ["profit_center_id"]
            isOneToOne: false
            referencedRelation: "profit_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      management_timesheets: {
        Row: {
          activity_type: string | null
          created_at: string | null
          date: string
          description: string | null
          hourly_rate: number
          hours: number
          id: string
          project_id: string | null
          technician_id: string | null
          technician_name: string
          total_cost: number | null
          updated_at: string | null
        }
        Insert: {
          activity_type?: string | null
          created_at?: string | null
          date: string
          description?: string | null
          hourly_rate: number
          hours: number
          id?: string
          project_id?: string | null
          technician_id?: string | null
          technician_name: string
          total_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          activity_type?: string | null
          created_at?: string | null
          date?: string
          description?: string | null
          hourly_rate?: number
          hours?: number
          id?: string
          project_id?: string | null
          technician_id?: string | null
          technician_name?: string
          total_cost?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "management_timesheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "management_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_content: {
        Row: {
          assigned_to: string | null
          content_type: string
          content_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          notes: string | null
          platform: string | null
          priority: string | null
          published_date: string | null
          status: string
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          content_type: string
          content_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          platform?: string | null
          priority?: string | null
          published_date?: string | null
          status?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          content_type?: string
          content_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          platform?: string | null
          priority?: string | null
          published_date?: string | null
          status?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_materials: {
        Row: {
          category: string
          created_at: string
          description: string | null
          equipment_type: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          tags: string[] | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          equipment_type: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          tags?: string[] | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          equipment_type?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          tags?: string[] | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      materials: {
        Row: {
          active: boolean | null
          category: string | null
          code: string
          cost: number | null
          created_at: string
          current_stock: number | null
          description: string | null
          id: string
          location: string | null
          material_type: string
          maximum_stock: number | null
          minimum_stock: number | null
          name: string
          supplier_id: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          code: string
          cost?: number | null
          created_at?: string
          current_stock?: number | null
          description?: string | null
          id?: string
          location?: string | null
          material_type: string
          maximum_stock?: number | null
          minimum_stock?: number | null
          name: string
          supplier_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          category?: string | null
          code?: string
          cost?: number | null
          created_at?: string
          current_stock?: number | null
          description?: string | null
          id?: string
          location?: string | null
          material_type?: string
          maximum_stock?: number | null
          minimum_stock?: number | null
          name?: string
          supplier_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_checkups: {
        Row: {
          certificate_url: string | null
          checkup_date: string
          created_at: string | null
          doctor_name: string | null
          employee_id: string | null
          expiry_date: string
          id: string
          notes: string | null
          result: string | null
          updated_at: string | null
        }
        Insert: {
          certificate_url?: string | null
          checkup_date: string
          created_at?: string | null
          doctor_name?: string | null
          employee_id?: string | null
          expiry_date: string
          id?: string
          notes?: string | null
          result?: string | null
          updated_at?: string | null
        }
        Update: {
          certificate_url?: string | null
          checkup_date?: string
          created_at?: string | null
          doctor_name?: string | null
          employee_id?: string | null
          expiry_date?: string
          id?: string
          notes?: string | null
          result?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_checkups_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      movimenti_finanziari: {
        Row: {
          allegato_nome: string | null
          allegato_url: string | null
          centro_costo_id: string | null
          centro_ricavo_id: string | null
          classificato_at: string | null
          classificato_da: string | null
          conto_id: string | null
          created_at: string
          created_by: string | null
          data_movimento: string
          descrizione: string | null
          direzione: string
          fattura_id: string | null
          id: string
          importo: number
          metodo_pagamento: string
          note_cfo: string | null
          prima_nota_id: string | null
          riferimento: string | null
          scadenza_id: string | null
          soggetto_id: string | null
          soggetto_nome: string | null
          soggetto_tipo: string | null
          stato: string
          tipo_allocazione: string | null
          updated_at: string
        }
        Insert: {
          allegato_nome?: string | null
          allegato_url?: string | null
          centro_costo_id?: string | null
          centro_ricavo_id?: string | null
          classificato_at?: string | null
          classificato_da?: string | null
          conto_id?: string | null
          created_at?: string
          created_by?: string | null
          data_movimento: string
          descrizione?: string | null
          direzione: string
          fattura_id?: string | null
          id?: string
          importo: number
          metodo_pagamento: string
          note_cfo?: string | null
          prima_nota_id?: string | null
          riferimento?: string | null
          scadenza_id?: string | null
          soggetto_id?: string | null
          soggetto_nome?: string | null
          soggetto_tipo?: string | null
          stato?: string
          tipo_allocazione?: string | null
          updated_at?: string
        }
        Update: {
          allegato_nome?: string | null
          allegato_url?: string | null
          centro_costo_id?: string | null
          centro_ricavo_id?: string | null
          classificato_at?: string | null
          classificato_da?: string | null
          conto_id?: string | null
          created_at?: string
          created_by?: string | null
          data_movimento?: string
          descrizione?: string | null
          direzione?: string
          fattura_id?: string | null
          id?: string
          importo?: number
          metodo_pagamento?: string
          note_cfo?: string | null
          prima_nota_id?: string | null
          riferimento?: string | null
          scadenza_id?: string | null
          soggetto_id?: string | null
          soggetto_nome?: string | null
          soggetto_tipo?: string | null
          stato?: string
          tipo_allocazione?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimenti_finanziari_centro_costo_id_fkey"
            columns: ["centro_costo_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_finanziari_centro_ricavo_id_fkey"
            columns: ["centro_ricavo_id"]
            isOneToOne: false
            referencedRelation: "profit_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_finanziari_conto_id_fkey"
            columns: ["conto_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_finanziari_fattura_id_fkey"
            columns: ["fattura_id"]
            isOneToOne: false
            referencedRelation: "invoice_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_finanziari_prima_nota_id_fkey"
            columns: ["prima_nota_id"]
            isOneToOne: false
            referencedRelation: "prima_nota"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_finanziari_scadenza_id_fkey"
            columns: ["scadenza_id"]
            isOneToOne: false
            referencedRelation: "scadenze"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_templates: {
        Row: {
          attachments: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          footer_text: string
          header_text: string
          id: string
          is_default: boolean | null
          logo_url: string | null
          message: string
          name: string
          signature: string
          subject: string
          updated_at: string
        }
        Insert: {
          attachments?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          footer_text?: string
          header_text?: string
          id?: string
          is_default?: boolean | null
          logo_url?: string | null
          message: string
          name: string
          signature?: string
          subject: string
          updated_at?: string
        }
        Update: {
          attachments?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          footer_text?: string
          header_text?: string
          id?: string
          is_default?: boolean | null
          logo_url?: string | null
          message?: string
          name?: string
          signature?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message: string
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      offer_items: {
        Row: {
          created_at: string
          description: string
          discount_percent: number | null
          id: string
          notes: string | null
          offer_id: string
          product_id: string | null
          product_name: string | null
          quantity: number
          total_price: number | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          discount_percent?: number | null
          id?: string
          notes?: string | null
          offer_id: string
          product_id?: string | null
          product_name?: string | null
          quantity?: number
          total_price?: number | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          discount_percent?: number | null
          id?: string
          notes?: string | null
          offer_id?: string
          product_id?: string | null
          product_name?: string | null
          quantity?: number
          total_price?: number | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_items_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          amount: number
          approved: boolean | null
          approved_at: string | null
          approved_by: string | null
          approved_by_name: string | null
          archived: boolean | null
          assigned_to: string | null
          attachments: string[] | null
          company_entity: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          description: string | null
          escluso_fornitura: string | null
          id: string
          incluso_fornitura: string | null
          language: string | null
          lead_id: string | null
          metodi_pagamento: string | null
          number: string
          payment_agreement: string | null
          payment_method: string | null
          payment_terms: string | null
          priority: string | null
          status: string
          template: string | null
          timeline_collaudo: string | null
          timeline_consegna: string | null
          timeline_installazione: string | null
          timeline_produzione: string | null
          title: string
          unique_code: string | null
          updated_at: string
          valid_until: string | null
          vat_regime: string | null
        }
        Insert: {
          amount?: number
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          archived?: boolean | null
          assigned_to?: string | null
          attachments?: string[] | null
          company_entity?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name: string
          description?: string | null
          escluso_fornitura?: string | null
          id?: string
          incluso_fornitura?: string | null
          language?: string | null
          lead_id?: string | null
          metodi_pagamento?: string | null
          number: string
          payment_agreement?: string | null
          payment_method?: string | null
          payment_terms?: string | null
          priority?: string | null
          status?: string
          template?: string | null
          timeline_collaudo?: string | null
          timeline_consegna?: string | null
          timeline_installazione?: string | null
          timeline_produzione?: string | null
          title: string
          unique_code?: string | null
          updated_at?: string
          valid_until?: string | null
          vat_regime?: string | null
        }
        Update: {
          amount?: number
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          archived?: boolean | null
          assigned_to?: string | null
          attachments?: string[] | null
          company_entity?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          description?: string | null
          escluso_fornitura?: string | null
          id?: string
          incluso_fornitura?: string | null
          language?: string | null
          lead_id?: string | null
          metodi_pagamento?: string | null
          number?: string
          payment_agreement?: string | null
          payment_method?: string | null
          payment_terms?: string | null
          priority?: string | null
          status?: string
          template?: string | null
          timeline_collaudo?: string | null
          timeline_consegna?: string | null
          timeline_installazione?: string | null
          timeline_produzione?: string | null
          title?: string
          unique_code?: string | null
          updated_at?: string
          valid_until?: string | null
          vat_regime?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_activities: {
        Row: {
          activity_type: string
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          opportunity_id: string
          scheduled_date: string | null
          title: string
        }
        Insert: {
          activity_type: string
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          opportunity_id: string
          scheduled_date?: string | null
          title: string
        }
        Update: {
          activity_type?: string
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          opportunity_id?: string
          scheduled_date?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_activities_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_files: {
        Row: {
          file_name: string
          file_path: string
          file_type: string
          id: string
          opportunity_id: string
          uploaded_at: string
        }
        Insert: {
          file_name: string
          file_path: string
          file_type: string
          id?: string
          opportunity_id: string
          uploaded_at?: string
        }
        Update: {
          file_name?: string
          file_path?: string
          file_type?: string
          id?: string
          opportunity_id?: string
          uploaded_at?: string
        }
        Relationships: []
      }
      oracle_insights: {
        Row: {
          confidence: number | null
          converted_to_objective_id: string | null
          created_at: string
          data_source: string | null
          description: string
          id: string
          insight_type: string
          is_dismissed: boolean | null
          raw_data: Json | null
          suggested_action: string | null
          title: string
        }
        Insert: {
          confidence?: number | null
          converted_to_objective_id?: string | null
          created_at?: string
          data_source?: string | null
          description: string
          id?: string
          insight_type: string
          is_dismissed?: boolean | null
          raw_data?: Json | null
          suggested_action?: string | null
          title: string
        }
        Update: {
          confidence?: number | null
          converted_to_objective_id?: string | null
          created_at?: string
          data_source?: string | null
          description?: string
          id?: string
          insight_type?: string
          is_dismissed?: boolean | null
          raw_data?: Json | null
          suggested_action?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "oracle_insights_converted_to_objective_id_fkey"
            columns: ["converted_to_objective_id"]
            isOneToOne: false
            referencedRelation: "strategic_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      order_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          mentions: string[] | null
          service_work_order_id: string | null
          shipping_order_id: string | null
          updated_at: string
          user_id: string
          work_order_id: string | null
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          mentions?: string[] | null
          service_work_order_id?: string | null
          shipping_order_id?: string | null
          updated_at?: string
          user_id: string
          work_order_id?: string | null
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          mentions?: string[] | null
          service_work_order_id?: string | null
          shipping_order_id?: string | null
          updated_at?: string
          user_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_comments_service_work_order_id_fkey"
            columns: ["service_work_order_id"]
            isOneToOne: false
            referencedRelation: "service_work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_comments_shipping_order_id_fkey"
            columns: ["shipping_order_id"]
            isOneToOne: false
            referencedRelation: "shipping_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_comments_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_address: string | null
          billing_city: string | null
          billing_company_name: string | null
          billing_country: string | null
          billing_name: string | null
          billing_phone: string | null
          billing_postal_code: string | null
          billing_sdi_code: string | null
          billing_vat_number: string | null
          created_at: string
          email: string
          id: string
          iva_amount: number
          paypal_order_id: string | null
          quantity: number
          shipping_address: string | null
          shipping_city: string | null
          shipping_complete: boolean | null
          shipping_cost: number
          shipping_country: string | null
          shipping_name: string | null
          shipping_phone: string | null
          shipping_postal_code: string | null
          size: string
          status: string
          subtotal: number
          total_amount: number
          unit_price: number
          updated_at: string
          user_id: string | null
          variant: string
        }
        Insert: {
          billing_address?: string | null
          billing_city?: string | null
          billing_company_name?: string | null
          billing_country?: string | null
          billing_name?: string | null
          billing_phone?: string | null
          billing_postal_code?: string | null
          billing_sdi_code?: string | null
          billing_vat_number?: string | null
          created_at?: string
          email: string
          id?: string
          iva_amount: number
          paypal_order_id?: string | null
          quantity?: number
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_complete?: boolean | null
          shipping_cost?: number
          shipping_country?: string | null
          shipping_name?: string | null
          shipping_phone?: string | null
          shipping_postal_code?: string | null
          size: string
          status?: string
          subtotal: number
          total_amount: number
          unit_price: number
          updated_at?: string
          user_id?: string | null
          variant: string
        }
        Update: {
          billing_address?: string | null
          billing_city?: string | null
          billing_company_name?: string | null
          billing_country?: string | null
          billing_name?: string | null
          billing_phone?: string | null
          billing_postal_code?: string | null
          billing_sdi_code?: string | null
          billing_vat_number?: string | null
          created_at?: string
          email?: string
          id?: string
          iva_amount?: number
          paypal_order_id?: string | null
          quantity?: number
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_complete?: boolean | null
          shipping_cost?: number
          shipping_country?: string | null
          shipping_name?: string | null
          shipping_phone?: string | null
          shipping_postal_code?: string | null
          size?: string
          status?: string
          subtotal?: number
          total_amount?: number
          unit_price?: number
          updated_at?: string
          user_id?: string | null
          variant?: string
        }
        Relationships: []
      }
      oven_model_products: {
        Row: {
          created_at: string | null
          id: string
          oven_model_id: string
          price: number
          product_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          oven_model_id: string
          price: number
          product_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          oven_model_id?: string
          price?: number
          product_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oven_model_products_oven_model_id_fkey"
            columns: ["oven_model_id"]
            isOneToOne: false
            referencedRelation: "oven_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oven_model_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      oven_models: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_urls: string[] | null
          is_active: boolean | null
          name: string
          power_types: string[] | null
          sizes_available: number[] | null
          updated_at: string | null
          video_urls: string[] | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_urls?: string[] | null
          is_active?: boolean | null
          name: string
          power_types?: string[] | null
          sizes_available?: number[] | null
          updated_at?: string | null
          video_urls?: string[] | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_urls?: string[] | null
          is_active?: boolean | null
          name?: string
          power_types?: string[] | null
          sizes_available?: number[] | null
          updated_at?: string | null
          video_urls?: string[] | null
        }
        Relationships: []
      }
      partner_materials: {
        Row: {
          created_at: string
          id: string
          material_name: string
          material_type: string | null
          notes: string | null
          partner_id: string
          quantity: number | null
          updated_at: string
          uploaded_file_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          material_name: string
          material_type?: string | null
          notes?: string | null
          partner_id: string
          quantity?: number | null
          updated_at?: string
          uploaded_file_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          material_name?: string
          material_type?: string | null
          notes?: string | null
          partner_id?: string
          quantity?: number | null
          updated_at?: string
          uploaded_file_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_materials_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          acquisition_notes: string | null
          acquisition_status: string | null
          address: string
          company_name: string
          country: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          partner_type: string | null
          phone: string | null
          price_lists: Json | null
          pricing_notes: string | null
          priority: string | null
          region: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          acquisition_notes?: string | null
          acquisition_status?: string | null
          address: string
          company_name: string
          country?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          partner_type?: string | null
          phone?: string | null
          price_lists?: Json | null
          pricing_notes?: string | null
          priority?: string | null
          region?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          acquisition_notes?: string | null
          acquisition_status?: string | null
          address?: string
          company_name?: string
          country?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          partner_type?: string | null
          phone?: string | null
          price_lists?: Json | null
          pricing_notes?: string | null
          priority?: string | null
          region?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      pbx_numbers: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          phone_number: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone_number: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      phone_extensions: {
        Row: {
          created_at: string
          department: string | null
          extension_number: string
          id: string
          is_active: boolean | null
          operator_email: string | null
          operator_name: string
          pbx_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          extension_number: string
          id?: string
          is_active?: boolean | null
          operator_email?: string | null
          operator_name: string
          pbx_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          extension_number?: string
          id?: string
          is_active?: boolean | null
          operator_email?: string | null
          operator_name?: string
          pbx_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phone_extensions_pbx_id_fkey"
            columns: ["pbx_id"]
            isOneToOne: false
            referencedRelation: "pbx_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_audit_logs: {
        Row: {
          action: string
          changed_fields: string[] | null
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          price_list_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          price_list_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          price_list_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_list_audit_logs_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_items: {
        Row: {
          cost_price: number | null
          created_at: string
          discount_percentage: number | null
          id: string
          minimum_quantity: number | null
          notes: string | null
          price: number
          price_list_id: string
          product_id: string
          updated_at: string
        }
        Insert: {
          cost_price?: number | null
          created_at?: string
          discount_percentage?: number | null
          id?: string
          minimum_quantity?: number | null
          notes?: string | null
          price: number
          price_list_id: string
          product_id: string
          updated_at?: string
        }
        Update: {
          cost_price?: number | null
          created_at?: string
          discount_percentage?: number | null
          id?: string
          minimum_quantity?: number | null
          notes?: string | null
          price?: number
          price_list_id?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_items_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lists: {
        Row: {
          code: string
          country: string | null
          created_at: string
          customer_category: string | null
          default_multiplier: number | null
          description: string | null
          id: string
          is_active: boolean | null
          list_type: string
          name: string
          priority: number | null
          region: string | null
          target_type: string | null
          tier: string | null
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          code: string
          country?: string | null
          created_at?: string
          customer_category?: string | null
          default_multiplier?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          list_type: string
          name: string
          priority?: number | null
          region?: string | null
          target_type?: string | null
          tier?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          code?: string
          country?: string | null
          created_at?: string
          customer_category?: string | null
          default_multiplier?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          list_type?: string
          name?: string
          priority?: number | null
          region?: string | null
          target_type?: string | null
          tier?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: []
      }
      prima_nota: {
        Row: {
          accounting_entry_id: string
          accounting_period: string | null
          amount: number
          blocked_at: string | null
          center_percentage: number | null
          chart_account_id: string | null
          competence_date: string
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          imponibile: number | null
          installment_number: number | null
          is_rectification: boolean | null
          iva_aliquota: number | null
          iva_amount: number | null
          iva_mode: string | null
          movement_type: string
          original_movement_id: string | null
          payment_method: string | null
          profit_center_id: string | null
          rectification_reason: string | null
          rectified_by: string | null
          registered_at: string | null
          registered_by: string | null
          status: string
          total_installments: number | null
          totale: number | null
        }
        Insert: {
          accounting_entry_id: string
          accounting_period?: string | null
          amount: number
          blocked_at?: string | null
          center_percentage?: number | null
          chart_account_id?: string | null
          competence_date: string
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          imponibile?: number | null
          installment_number?: number | null
          is_rectification?: boolean | null
          iva_aliquota?: number | null
          iva_amount?: number | null
          iva_mode?: string | null
          movement_type: string
          original_movement_id?: string | null
          payment_method?: string | null
          profit_center_id?: string | null
          rectification_reason?: string | null
          rectified_by?: string | null
          registered_at?: string | null
          registered_by?: string | null
          status?: string
          total_installments?: number | null
          totale?: number | null
        }
        Update: {
          accounting_entry_id?: string
          accounting_period?: string | null
          amount?: number
          blocked_at?: string | null
          center_percentage?: number | null
          chart_account_id?: string | null
          competence_date?: string
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          imponibile?: number | null
          installment_number?: number | null
          is_rectification?: boolean | null
          iva_aliquota?: number | null
          iva_amount?: number | null
          iva_mode?: string | null
          movement_type?: string
          original_movement_id?: string | null
          payment_method?: string | null
          profit_center_id?: string | null
          rectification_reason?: string | null
          rectified_by?: string | null
          registered_at?: string | null
          registered_by?: string | null
          status?: string
          total_installments?: number | null
          totale?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prima_nota_accounting_entry_id_fkey"
            columns: ["accounting_entry_id"]
            isOneToOne: false
            referencedRelation: "accounting_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prima_nota_chart_account_id_fkey"
            columns: ["chart_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prima_nota_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prima_nota_original_movement_id_fkey"
            columns: ["original_movement_id"]
            isOneToOne: false
            referencedRelation: "prima_nota"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prima_nota_profit_center_id_fkey"
            columns: ["profit_center_id"]
            isOneToOne: false
            referencedRelation: "profit_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prima_nota_rectified_by_fkey"
            columns: ["rectified_by"]
            isOneToOne: false
            referencedRelation: "prima_nota"
            referencedColumns: ["id"]
          },
        ]
      }
      prima_nota_lines: {
        Row: {
          account_type: string
          avere: number
          chart_account_id: string | null
          created_at: string
          dare: number
          description: string | null
          dynamic_account_key: string | null
          id: string
          line_order: number
          prima_nota_id: string
          structural_account_id: string | null
        }
        Insert: {
          account_type: string
          avere?: number
          chart_account_id?: string | null
          created_at?: string
          dare?: number
          description?: string | null
          dynamic_account_key?: string | null
          id?: string
          line_order?: number
          prima_nota_id: string
          structural_account_id?: string | null
        }
        Update: {
          account_type?: string
          avere?: number
          chart_account_id?: string | null
          created_at?: string
          dare?: number
          description?: string | null
          dynamic_account_key?: string | null
          id?: string
          line_order?: number
          prima_nota_id?: string
          structural_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prima_nota_lines_chart_account_id_fkey"
            columns: ["chart_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prima_nota_lines_prima_nota_id_fkey"
            columns: ["prima_nota_id"]
            isOneToOne: false
            referencedRelation: "prima_nota"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prima_nota_lines_structural_account_id_fkey"
            columns: ["structural_account_id"]
            isOneToOne: false
            referencedRelation: "structural_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      product_configurations: {
        Row: {
          additional_info: Json | null
          base_price_wood: number | null
          created_at: string | null
          id: string
          image_url: string | null
          image_urls: string[] | null
          installation_type: string | null
          is_available: boolean | null
          model_name: string
          pizza_count_gas_electric: string | null
          pizza_count_wood: string | null
          power_type: string | null
          price_electric: number | null
          price_gas: number | null
          price_onsite_installation: number | null
          product_id: string | null
          size: string | null
          updated_at: string | null
          video_urls: string[] | null
        }
        Insert: {
          additional_info?: Json | null
          base_price_wood?: number | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          installation_type?: string | null
          is_available?: boolean | null
          model_name: string
          pizza_count_gas_electric?: string | null
          pizza_count_wood?: string | null
          power_type?: string | null
          price_electric?: number | null
          price_gas?: number | null
          price_onsite_installation?: number | null
          product_id?: string | null
          size?: string | null
          updated_at?: string | null
          video_urls?: string[] | null
        }
        Update: {
          additional_info?: Json | null
          base_price_wood?: number | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          installation_type?: string | null
          is_available?: boolean | null
          model_name?: string
          pizza_count_gas_electric?: string | null
          pizza_count_wood?: string | null
          power_type?: string | null
          price_electric?: number | null
          price_gas?: number | null
          price_onsite_installation?: number | null
          product_id?: string | null
          size?: string | null
          updated_at?: string | null
          video_urls?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "product_configurations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_configurator_links: {
        Row: {
          configuration_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          last_viewed_at: string | null
          lead_id: string | null
          product_id: string | null
          title: string | null
          unique_code: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          configuration_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_viewed_at?: string | null
          lead_id?: string | null
          product_id?: string | null
          title?: string | null
          unique_code: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          configuration_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_viewed_at?: string | null
          lead_id?: string | null
          product_id?: string | null
          title?: string | null
          unique_code?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_configurator_links_configuration_id_fkey"
            columns: ["configuration_id"]
            isOneToOne: false
            referencedRelation: "product_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_configurator_links_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_configurator_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_configurator_media: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_primary: boolean | null
          media_type: string
          media_url: string
          product_id: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_primary?: boolean | null
          media_type: string
          media_url: string
          product_id: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_primary?: boolean | null
          media_type?: string
          media_url?: string
          product_id?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_configurator_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number | null
          bom_id: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          material_id: string | null
          name: string
          product_type: string
          technical_specs: Json | null
          unit_of_measure: string | null
          updated_at: string
        }
        Insert: {
          base_price?: number | null
          bom_id?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          material_id?: string | null
          name: string
          product_type: string
          technical_specs?: Json | null
          unit_of_measure?: string | null
          updated_at?: string
        }
        Update: {
          base_price?: number | null
          bom_id?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          material_id?: string | null
          name?: string
          product_type?: string
          technical_specs?: Json | null
          unit_of_measure?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          hide_amounts: boolean | null
          id: string
          last_name: string | null
          site_origin: string | null
          updated_at: string
          user_type: string | null
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          hide_amounts?: boolean | null
          id: string
          last_name?: string | null
          site_origin?: string | null
          updated_at?: string
          user_type?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          hide_amounts?: boolean | null
          id?: string
          last_name?: string | null
          site_origin?: string | null
          updated_at?: string
          user_type?: string | null
        }
        Relationships: []
      }
      profit_centers: {
        Row: {
          account_code: string | null
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          machine_model: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          account_code?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          machine_model?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          account_code?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          machine_model?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      project_materials: {
        Row: {
          created_at: string | null
          id: string
          is_kit: boolean | null
          material_id: string | null
          material_name: string
          project_id: string
          quantity: number
          total_cost: number | null
          unit_cost: number
          updated_at: string | null
          usage_date: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_kit?: boolean | null
          material_id?: string | null
          material_name: string
          project_id: string
          quantity: number
          total_cost?: number | null
          unit_cost: number
          updated_at?: string | null
          usage_date?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_kit?: boolean | null
          material_id?: string | null
          material_name?: string
          project_id?: string
          quantity?: number
          total_cost?: number | null
          unit_cost?: number
          updated_at?: string | null
          usage_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_materials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "management_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          purchase_order_id: string
          uploaded_at: string | null
          uploaded_by_supplier: boolean | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          purchase_order_id: string
          uploaded_at?: string | null
          uploaded_by_supplier?: boolean | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          purchase_order_id?: string
          uploaded_at?: string | null
          uploaded_by_supplier?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_attachments_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_change_requests: {
        Row: {
          created_at: string | null
          current_value: string | null
          id: string
          proposed_value: string
          purchase_order_id: string
          reason: string | null
          request_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          current_value?: string | null
          id?: string
          proposed_value: string
          purchase_order_id: string
          reason?: string | null
          request_type: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          current_value?: string | null
          id?: string
          proposed_value?: string
          purchase_order_id?: string
          reason?: string | null
          request_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_change_requests_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_comments: {
        Row: {
          comment: string
          created_at: string | null
          id: string
          is_supplier: boolean | null
          purchase_order_id: string
          supplier_name: string | null
          user_id: string | null
        }
        Insert: {
          comment: string
          created_at?: string | null
          id?: string
          is_supplier?: boolean | null
          purchase_order_id: string
          supplier_name?: string | null
          user_id?: string | null
        }
        Update: {
          comment?: string
          created_at?: string | null
          id?: string
          is_supplier?: boolean | null
          purchase_order_id?: string
          supplier_name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_comments_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_confirmations: {
        Row: {
          confirmation_token: string
          confirmed: boolean | null
          confirmed_at: string | null
          created_at: string
          expires_at: string
          id: string
          purchase_order_id: string
          supplier_delivery_date: string | null
          supplier_email: string
          supplier_notes: string | null
          updated_at: string
        }
        Insert: {
          confirmation_token: string
          confirmed?: boolean | null
          confirmed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          purchase_order_id: string
          supplier_delivery_date?: string | null
          supplier_email: string
          supplier_notes?: string | null
          updated_at?: string
        }
        Update: {
          confirmation_token?: string
          confirmed?: boolean | null
          confirmed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          purchase_order_id?: string
          supplier_delivery_date?: string | null
          supplier_email?: string
          supplier_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_confirmations_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          material_id: string | null
          notes: string | null
          purchase_order_id: string | null
          quantity: number
          total_price: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_id?: string | null
          notes?: string | null
          purchase_order_id?: string | null
          quantity: number
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string | null
          notes?: string | null
          purchase_order_id?: string | null
          quantity?: number
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_status_updates: {
        Row: {
          created_at: string | null
          estimated_delivery_date: string | null
          id: string
          new_status: string
          notes: string | null
          old_status: string | null
          purchase_order_id: string
          updated_by_supplier: boolean | null
        }
        Insert: {
          created_at?: string | null
          estimated_delivery_date?: string | null
          id?: string
          new_status: string
          notes?: string | null
          old_status?: string | null
          purchase_order_id: string
          updated_by_supplier?: boolean | null
        }
        Update: {
          created_at?: string | null
          estimated_delivery_date?: string | null
          id?: string
          new_status?: string
          notes?: string | null
          old_status?: string | null
          purchase_order_id?: string
          updated_by_supplier?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_status_updates_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          actual_delivery_date: string | null
          archived: boolean | null
          created_at: string
          created_by: string | null
          delivery_timeframe_days: number | null
          estimated_delivery_date: string | null
          expected_delivery_date: string | null
          id: string
          notes: string | null
          number: string
          order_date: string
          priority: string | null
          production_status: string | null
          status: string
          subtotal: number | null
          supplier_confirmed_at: string | null
          supplier_confirmed_by: string | null
          supplier_id: string | null
          tax_amount: number | null
          total_amount: number | null
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          actual_delivery_date?: string | null
          archived?: boolean | null
          created_at?: string
          created_by?: string | null
          delivery_timeframe_days?: number | null
          estimated_delivery_date?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          number: string
          order_date?: string
          priority?: string | null
          production_status?: string | null
          status?: string
          subtotal?: number | null
          supplier_confirmed_at?: string | null
          supplier_confirmed_by?: string | null
          supplier_id?: string | null
          tax_amount?: number | null
          total_amount?: number | null
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          actual_delivery_date?: string | null
          archived?: boolean | null
          created_at?: string
          created_by?: string | null
          delivery_timeframe_days?: number | null
          estimated_delivery_date?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          number?: string
          order_date?: string
          priority?: string | null
          production_status?: string | null
          status?: string
          subtotal?: number | null
          supplier_confirmed_at?: string | null
          supplier_confirmed_by?: string | null
          supplier_id?: string | null
          tax_amount?: number | null
          total_amount?: number | null
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_codes: {
        Row: {
          cancelled_at: string | null
          client_email: string | null
          client_name: string | null
          code: string
          created_at: string
          custom_quote_id: string
          expires_at: string | null
          id: string
          is_used: boolean | null
          paypal_subscription_id: string | null
          subscription_status: string | null
          used_at: string | null
        }
        Insert: {
          cancelled_at?: string | null
          client_email?: string | null
          client_name?: string | null
          code: string
          created_at?: string
          custom_quote_id: string
          expires_at?: string | null
          id?: string
          is_used?: boolean | null
          paypal_subscription_id?: string | null
          subscription_status?: string | null
          used_at?: string | null
        }
        Update: {
          cancelled_at?: string | null
          client_email?: string | null
          client_name?: string | null
          code?: string
          created_at?: string
          custom_quote_id?: string
          expires_at?: string | null
          id?: string
          is_used?: boolean | null
          paypal_subscription_id?: string | null
          subscription_status?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_codes_custom_quote_id_fkey"
            columns: ["custom_quote_id"]
            isOneToOne: false
            referencedRelation: "custom_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_requests: {
        Row: {
          business_location: string
          business_name: string
          business_size: string | null
          business_type: string
          created_at: string
          custom_services: string[] | null
          email: string | null
          id: string
          phone: string
          special_needs: string | null
          user_id: string | null
        }
        Insert: {
          business_location: string
          business_name: string
          business_size?: string | null
          business_type: string
          created_at?: string
          custom_services?: string[] | null
          email?: string | null
          id?: string
          phone: string
          special_needs?: string | null
          user_id?: string | null
        }
        Update: {
          business_location?: string
          business_name?: string
          business_size?: string | null
          business_type?: string
          created_at?: string
          custom_services?: string[] | null
          email?: string | null
          id?: string
          phone?: string
          special_needs?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          date: string | null
          id: string
          notes: string | null
          number: string
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          date?: string | null
          id?: string
          notes?: string | null
          number: string
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          date?: string | null
          id?: string
          notes?: string | null
          number?: string
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_subscriptions: {
        Row: {
          active: boolean | null
          amount: number
          causale: string
          created_at: string
          frequency: string
          id: string
          monitor: boolean | null
          name: string
          next_payment: string
          notes: string | null
          payment_method: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean | null
          amount: number
          causale: string
          created_at?: string
          frequency: string
          id?: string
          monitor?: boolean | null
          name: string
          next_payment: string
          notes?: string | null
          payment_method: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean | null
          amount?: number
          causale?: string
          created_at?: string
          frequency?: string
          id?: string
          monitor?: boolean | null
          name?: string
          next_payment?: string
          notes?: string | null
          payment_method?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_task_completions: {
        Row: {
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          notes: string | null
          recurring_task_id: string
          updated_at: string
          week_end: string
          week_start: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          recurring_task_id: string
          updated_at?: string
          week_end: string
          week_start: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          recurring_task_id?: string
          updated_at?: string
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_task_completions_recurring_task_id_fkey"
            columns: ["recurring_task_id"]
            isOneToOne: false
            referencedRelation: "recurring_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_tasks: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_generated_date: string | null
          recurrence_days: number[] | null
          recurrence_end_date: string | null
          recurrence_interval: number
          recurrence_type: Database["public"]["Enums"]["recurrence_type"]
          task_template_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_generated_date?: string | null
          recurrence_days?: number[] | null
          recurrence_end_date?: string | null
          recurrence_interval?: number
          recurrence_type?: Database["public"]["Enums"]["recurrence_type"]
          task_template_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_generated_date?: string | null
          recurrence_days?: number[] | null
          recurrence_end_date?: string | null
          recurrence_interval?: number
          recurrence_type?: Database["public"]["Enums"]["recurrence_type"]
          task_template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_tasks_task_template_id_fkey"
            columns: ["task_template_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rma: {
        Row: {
          assigned_to: string | null
          closed_date: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string
          id: string
          opened_date: string
          resolution_notes: string | null
          rma_number: string
          serial_id: string | null
          status: Database["public"]["Enums"]["rma_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          closed_date?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description: string
          id?: string
          opened_date?: string
          resolution_notes?: string | null
          rma_number: string
          serial_id?: string | null
          status?: Database["public"]["Enums"]["rma_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          closed_date?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string
          id?: string
          opened_date?: string
          resolution_notes?: string | null
          rma_number?: string
          serial_id?: string | null
          status?: Database["public"]["Enums"]["rma_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rma_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rma_serial_id_fkey"
            columns: ["serial_id"]
            isOneToOne: false
            referencedRelation: "serials"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_appointments: {
        Row: {
          appointment_date: string
          appointment_type: string
          certificate_url: string | null
          created_at: string | null
          employee_id: string | null
          employee_name: string
          expiry_date: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          appointment_date: string
          appointment_type: string
          certificate_url?: string | null
          created_at?: string | null
          employee_id?: string | null
          employee_name: string
          expiry_date?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          appointment_date?: string
          appointment_type?: string
          certificate_url?: string | null
          created_at?: string | null
          employee_id?: string | null
          employee_name?: string
          expiry_date?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_appointments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_documents: {
        Row: {
          created_at: string | null
          document_name: string
          document_type: string
          document_url: string
          expiry_date: string | null
          id: string
          notes: string | null
          updated_at: string | null
          upload_date: string
        }
        Insert: {
          created_at?: string | null
          document_name: string
          document_type: string
          document_url: string
          expiry_date?: string | null
          id?: string
          notes?: string | null
          updated_at?: string | null
          upload_date: string
        }
        Update: {
          created_at?: string | null
          document_name?: string
          document_type?: string
          document_url?: string
          expiry_date?: string | null
          id?: string
          notes?: string | null
          updated_at?: string | null
          upload_date?: string
        }
        Relationships: []
      }
      safety_training_records: {
        Row: {
          certificate_url: string | null
          created_at: string | null
          employee_id: string | null
          expiry_date: string
          id: string
          notes: string | null
          training_date: string
          training_type: string
          updated_at: string | null
        }
        Insert: {
          certificate_url?: string | null
          created_at?: string | null
          employee_id?: string | null
          expiry_date: string
          id?: string
          notes?: string | null
          training_date: string
          training_type: string
          updated_at?: string | null
        }
        Update: {
          certificate_url?: string | null
          created_at?: string | null
          employee_id?: string | null
          expiry_date?: string
          id?: string
          notes?: string | null
          training_date?: string
          training_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_training_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          sales_order_id: string
          tagged_users: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          sales_order_id: string
          tagged_users?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          sales_order_id?: string
          tagged_users?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_comments_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          created_at: string
          description: string | null
          discount_percent: number | null
          id: string
          notes: string | null
          product_id: string | null
          product_name: string
          quantity: number
          sales_order_id: string
          unit_price: number
          updated_at: string
          vat_rate: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name: string
          quantity?: number
          sales_order_id: string
          unit_price?: number
          updated_at?: string
          vat_rate?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          sales_order_id?: string
          unit_price?: number
          updated_at?: string
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          new_values: Json | null
          old_values: Json | null
          sales_order_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          sales_order_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          sales_order_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_logs_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          archived: boolean | null
          article: string | null
          attachments: Json | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          delivery_date: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          invoiced: boolean | null
          lead_id: string | null
          notes: string | null
          number: string
          offer_id: string | null
          order_date: string | null
          order_source: string | null
          order_type: string | null
          quote_id: string | null
          status: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          archived?: boolean | null
          article?: string | null
          attachments?: Json | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          delivery_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoiced?: boolean | null
          lead_id?: string | null
          notes?: string | null
          number: string
          offer_id?: string | null
          order_date?: string | null
          order_source?: string | null
          order_type?: string | null
          quote_id?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          archived?: boolean | null
          article?: string | null
          attachments?: Json | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          delivery_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoiced?: boolean | null
          lead_id?: string | null
          notes?: string | null
          number?: string
          offer_id?: string | null
          order_date?: string | null
          order_source?: string | null
          order_type?: string | null
          quote_id?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      scadenza_movimenti: {
        Row: {
          attachments: Json | null
          created_at: string | null
          data_movimento: string
          evento_finanziario_id: string | null
          id: string
          importo: number
          metodo_pagamento: string | null
          note: string | null
          prima_nota_id: string | null
          scadenza_id: string
        }
        Insert: {
          attachments?: Json | null
          created_at?: string | null
          data_movimento: string
          evento_finanziario_id?: string | null
          id?: string
          importo: number
          metodo_pagamento?: string | null
          note?: string | null
          prima_nota_id?: string | null
          scadenza_id: string
        }
        Update: {
          attachments?: Json | null
          created_at?: string | null
          data_movimento?: string
          evento_finanziario_id?: string | null
          id?: string
          importo?: number
          metodo_pagamento?: string | null
          note?: string | null
          prima_nota_id?: string | null
          scadenza_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scadenza_movimenti_evento_finanziario_id_fkey"
            columns: ["evento_finanziario_id"]
            isOneToOne: false
            referencedRelation: "accounting_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scadenza_movimenti_prima_nota_id_fkey"
            columns: ["prima_nota_id"]
            isOneToOne: false
            referencedRelation: "prima_nota"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scadenza_movimenti_scadenza_id_fkey"
            columns: ["scadenza_id"]
            isOneToOne: false
            referencedRelation: "scadenze"
            referencedColumns: ["id"]
          },
        ]
      }
      scadenze: {
        Row: {
          centro_id: string | null
          conto_economico: string | null
          created_at: string | null
          data_documento: string
          data_scadenza: string
          evento_id: string | null
          id: string
          importo_residuo: number
          importo_totale: number
          iva_mode: string | null
          note: string | null
          prima_nota_id: string | null
          soggetto_id: string | null
          soggetto_nome: string | null
          soggetto_tipo: string | null
          stato: string
          termini_pagamento: number | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          centro_id?: string | null
          conto_economico?: string | null
          created_at?: string | null
          data_documento: string
          data_scadenza: string
          evento_id?: string | null
          id?: string
          importo_residuo: number
          importo_totale: number
          iva_mode?: string | null
          note?: string | null
          prima_nota_id?: string | null
          soggetto_id?: string | null
          soggetto_nome?: string | null
          soggetto_tipo?: string | null
          stato?: string
          termini_pagamento?: number | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          centro_id?: string | null
          conto_economico?: string | null
          created_at?: string | null
          data_documento?: string
          data_scadenza?: string
          evento_id?: string | null
          id?: string
          importo_residuo?: number
          importo_totale?: number
          iva_mode?: string | null
          note?: string | null
          prima_nota_id?: string | null
          soggetto_id?: string | null
          soggetto_nome?: string | null
          soggetto_tipo?: string | null
          stato?: string
          termini_pagamento?: number | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scadenze_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "accounting_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scadenze_prima_nota_id_fkey"
            columns: ["prima_nota_id"]
            isOneToOne: false
            referencedRelation: "prima_nota"
            referencedColumns: ["id"]
          },
        ]
      }
      sender_emails: {
        Row: {
          created_at: string
          domain: string
          email: string
          id: string
          is_default: boolean | null
          is_verified: boolean | null
          name: string
          resend_domain_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain: string
          email: string
          id?: string
          is_default?: boolean | null
          is_verified?: boolean | null
          name: string
          resend_domain_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string
          email?: string
          id?: string
          is_default?: boolean | null
          is_verified?: boolean | null
          name?: string
          resend_domain_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      serials: {
        Row: {
          created_at: string
          id: string
          serial_number: string
          status: Database["public"]["Enums"]["serial_status"]
          test_notes: string | null
          test_result: string | null
          updated_at: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          serial_number: string
          status?: Database["public"]["Enums"]["serial_status"]
          test_notes?: string | null
          test_result?: string | null
          updated_at?: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          serial_number?: string
          status?: Database["public"]["Enums"]["serial_status"]
          test_notes?: string | null
          test_result?: string | null
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "serials_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_contracts: {
        Row: {
          annual_revenue: number | null
          contract_number: string
          created_at: string | null
          customer_id: string | null
          customer_name: string
          days_to_renewal: number | null
          end_date: string
          id: string
          machine_model: string | null
          monthly_revenue: number
          renewal_date: string | null
          start_date: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          annual_revenue?: number | null
          contract_number: string
          created_at?: string | null
          customer_id?: string | null
          customer_name: string
          days_to_renewal?: number | null
          end_date: string
          id?: string
          machine_model?: string | null
          monthly_revenue: number
          renewal_date?: string | null
          start_date: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          annual_revenue?: number | null
          contract_number?: string
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string
          days_to_renewal?: number | null
          end_date?: string
          id?: string
          machine_model?: string | null
          monthly_revenue?: number
          renewal_date?: string | null
          start_date?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      service_report_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      service_reports: {
        Row: {
          amount: number | null
          archived: boolean | null
          contact_id: string | null
          created_at: string
          customer_id: string | null
          customer_signature: string | null
          description: string | null
          end_time: string | null
          head_technician_hours: number | null
          id: string
          intervention_date: string
          intervention_type: string
          kilometers: number | null
          materials_used: string | null
          notes: string | null
          production_work_order_id: string | null
          report_number: string | null
          specialized_technician_hours: number | null
          start_time: string | null
          status: string
          technician_id: string | null
          technician_name: string | null
          technician_signature: string | null
          technicians_count: number | null
          total_amount: number | null
          updated_at: string
          vat_rate: number | null
          work_order_id: string | null
          work_performed: string | null
        }
        Insert: {
          amount?: number | null
          archived?: boolean | null
          contact_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_signature?: string | null
          description?: string | null
          end_time?: string | null
          head_technician_hours?: number | null
          id?: string
          intervention_date: string
          intervention_type: string
          kilometers?: number | null
          materials_used?: string | null
          notes?: string | null
          production_work_order_id?: string | null
          report_number?: string | null
          specialized_technician_hours?: number | null
          start_time?: string | null
          status?: string
          technician_id?: string | null
          technician_name?: string | null
          technician_signature?: string | null
          technicians_count?: number | null
          total_amount?: number | null
          updated_at?: string
          vat_rate?: number | null
          work_order_id?: string | null
          work_performed?: string | null
        }
        Update: {
          amount?: number | null
          archived?: boolean | null
          contact_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_signature?: string | null
          description?: string | null
          end_time?: string | null
          head_technician_hours?: number | null
          id?: string
          intervention_date?: string
          intervention_type?: string
          kilometers?: number | null
          materials_used?: string | null
          notes?: string | null
          production_work_order_id?: string | null
          report_number?: string | null
          specialized_technician_hours?: number | null
          start_time?: string | null
          status?: string
          technician_id?: string | null
          technician_name?: string | null
          technician_signature?: string | null
          technicians_count?: number | null
          total_amount?: number | null
          updated_at?: string
          vat_rate?: number | null
          work_order_id?: string | null
          work_performed?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_reports_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_reports_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_reports_production_work_order_id_fkey"
            columns: ["production_work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_reports_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_reports_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "service_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_work_order_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          service_work_order_id: string
          tagged_users: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          service_work_order_id: string
          tagged_users?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          service_work_order_id?: string
          tagged_users?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_work_order_comments_service_work_order_id_fkey"
            columns: ["service_work_order_id"]
            isOneToOne: false
            referencedRelation: "service_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_work_order_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          new_values: Json | null
          old_values: Json | null
          service_work_order_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          service_work_order_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          service_work_order_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_work_order_logs_service_work_order_id_fkey"
            columns: ["service_work_order_id"]
            isOneToOne: false
            referencedRelation: "service_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_work_orders: {
        Row: {
          actual_end_date: string | null
          actual_hours: number | null
          actual_start_date: string | null
          archived: boolean | null
          article: string | null
          assigned_to: string | null
          attachments: Json | null
          back_office_manager: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string | null
          equipment_needed: string | null
          estimated_hours: number | null
          id: string
          lead_id: string | null
          location: string | null
          notes: string | null
          number: string
          priority: string | null
          production_work_order_id: string | null
          sales_order_id: string | null
          scheduled_date: string | null
          service_responsible_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          actual_end_date?: string | null
          actual_hours?: number | null
          actual_start_date?: string | null
          archived?: boolean | null
          article?: string | null
          assigned_to?: string | null
          attachments?: Json | null
          back_office_manager?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          equipment_needed?: string | null
          estimated_hours?: number | null
          id?: string
          lead_id?: string | null
          location?: string | null
          notes?: string | null
          number: string
          priority?: string | null
          production_work_order_id?: string | null
          sales_order_id?: string | null
          scheduled_date?: string | null
          service_responsible_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          actual_end_date?: string | null
          actual_hours?: number | null
          actual_start_date?: string | null
          archived?: boolean | null
          article?: string | null
          assigned_to?: string | null
          attachments?: Json | null
          back_office_manager?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          equipment_needed?: string | null
          estimated_hours?: number | null
          id?: string
          lead_id?: string | null
          location?: string | null
          notes?: string | null
          number?: string
          priority?: string | null
          production_work_order_id?: string | null
          sales_order_id?: string | null
          scheduled_date?: string | null
          service_responsible_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_work_orders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_work_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_work_orders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_work_orders_production_work_order_id_fkey"
            columns: ["production_work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_work_orders_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_order_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          shipping_order_id: string
          tagged_users: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          shipping_order_id: string
          tagged_users?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          shipping_order_id?: string
          tagged_users?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_order_comments_shipping_order_id_fkey"
            columns: ["shipping_order_id"]
            isOneToOne: false
            referencedRelation: "shipping_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_order_items: {
        Row: {
          created_at: string
          id: string
          is_picked: boolean | null
          material_id: string | null
          notes: string | null
          picked_at: string | null
          picked_by: string | null
          product_name: string | null
          quantity: number
          shipping_order_id: string
          total_price: number | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_picked?: boolean | null
          material_id?: string | null
          notes?: string | null
          picked_at?: string | null
          picked_by?: string | null
          product_name?: string | null
          quantity: number
          shipping_order_id: string
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_picked?: boolean | null
          material_id?: string | null
          notes?: string | null
          picked_at?: string | null
          picked_by?: string | null
          product_name?: string | null
          quantity?: number
          shipping_order_id?: string
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_order_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_order_items_picked_by_fkey"
            columns: ["picked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_order_items_shipping_order_id_fkey"
            columns: ["shipping_order_id"]
            isOneToOne: false
            referencedRelation: "shipping_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_order_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          new_values: Json | null
          old_values: Json | null
          shipping_order_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          shipping_order_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          shipping_order_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_order_logs_shipping_order_id_fkey"
            columns: ["shipping_order_id"]
            isOneToOne: false
            referencedRelation: "shipping_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_orders: {
        Row: {
          archived: boolean | null
          article: string | null
          assigned_to: string | null
          attachments: Json | null
          back_office_manager: string | null
          back_office_responsible_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          delivered_date: string | null
          id: string
          notes: string | null
          number: string
          order_date: string
          payment_amount: number | null
          payment_on_delivery: boolean | null
          preparation_date: string | null
          ready_date: string | null
          sales_order_id: string | null
          shipped_date: string | null
          shipping_address: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_postal_code: string | null
          shipping_province: string | null
          shipping_responsible_id: string | null
          status: string
          status_changed_at: string | null
          status_changed_by: string | null
          updated_at: string
          work_order_id: string | null
        }
        Insert: {
          archived?: boolean | null
          article?: string | null
          assigned_to?: string | null
          attachments?: Json | null
          back_office_manager?: string | null
          back_office_responsible_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivered_date?: string | null
          id?: string
          notes?: string | null
          number: string
          order_date?: string
          payment_amount?: number | null
          payment_on_delivery?: boolean | null
          preparation_date?: string | null
          ready_date?: string | null
          sales_order_id?: string | null
          shipped_date?: string | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_postal_code?: string | null
          shipping_province?: string | null
          shipping_responsible_id?: string | null
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          updated_at?: string
          work_order_id?: string | null
        }
        Update: {
          archived?: boolean | null
          article?: string | null
          assigned_to?: string | null
          attachments?: Json | null
          back_office_manager?: string | null
          back_office_responsible_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivered_date?: string | null
          id?: string
          notes?: string | null
          number?: string
          order_date?: string
          payment_amount?: number | null
          payment_on_delivery?: boolean | null
          preparation_date?: string | null
          ready_date?: string | null
          sales_order_id?: string | null
          shipped_date?: string | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_postal_code?: string | null
          shipping_province?: string | null
          shipping_responsible_id?: string | null
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          updated_at?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_orders_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_orders_status_changed_by_fkey"
            columns: ["status_changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_orders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_prices: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          price: number
          size_cm: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          price?: number
          size_cm: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          price?: number
          size_cm?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      standard_costs: {
        Row: {
          cost_type: string
          created_at: string | null
          description: string
          id: string
          is_active: boolean | null
          machine_model: string | null
          unit: string
          unit_cost: number
          updated_at: string | null
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          cost_type: string
          created_at?: string | null
          description: string
          id?: string
          is_active?: boolean | null
          machine_model?: string | null
          unit: string
          unit_cost: number
          updated_at?: string | null
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          cost_type?: string
          created_at?: string | null
          description?: string
          id?: string
          is_active?: boolean | null
          machine_model?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string | null
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: []
      }
      sticky_notes: {
        Row: {
          color: string | null
          content: string
          created_at: string
          id: string
          position_x: number | null
          position_y: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          content: string
          created_at?: string
          id?: string
          position_x?: number | null
          position_y?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          content?: string
          created_at?: string
          id?: string
          position_x?: number | null
          position_y?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          ddt_id: string | null
          id: string
          item_description: string
          material_id: string | null
          movement_date: string
          movement_type: string
          notes: string | null
          origin_type: string
          quantity: number
          status: string
          supplier_id: string | null
          unit: string | null
          warehouse: string | null
          work_order_id: string | null
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          ddt_id?: string | null
          id?: string
          item_description: string
          material_id?: string | null
          movement_date?: string
          movement_type: string
          notes?: string | null
          origin_type?: string
          quantity: number
          status?: string
          supplier_id?: string | null
          unit?: string | null
          warehouse?: string | null
          work_order_id?: string | null
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          ddt_id?: string | null
          id?: string
          item_description?: string
          material_id?: string | null
          movement_date?: string
          movement_type?: string
          notes?: string | null
          origin_type?: string
          quantity?: number
          status?: string
          supplier_id?: string | null
          unit?: string | null
          warehouse?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_ddt_id_fkey"
            columns: ["ddt_id"]
            isOneToOne: false
            referencedRelation: "ddts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      strategic_focus: {
        Row: {
          business_unit_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          start_date: string
          status: string | null
          title: string
          updated_at: string
          vision_id: string | null
        }
        Insert: {
          business_unit_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          start_date: string
          status?: string | null
          title: string
          updated_at?: string
          vision_id?: string | null
        }
        Update: {
          business_unit_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          start_date?: string
          status?: string | null
          title?: string
          updated_at?: string
          vision_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strategic_focus_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_focus_vision_id_fkey"
            columns: ["vision_id"]
            isOneToOne: false
            referencedRelation: "strategic_visions"
            referencedColumns: ["id"]
          },
        ]
      }
      strategic_objectives: {
        Row: {
          business_unit_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          effort: string | null
          focus_id: string | null
          id: string
          impact: string | null
          owner_id: string | null
          quarter: string | null
          risk_level: string | null
          scope_excluded: string[] | null
          scope_included: string[] | null
          source: string
          start_date: string | null
          status: string
          target_date: string | null
          title: string
          updated_at: string
          wise_analysis: Json | null
          year: number | null
        }
        Insert: {
          business_unit_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          effort?: string | null
          focus_id?: string | null
          id?: string
          impact?: string | null
          owner_id?: string | null
          quarter?: string | null
          risk_level?: string | null
          scope_excluded?: string[] | null
          scope_included?: string[] | null
          source?: string
          start_date?: string | null
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
          wise_analysis?: Json | null
          year?: number | null
        }
        Update: {
          business_unit_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          effort?: string | null
          focus_id?: string | null
          id?: string
          impact?: string | null
          owner_id?: string | null
          quarter?: string | null
          risk_level?: string | null
          scope_excluded?: string[] | null
          scope_included?: string[] | null
          source?: string
          start_date?: string | null
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
          wise_analysis?: Json | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "strategic_objectives_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_objectives_focus_id_fkey"
            columns: ["focus_id"]
            isOneToOne: false
            referencedRelation: "strategic_focus"
            referencedColumns: ["id"]
          },
        ]
      }
      strategic_visions: {
        Row: {
          business_unit_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          observation_kpis: Json | null
          start_date: string
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          business_unit_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          observation_kpis?: Json | null
          start_date: string
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          business_unit_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          observation_kpis?: Json | null
          start_date?: string
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategic_visions_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      structural_accounts: {
        Row: {
          account_type: string
          category: string
          chart_account_id: string | null
          code: string
          created_at: string | null
          id: string
          is_structural: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          account_type: string
          category: string
          chart_account_id?: string | null
          code: string
          created_at?: string | null
          id?: string
          is_structural?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          account_type?: string
          category?: string
          chart_account_id?: string | null
          code?: string
          created_at?: string | null
          id?: string
          is_structural?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "structural_accounts_chart_account_id_fkey"
            columns: ["chart_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          custom_services: string[] | null
          id: string
          monthly_price: number
          paypal_subscription_id: string | null
          plan_name: string
          plan_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_services?: string[] | null
          id?: string
          monthly_price: number
          paypal_subscription_id?: string | null
          plan_name: string
          plan_type: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_services?: string[] | null
          id?: string
          monthly_price?: number
          paypal_subscription_id?: string | null
          plan_name?: string
          plan_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      supplier_invoice_advances: {
        Row: {
          advance_date: string
          amount: number
          created_at: string | null
          id: string
          notes: string | null
          payment_method: string | null
          supplier_invoice_id: string
          updated_at: string | null
        }
        Insert: {
          advance_date: string
          amount: number
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          supplier_invoice_id: string
          updated_at?: string | null
        }
        Update: {
          advance_date?: string
          amount?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          supplier_invoice_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoice_advances_supplier_invoice_id_fkey"
            columns: ["supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoice_checks: {
        Row: {
          amount: number
          bank: string | null
          check_date: string
          check_number: string
          created_at: string | null
          due_date: string
          id: string
          notes: string | null
          status: string | null
          supplier_invoice_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          bank?: string | null
          check_date: string
          check_number: string
          created_at?: string | null
          due_date: string
          id?: string
          notes?: string | null
          status?: string | null
          supplier_invoice_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          bank?: string | null
          check_date?: string
          check_number?: string
          created_at?: string | null
          due_date?: string
          id?: string
          notes?: string | null
          status?: string | null
          supplier_invoice_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoice_checks_supplier_invoice_id_fkey"
            columns: ["supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoices: {
        Row: {
          aging_days: number | null
          amount: number
          category: string
          cost_center_id: string | null
          created_at: string | null
          due_date: string
          id: string
          invoice_date: string
          invoice_number: string
          payment_date: string | null
          project_id: string | null
          status: string | null
          supplier_id: string | null
          supplier_name: string
          tax_amount: number | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          aging_days?: number | null
          amount: number
          category: string
          cost_center_id?: string | null
          created_at?: string | null
          due_date: string
          id?: string
          invoice_date: string
          invoice_number: string
          payment_date?: string | null
          project_id?: string | null
          status?: string | null
          supplier_id?: string | null
          supplier_name: string
          tax_amount?: number | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          aging_days?: number | null
          amount?: number
          category?: string
          cost_center_id?: string | null
          created_at?: string | null
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          payment_date?: string | null
          project_id?: string | null
          status?: string | null
          supplier_id?: string | null
          supplier_name?: string
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoices_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "management_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          access_code: string
          active: boolean | null
          address: string | null
          city: string | null
          code: string
          contact_email: string | null
          contact_name: string | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          last_access_at: string | null
          name: string
          payment_terms: number | null
          phone: string | null
          tax_id: string | null
          updated_at: string | null
        }
        Insert: {
          access_code: string
          active?: boolean | null
          address?: string | null
          city?: string | null
          code: string
          contact_email?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          last_access_at?: string | null
          name: string
          payment_terms?: number | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Update: {
          access_code?: string
          active?: boolean | null
          address?: string | null
          city?: string | null
          code?: string
          contact_email?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          last_access_at?: string | null
          name?: string
          payment_terms?: number | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          task_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          task_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          task_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          tagged_users: string[] | null
          task_id: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          tagged_users?: string[] | null
          task_id: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          tagged_users?: string[] | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_files: {
        Row: {
          content_type: string | null
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          task_id: string
          uploaded_by: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          task_id: string
          uploaded_by?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          task_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_files_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_hours: number | null
          archived: boolean
          assigned_to: string | null
          category: Database["public"]["Enums"]["task_category"]
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          is_template: boolean
          parent_task_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          start_date: string | null
          status: Database["public"]["Enums"]["task_status"]
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          actual_hours?: number | null
          archived?: boolean
          assigned_to?: string | null
          category: Database["public"]["Enums"]["task_category"]
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          is_template?: boolean
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          actual_hours?: number | null
          archived?: boolean
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["task_category"]
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          is_template?: boolean
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      technicians: {
        Row: {
          active: boolean | null
          address: string | null
          certification_level: string | null
          created_at: string
          department: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_code: string
          first_name: string
          hire_date: string | null
          hourly_rate: number | null
          id: string
          last_name: string
          mobile: string | null
          notes: string | null
          phone: string | null
          position: string | null
          specializations: string[] | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          certification_level?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_code: string
          first_name: string
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          last_name: string
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          position?: string | null
          specializations?: string[] | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          address?: string | null
          certification_level?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_code?: string
          first_name?: string
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          last_name?: string
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          position?: string | null
          specializations?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      ticket_comments: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          tagged_users: string[] | null
          ticket_id: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          tagged_users?: string[] | null
          ticket_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          tagged_users?: string[] | null
          ticket_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_watchers: {
        Row: {
          created_at: string
          id: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_watchers_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_watchers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_to: string | null
          attachments: string[] | null
          created_at: string
          created_by: string
          customer_id: string | null
          customer_name: string
          description: string | null
          id: string
          number: string
          priority: string
          scheduled_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          attachments?: string[] | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          customer_name: string
          description?: string | null
          id?: string
          number: string
          priority?: string
          scheduled_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          attachments?: string[] | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          customer_name?: string
          description?: string | null
          id?: string
          number?: string
          priority?: string
          scheduled_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_email_configs: {
        Row: {
          created_at: string
          email_address: string
          id: string
          imap_host: string
          imap_password: string
          imap_port: number
          imap_username: string
          is_active: boolean
          last_sync_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_address: string
          id?: string
          imap_host: string
          imap_password: string
          imap_port?: number
          imap_username: string
          is_active?: boolean
          last_sync_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_address?: string
          id?: string
          imap_host?: string
          imap_password?: string
          imap_port?: number
          imap_username?: string
          is_active?: boolean
          last_sync_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_page_restrictions: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_restricted: boolean | null
          page_path: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_restricted?: boolean | null
          page_path: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_restricted?: boolean | null
          page_path?: string
          user_id?: string
        }
        Relationships: []
      }
      user_page_visibility: {
        Row: {
          created_at: string
          id: string
          is_visible: boolean
          page_url: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_visible?: boolean
          page_url: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_visible?: boolean
          page_url?: string
          updated_at?: string
          user_id?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      wasender_accounts: {
        Row: {
          account_name: string | null
          api_key: string | null
          business_unit_id: string
          created_at: string
          credits_balance: number | null
          id: string
          is_active: boolean | null
          phone_number: string
          session_id: string | null
          status: string | null
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          account_name?: string | null
          api_key?: string | null
          business_unit_id: string
          created_at?: string
          credits_balance?: number | null
          id?: string
          is_active?: boolean | null
          phone_number: string
          session_id?: string | null
          status?: string | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          account_name?: string | null
          api_key?: string | null
          business_unit_id?: string
          created_at?: string
          credits_balance?: number | null
          id?: string
          is_active?: boolean | null
          phone_number?: string
          session_id?: string | null
          status?: string | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wasender_accounts_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      wasender_contacts: {
        Row: {
          account_id: string
          created_at: string
          customer_id: string | null
          id: string
          lead_id: string | null
          name: string | null
          phone: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          customer_id?: string | null
          id?: string
          lead_id?: string | null
          name?: string | null
          phone: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          lead_id?: string | null
          name?: string | null
          phone?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wasender_contacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wasender_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wasender_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wasender_contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      wasender_conversations: {
        Row: {
          account_id: string
          created_at: string
          customer_id: string | null
          customer_name: string | null
          customer_phone: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          lead_id: string | null
          status: string | null
          unread_count: number | null
        }
        Insert: {
          account_id: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          status?: string | null
          unread_count?: number | null
        }
        Update: {
          account_id?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          status?: string | null
          unread_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wasender_conversations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wasender_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wasender_conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wasender_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      wasender_credit_transactions: {
        Row: {
          account_id: string
          amount: number
          balance_after: number | null
          created_at: string
          id: string
          notes: string | null
          transaction_type: string
        }
        Insert: {
          account_id: string
          amount: number
          balance_after?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          transaction_type: string
        }
        Update: {
          account_id?: string
          amount?: number
          balance_after?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wasender_credit_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wasender_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      wasender_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          direction: string
          error_message: string | null
          id: string
          media_url: string | null
          message_type: string | null
          status: string | null
          wasender_id: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          error_message?: string | null
          id?: string
          media_url?: string | null
          message_type?: string | null
          status?: string | null
          wasender_id?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          error_message?: string | null
          id?: string
          media_url?: string | null
          message_type?: string | null
          status?: string | null
          wasender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wasender_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wasender_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          created_at: string
          data: Json
          error_message: string | null
          id: string
          processed: boolean
          processed_at: string | null
          received_at: string
          source: string
          updated_at: string
          webhook_type: string
        }
        Insert: {
          created_at?: string
          data: Json
          error_message?: string | null
          id?: string
          processed?: boolean
          processed_at?: string | null
          received_at?: string
          source?: string
          updated_at?: string
          webhook_type?: string
        }
        Update: {
          created_at?: string
          data?: Json
          error_message?: string | null
          id?: string
          processed?: boolean
          processed_at?: string | null
          received_at?: string
          source?: string
          updated_at?: string
          webhook_type?: string
        }
        Relationships: []
      }
      whatsapp_accounts: {
        Row: {
          access_token: string | null
          business_unit_id: string | null
          created_at: string
          credits_balance: number | null
          display_phone_number: string
          id: string
          is_active: boolean | null
          messaging_limit: string | null
          phone_number_id: string
          quality_rating: string | null
          status: string | null
          updated_at: string
          verified_name: string | null
          waba_id: string
        }
        Insert: {
          access_token?: string | null
          business_unit_id?: string | null
          created_at?: string
          credits_balance?: number | null
          display_phone_number: string
          id?: string
          is_active?: boolean | null
          messaging_limit?: string | null
          phone_number_id: string
          quality_rating?: string | null
          status?: string | null
          updated_at?: string
          verified_name?: string | null
          waba_id: string
        }
        Update: {
          access_token?: string | null
          business_unit_id?: string | null
          created_at?: string
          credits_balance?: number | null
          display_phone_number?: string
          id?: string
          is_active?: boolean | null
          messaging_limit?: string | null
          phone_number_id?: string
          quality_rating?: string | null
          status?: string | null
          updated_at?: string
          verified_name?: string | null
          waba_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_accounts_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          account_id: string | null
          conversation_type: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          customer_phone: string
          expires_at: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          lead_id: string | null
          status: string | null
          unread_count: number | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          conversation_type?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone: string
          expires_at?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          status?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          conversation_type?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string
          expires_at?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          status?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_credit_transactions: {
        Row: {
          account_id: string | null
          amount: number
          balance_after: number | null
          conversation_type: string | null
          created_at: string
          id: string
          message_id: string | null
          notes: string | null
          transaction_type: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          balance_after?: number | null
          conversation_type?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          notes?: string | null
          transaction_type: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          balance_after?: number | null
          conversation_type?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          notes?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_credit_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_credit_transactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          content: string | null
          conversation_id: string | null
          created_at: string
          delivered_at: string | null
          direction: string
          error_code: string | null
          error_message: string | null
          id: string
          interactive_data: Json | null
          media_mime_type: string | null
          media_url: string | null
          message_type: string
          read_at: string | null
          sent_by: string | null
          status: string | null
          template_name: string | null
          template_params: Json | null
          wamid: string | null
        }
        Insert: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          direction: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          interactive_data?: Json | null
          media_mime_type?: string | null
          media_url?: string | null
          message_type: string
          read_at?: string | null
          sent_by?: string | null
          status?: string | null
          template_name?: string | null
          template_params?: Json | null
          wamid?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          direction?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          interactive_data?: Json | null
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string
          read_at?: string | null
          sent_by?: string | null
          status?: string | null
          template_name?: string | null
          template_params?: Json | null
          wamid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          account_id: string | null
          category: string
          components: Json | null
          created_at: string
          example_values: Json | null
          id: string
          language: string
          name: string
          rejection_reason: string | null
          status: string | null
          template_id: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          category: string
          components?: Json | null
          created_at?: string
          example_values?: Json | null
          id?: string
          language?: string
          name: string
          rejection_reason?: string | null
          status?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          category?: string
          components?: Json | null
          created_at?: string
          example_values?: Json | null
          id?: string
          language?: string
          name?: string
          rejection_reason?: string | null
          status?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_accessories: {
        Row: {
          bom_id: string
          created_at: string | null
          id: string
          notes: string | null
          quantity: number
          updated_at: string | null
          work_order_id: string
        }
        Insert: {
          bom_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          updated_at?: string | null
          work_order_id: string
        }
        Update: {
          bom_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          updated_at?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_accessories_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_accessories_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_activities: {
        Row: {
          activity_type: string
          created_at: string
          description: string
          id: string
          metadata: Json | null
          user_id: string | null
          work_order_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
          work_order_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_activities_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_article_items: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string
          id: string
          is_completed: boolean
          position: number
          updated_at: string
          work_order_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description: string
          id?: string
          is_completed?: boolean
          position?: number
          updated_at?: string
          work_order_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string
          id?: string
          is_completed?: boolean
          position?: number
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_article_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          tagged_users: string[] | null
          updated_at: string
          user_id: string
          work_order_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          tagged_users?: string[] | null
          updated_at?: string
          user_id: string
          work_order_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          tagged_users?: string[] | null
          updated_at?: string
          user_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_comments_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          new_values: Json | null
          old_values: Json | null
          user_id: string
          work_order_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          user_id: string
          work_order_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          user_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_logs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          accessori_ids: string[] | null
          actual_end_date: string | null
          actual_start_date: string | null
          archived: boolean | null
          article: string | null
          assigned_to: string | null
          attachments: Json | null
          back_office_manager: string | null
          bom_id: string | null
          completed_date: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          description: string | null
          diameter: string | null
          id: string
          includes_installation: boolean | null
          lead_id: string | null
          location: string | null
          notes: string | null
          number: string
          offer_id: string | null
          payment_amount: number | null
          payment_on_delivery: boolean | null
          planned_end_date: string | null
          planned_start_date: string | null
          priority: string | null
          production_responsible_id: string | null
          sales_order_id: string | null
          scheduled_date: string | null
          smoke_inlet: string | null
          status: Database["public"]["Enums"]["wo_status"]
          title: string
          updated_at: string | null
        }
        Insert: {
          accessori_ids?: string[] | null
          actual_end_date?: string | null
          actual_start_date?: string | null
          archived?: boolean | null
          article?: string | null
          assigned_to?: string | null
          attachments?: Json | null
          back_office_manager?: string | null
          bom_id?: string | null
          completed_date?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          diameter?: string | null
          id?: string
          includes_installation?: boolean | null
          lead_id?: string | null
          location?: string | null
          notes?: string | null
          number: string
          offer_id?: string | null
          payment_amount?: number | null
          payment_on_delivery?: boolean | null
          planned_end_date?: string | null
          planned_start_date?: string | null
          priority?: string | null
          production_responsible_id?: string | null
          sales_order_id?: string | null
          scheduled_date?: string | null
          smoke_inlet?: string | null
          status?: Database["public"]["Enums"]["wo_status"]
          title: string
          updated_at?: string | null
        }
        Update: {
          accessori_ids?: string[] | null
          actual_end_date?: string | null
          actual_start_date?: string | null
          archived?: boolean | null
          article?: string | null
          assigned_to?: string | null
          attachments?: Json | null
          back_office_manager?: string | null
          bom_id?: string | null
          completed_date?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          diameter?: string | null
          id?: string
          includes_installation?: boolean | null
          lead_id?: string | null
          location?: string | null
          notes?: string | null
          number?: string
          offer_id?: string | null
          payment_amount?: number | null
          payment_on_delivery?: boolean | null
          planned_end_date?: string | null
          planned_start_date?: string | null
          priority?: string | null
          production_responsible_id?: string | null
          sales_order_id?: string | null
          scheduled_date?: string | null
          smoke_inlet?: string | null
          status?: Database["public"]["Enums"]["wo_status"]
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_aging_days: {
        Args: { due_date: string; payment_date: string; status: string }
        Returns: number
      }
      calculate_days_to_renewal: {
        Args: { renewal_date: string }
        Returns: number
      }
      create_notification: {
        Args: {
          p_entity_id?: string
          p_entity_type?: string
          p_message: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      find_lead_by_normalized_phone: {
        Args: { search_pattern: string }
        Returns: {
          id: string
          phone: string
        }[]
      }
      generate_configurator_code: { Args: never; Returns: string }
      generate_cost_draft_number: { Args: never; Returns: string }
      generate_customer_code: { Args: never; Returns: string }
      generate_ddt_code: { Args: never; Returns: string }
      generate_material_code: { Args: never; Returns: string }
      generate_offer_code: { Args: never; Returns: string }
      generate_product_code: { Args: never; Returns: string }
      generate_production_installation_work_order_number: {
        Args: never
        Returns: string
      }
      generate_production_work_order_number:
        | { Args: never; Returns: string }
        | { Args: { sales_order_number?: string }; Returns: string }
      generate_purchase_order_number: { Args: never; Returns: string }
      generate_quote_code: { Args: never; Returns: string }
      generate_recurring_tasks: { Args: never; Returns: undefined }
      generate_sales_order_number: { Args: never; Returns: string }
      generate_service_report_number: { Args: never; Returns: string }
      generate_service_work_order_number:
        | { Args: never; Returns: string }
        | { Args: { sales_order_number?: string }; Returns: string }
      generate_shipping_order_number: {
        Args: { sales_order_number?: string }
        Returns: string
      }
      generate_ticket_number: { Args: never; Returns: string }
      get_next_bom_version:
        | {
            Args: { p_level?: number; p_name: string; p_variant?: string }
            Returns: string
          }
        | {
            Args: {
              p_level?: number
              p_name: string
              p_parent_id?: string
              p_variant?: string
            }
            Returns: string
          }
      get_quote_by_code: {
        Args: { input_code: string }
        Returns: {
          code: string
          created_at: string
          expires_at: string
          quote_id: string
        }[]
      }
      get_user_role_simple: { Args: { user_uuid?: string }; Returns: string }
      get_user_site_origin: { Args: { user_uuid: string }; Returns: string }
      has_minimum_role: {
        Args: {
          _min_role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_user: { Args: never; Returns: boolean }
      is_same_site_user: { Args: { target_user_id: string }; Returns: boolean }
      is_user_admin: { Args: { user_uuid?: string }; Returns: boolean }
      normalize_phone: { Args: { phone_number: string }; Returns: string }
      populate_missing_shipping_order_items: { Args: never; Returns: number }
      should_hide_amounts: { Args: never; Returns: boolean }
      user_created_quote: { Args: { quote_id: string }; Returns: boolean }
      validate_quote_code: { Args: { input_code: string }; Returns: boolean }
    }
    Enums: {
      accounting_event_type: "COSTO" | "RICAVO" | "FINANZIARIO" | "ASSESTAMENTO"
      app_role: "admin" | "user" | "moderator"
      competence_type: "IMMEDIATA" | "RATEIZZATA" | "DIFFERITA"
      financial_status_type:
        | "DA_PAGARE"
        | "DA_INCASSARE"
        | "PAGATO"
        | "INCASSATO"
        | "ANTICIPO_DIPENDENTE"
        | "RIMBORSO_DIPENDENTE"
      gl_doc_type:
        | "SaleInvoice"
        | "PurchaseInvoice"
        | "Manual"
        | "Timesheet"
        | "MaterialIssue"
        | "Logistics"
        | "Adjustment"
        | "Opening"
      gl_origin_module:
        | "Sales"
        | "Purchases"
        | "Warehouse"
        | "Timesheet"
        | "Finance"
        | "Manual"
      gl_status: "draft" | "incomplete" | "posted"
      iva_mode:
        | "DOMESTICA_IMPONIBILE"
        | "CESSIONE_UE_NON_IMPONIBILE"
        | "CESSIONE_EXTRA_UE_NON_IMPONIBILE"
        | "VENDITA_RC_EDILE"
        | "ACQUISTO_RC_EDILE"
      payment_method_type: "BANCA" | "CASSA" | "CARTA"
      recurrence_type: "none" | "daily" | "weekly" | "monthly" | "yearly"
      rma_status: "open" | "analysis" | "repaired" | "closed"
      serial_status: "in_test" | "approved" | "rejected"
      task_category:
        | "amministrazione"
        | "back_office"
        | "ricerca_sviluppo"
        | "tecnico"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "review" | "completed" | "cancelled"
      wo_status:
        | "planned"
        | "in_progress"
        | "testing"
        | "closed"
        | "to_do"
        | "completed"
        | "completato"
        | "in_lavorazione"
        | "in_corso"
        | "pronti"
        | "spediti_consegnati"
        | "test"
        | "da_fare"
        | "in_test"
        | "pronto"
        | "standby"
        | "bloccato"
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
      accounting_event_type: ["COSTO", "RICAVO", "FINANZIARIO", "ASSESTAMENTO"],
      app_role: ["admin", "user", "moderator"],
      competence_type: ["IMMEDIATA", "RATEIZZATA", "DIFFERITA"],
      financial_status_type: [
        "DA_PAGARE",
        "DA_INCASSARE",
        "PAGATO",
        "INCASSATO",
        "ANTICIPO_DIPENDENTE",
        "RIMBORSO_DIPENDENTE",
      ],
      gl_doc_type: [
        "SaleInvoice",
        "PurchaseInvoice",
        "Manual",
        "Timesheet",
        "MaterialIssue",
        "Logistics",
        "Adjustment",
        "Opening",
      ],
      gl_origin_module: [
        "Sales",
        "Purchases",
        "Warehouse",
        "Timesheet",
        "Finance",
        "Manual",
      ],
      gl_status: ["draft", "incomplete", "posted"],
      iva_mode: [
        "DOMESTICA_IMPONIBILE",
        "CESSIONE_UE_NON_IMPONIBILE",
        "CESSIONE_EXTRA_UE_NON_IMPONIBILE",
        "VENDITA_RC_EDILE",
        "ACQUISTO_RC_EDILE",
      ],
      payment_method_type: ["BANCA", "CASSA", "CARTA"],
      recurrence_type: ["none", "daily", "weekly", "monthly", "yearly"],
      rma_status: ["open", "analysis", "repaired", "closed"],
      serial_status: ["in_test", "approved", "rejected"],
      task_category: [
        "amministrazione",
        "back_office",
        "ricerca_sviluppo",
        "tecnico",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "review", "completed", "cancelled"],
      wo_status: [
        "planned",
        "in_progress",
        "testing",
        "closed",
        "to_do",
        "completed",
        "completato",
        "in_lavorazione",
        "in_corso",
        "pronti",
        "spediti_consegnati",
        "test",
        "da_fare",
        "in_test",
        "pronto",
        "standby",
        "bloccato",
      ],
    },
  },
} as const
