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
          id: string
          name: string
          notes: string | null
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
          version: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          version?: string
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
      customers: {
        Row: {
          active: boolean | null
          address: string | null
          city: string | null
          code: string
          country: string | null
          created_at: string | null
          credit_limit: number | null
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
          credit_limit?: number | null
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
          credit_limit?: number | null
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
      leads: {
        Row: {
          assigned_to: string | null
          company_name: string
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          notes: string | null
          phone: string | null
          source: string | null
          status: string | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          assigned_to?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          assigned_to?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: []
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
          partner_type: string | null
          phone: string | null
          priority: string | null
          region: string | null
          updated_at: string
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
          partner_type?: string | null
          phone?: string | null
          priority?: string | null
          region?: string | null
          updated_at?: string
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
          partner_type?: string | null
          phone?: string | null
          priority?: string | null
          region?: string | null
          updated_at?: string
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
          updated_at: string
          user_type: string | null
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          updated_at?: string
          user_type?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
          user_type?: string | null
        }
        Relationships: []
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
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          delivery_date: string | null
          id: string
          notes: string | null
          number: string
          order_date: string | null
          quote_id: string | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          delivery_date?: string | null
          id?: string
          notes?: string | null
          number: string
          order_date?: string | null
          quote_id?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          delivery_date?: string | null
          id?: string
          notes?: string | null
          number?: string
          order_date?: string | null
          quote_id?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
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
            foreignKeyName: "sales_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
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
      service_reports: {
        Row: {
          contact_id: string | null
          created_at: string
          customer_signature: string
          description: string
          end_time: string | null
          id: string
          intervention_date: string
          intervention_type: string
          materials_used: string | null
          notes: string | null
          start_time: string | null
          status: string
          technician_name: string
          technician_signature: string
          updated_at: string
          work_performed: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          customer_signature: string
          description: string
          end_time?: string | null
          id?: string
          intervention_date: string
          intervention_type: string
          materials_used?: string | null
          notes?: string | null
          start_time?: string | null
          status?: string
          technician_name: string
          technician_signature: string
          updated_at?: string
          work_performed?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          customer_signature?: string
          description?: string
          end_time?: string | null
          id?: string
          intervention_date?: string
          intervention_type?: string
          materials_used?: string | null
          notes?: string | null
          start_time?: string | null
          status?: string
          technician_name?: string
          technician_signature?: string
          updated_at?: string
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
          location: string | null
          notes: string | null
          number: string
          priority: string | null
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
          location?: string | null
          notes?: string | null
          number: string
          priority?: string | null
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
          location?: string | null
          notes?: string | null
          number?: string
          priority?: string | null
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
      work_orders: {
        Row: {
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
          location: string | null
          notes: string | null
          number: string
          planned_end_date: string | null
          planned_start_date: string | null
          priority: string | null
          scheduled_date: string | null
          status: Database["public"]["Enums"]["wo_status"]
          title: string
          updated_at: string | null
        }
        Insert: {
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
          location?: string | null
          notes?: string | null
          number: string
          planned_end_date?: string | null
          planned_start_date?: string | null
          priority?: string | null
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["wo_status"]
          title: string
          updated_at?: string | null
        }
        Update: {
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
          location?: string | null
          notes?: string | null
          number?: string
          planned_end_date?: string | null
          planned_start_date?: string | null
          priority?: string | null
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["wo_status"]
          title?: string
          updated_at?: string | null
        }
        Relationships: [
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_production_work_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_quote_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_sales_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_service_work_order_number: {
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
      validate_quote_code: {
        Args: { input_code: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "moderator"
      rma_status: "open" | "analysis" | "repaired" | "closed"
      serial_status: "in_test" | "approved" | "rejected"
      wo_status: "planned" | "in_progress" | "testing" | "closed"
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
      rma_status: ["open", "analysis", "repaired", "closed"],
      serial_status: ["in_test", "approved", "rejected"],
      wo_status: ["planned", "in_progress", "testing", "closed"],
    },
  },
} as const
