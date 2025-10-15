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
      chart_of_accounts: {
        Row: {
          account_type: string
          category: string | null
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          level: number | null
          name: string
          parent_code: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          account_type: string
          category?: string | null
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          level?: number | null
          name: string
          parent_code?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          account_type?: string
          category?: string | null
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          level?: number | null
          name?: string
          parent_code?: string | null
          sort_order?: number | null
          updated_at?: string | null
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
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
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
          name?: string
          updated_at?: string | null
        }
        Relationships: []
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
          name: string
          payment_terms: number | null
          phone: string | null
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
          name: string
          payment_terms?: number | null
          phone?: string | null
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
          name?: string
          payment_terms?: number | null
          phone?: string | null
          shipping_address?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
          company_name: string
          contact_name: string | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          next_activity_assigned_to: string | null
          next_activity_date: string | null
          next_activity_notes: string | null
          next_activity_type: string | null
          notes: string | null
          phone: string | null
          pipeline: string | null
          source: string | null
          status: string | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          archived?: boolean | null
          assigned_to?: string | null
          company_name: string
          contact_name?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          next_activity_assigned_to?: string | null
          next_activity_date?: string | null
          next_activity_notes?: string | null
          next_activity_type?: string | null
          notes?: string | null
          phone?: string | null
          pipeline?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          archived?: boolean | null
          assigned_to?: string | null
          company_name?: string
          contact_name?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          next_activity_assigned_to?: string | null
          next_activity_date?: string | null
          next_activity_notes?: string | null
          next_activity_type?: string | null
          notes?: string | null
          phone?: string | null
          pipeline?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: []
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
          machine_model: string | null
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
          machine_model?: string | null
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
          machine_model?: string | null
          profit_center_id?: string | null
          project_type?: string
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
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
      offers: {
        Row: {
          amount: number
          attachments: string[] | null
          created_at: string
          customer_id: string | null
          customer_name: string
          description: string | null
          id: string
          lead_id: string | null
          number: string
          status: string
          title: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          amount?: number
          attachments?: string[] | null
          created_at?: string
          customer_id?: string | null
          customer_name: string
          description?: string | null
          id?: string
          lead_id?: string | null
          number: string
          status?: string
          title: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          amount?: number
          attachments?: string[] | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          description?: string | null
          id?: string
          lead_id?: string | null
          number?: string
          status?: string
          title?: string
          updated_at?: string
          valid_until?: string | null
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
      profiles: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
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
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          delivery_timeframe_days: number | null
          expected_delivery_date: string | null
          id: string
          notes: string | null
          number: string
          order_date: string
          priority: string | null
          status: string
          subtotal: number | null
          supplier_id: string | null
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivery_timeframe_days?: number | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          number: string
          order_date?: string
          priority?: string | null
          status?: string
          subtotal?: number | null
          supplier_id?: string | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivery_timeframe_days?: number | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          number?: string
          order_date?: string
          priority?: string | null
          status?: string
          subtotal?: number | null
          supplier_id?: string | null
          tax_amount?: number | null
          total_amount?: number | null
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
      sales_orders: {
        Row: {
          archived: boolean | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          delivery_date: string | null
          id: string
          lead_id: string | null
          notes: string | null
          number: string
          order_date: string | null
          order_source: string | null
          order_type: string | null
          quote_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          archived?: boolean | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          delivery_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          number: string
          order_date?: string | null
          order_source?: string | null
          order_type?: string | null
          quote_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          archived?: boolean | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          delivery_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          number?: string
          order_date?: string | null
          order_source?: string | null
          order_type?: string | null
          quote_id?: string | null
          status?: string | null
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
            foreignKeyName: "sales_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
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
      service_reports: {
        Row: {
          amount: number | null
          contact_id: string | null
          created_at: string
          customer_signature: string
          description: string | null
          end_time: string | null
          id: string
          intervention_date: string
          intervention_type: string
          materials_used: string | null
          notes: string | null
          production_work_order_id: string | null
          start_time: string | null
          status: string
          technician_id: string | null
          technician_name: string | null
          technician_signature: string
          total_amount: number | null
          updated_at: string
          vat_rate: number | null
          work_order_id: string | null
          work_performed: string | null
        }
        Insert: {
          amount?: number | null
          contact_id?: string | null
          created_at?: string
          customer_signature: string
          description?: string | null
          end_time?: string | null
          id?: string
          intervention_date: string
          intervention_type: string
          materials_used?: string | null
          notes?: string | null
          production_work_order_id?: string | null
          start_time?: string | null
          status?: string
          technician_id?: string | null
          technician_name?: string | null
          technician_signature: string
          total_amount?: number | null
          updated_at?: string
          vat_rate?: number | null
          work_order_id?: string | null
          work_performed?: string | null
        }
        Update: {
          amount?: number | null
          contact_id?: string | null
          created_at?: string
          customer_signature?: string
          description?: string | null
          end_time?: string | null
          id?: string
          intervention_date?: string
          intervention_type?: string
          materials_used?: string | null
          notes?: string | null
          production_work_order_id?: string | null
          start_time?: string | null
          status?: string
          technician_id?: string | null
          technician_name?: string | null
          technician_signature?: string
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
      service_work_orders: {
        Row: {
          actual_end_date: string | null
          actual_hours: number | null
          actual_start_date: string | null
          assigned_to: string | null
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
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          actual_end_date?: string | null
          actual_hours?: number | null
          actual_start_date?: string | null
          assigned_to?: string | null
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
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          actual_end_date?: string | null
          actual_hours?: number | null
          actual_start_date?: string | null
          assigned_to?: string | null
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
      shipping_order_items: {
        Row: {
          created_at: string
          id: string
          material_id: string | null
          notes: string | null
          quantity: number
          shipping_order_id: string
          total_price: number | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_id?: string | null
          notes?: string | null
          quantity: number
          shipping_order_id: string
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string | null
          notes?: string | null
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
            foreignKeyName: "shipping_order_items_shipping_order_id_fkey"
            columns: ["shipping_order_id"]
            isOneToOne: false
            referencedRelation: "shipping_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_orders: {
        Row: {
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
          status: string
          updated_at: string
          work_order_id: string | null
        }
        Insert: {
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
          status?: string
          updated_at?: string
          work_order_id?: string | null
        }
        Update: {
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
          status?: string
          updated_at?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
            foreignKeyName: "shipping_orders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
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
          active: boolean | null
          address: string | null
          city: string | null
          code: string
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          payment_terms: number | null
          phone: string | null
          tax_id: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          city?: string | null
          code: string
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          payment_terms?: number | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          city?: string | null
          code?: string
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
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
          task_id: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
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
      work_orders: {
        Row: {
          accessori_ids: string[] | null
          actual_end_date: string | null
          actual_start_date: string | null
          assigned_to: string | null
          bom_id: string | null
          completed_date: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          description: string | null
          id: string
          includes_installation: boolean | null
          lead_id: string | null
          location: string | null
          notes: string | null
          number: string
          planned_end_date: string | null
          planned_start_date: string | null
          priority: string | null
          sales_order_id: string | null
          scheduled_date: string | null
          status: Database["public"]["Enums"]["wo_status"]
          title: string
          updated_at: string | null
        }
        Insert: {
          accessori_ids?: string[] | null
          actual_end_date?: string | null
          actual_start_date?: string | null
          assigned_to?: string | null
          bom_id?: string | null
          completed_date?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          includes_installation?: boolean | null
          lead_id?: string | null
          location?: string | null
          notes?: string | null
          number: string
          planned_end_date?: string | null
          planned_start_date?: string | null
          priority?: string | null
          sales_order_id?: string | null
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["wo_status"]
          title: string
          updated_at?: string | null
        }
        Update: {
          accessori_ids?: string[] | null
          actual_end_date?: string | null
          actual_start_date?: string | null
          assigned_to?: string | null
          bom_id?: string | null
          completed_date?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          includes_installation?: boolean | null
          lead_id?: string | null
          location?: string | null
          notes?: string | null
          number?: string
          planned_end_date?: string | null
          planned_start_date?: string | null
          priority?: string | null
          sales_order_id?: string | null
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["wo_status"]
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_assigned_to_technician_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "technicians"
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
      generate_cost_draft_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_customer_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_material_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_production_installation_work_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_production_work_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_purchase_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_quote_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_recurring_tasks: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      generate_sales_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_service_work_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_shipping_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_ticket_number: {
        Args: Record<PropertyKey, never>
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
      get_user_role_simple: {
        Args: { user_uuid?: string }
        Returns: string
      }
      get_user_site_origin: {
        Args: { user_uuid: string }
        Returns: string
      }
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
      is_admin_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_same_site_user: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      is_user_admin: {
        Args: { user_uuid?: string }
        Returns: boolean
      }
      user_created_quote: {
        Args: { quote_id: string }
        Returns: boolean
      }
      validate_quote_code: {
        Args: { input_code: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "moderator"
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
      app_role: ["admin", "user", "moderator"],
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
      ],
    },
  },
} as const
