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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_import_batches: {
        Row: {
          created_at: string
          duplicate_count: number
          filename: string
          id: string
          imported_by: string | null
          imported_count: number
          row_count: number
        }
        Insert: {
          created_at?: string
          duplicate_count?: number
          filename: string
          id?: string
          imported_by?: string | null
          imported_count?: number
          row_count: number
        }
        Update: {
          created_at?: string
          duplicate_count?: number
          filename?: string
          id?: string
          imported_by?: string | null
          imported_count?: number
          row_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "bank_import_batches_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          created_at: string
          dedupe_hash: string
          description: string
          id: string
          import_batch_id: string
          matched_at: string | null
          matched_by: string | null
          matched_payment_id: string | null
          notes: string
          reference: string | null
          status: Database["public"]["Enums"]["bank_transaction_status"]
          transaction_date: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          created_at?: string
          dedupe_hash: string
          description: string
          id?: string
          import_batch_id: string
          matched_at?: string | null
          matched_by?: string | null
          matched_payment_id?: string | null
          notes?: string
          reference?: string | null
          status?: Database["public"]["Enums"]["bank_transaction_status"]
          transaction_date: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          created_at?: string
          dedupe_hash?: string
          description?: string
          id?: string
          import_batch_id?: string
          matched_at?: string | null
          matched_by?: string | null
          matched_payment_id?: string | null
          notes?: string
          reference?: string | null
          status?: Database["public"]["Enums"]["bank_transaction_status"]
          transaction_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "bank_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_matched_by_fkey"
            columns: ["matched_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_matched_payment_id_fkey"
            columns: ["matched_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      client_magic_links: {
        Row: {
          consumed_at: string | null
          created_at: string
          customer_ids: string[]
          email: string
          expires_at: string
          id: string
          token_hash: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          customer_ids: string[]
          email: string
          expires_at: string
          id?: string
          token_hash: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          customer_ids?: string[]
          email?: string
          expires_at?: string
          id?: string
          token_hash?: string
        }
        Relationships: []
      }
      client_sessions: {
        Row: {
          created_at: string
          customer_ids: string[]
          email: string
          expires_at: string
          id: string
          last_seen_at: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          customer_ids: string[]
          email: string
          expires_at: string
          id?: string
          last_seen_at?: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          customer_ids?: string[]
          email?: string
          expires_at?: string
          id?: string
          last_seen_at?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          accounts_notification_email: string | null
          address_physical: string
          address_postal: string
          bank_account_name: string
          bank_account_number: string
          bank_account_type: string
          bank_branch_code: string
          bank_name: string
          brand_color: string | null
          company_name: string
          credit_note_next_number: number
          credit_note_prefix: string
          customer_next_number: number
          default_currency: string
          default_invoice_footer: string
          default_invoice_notes: string
          default_payment_terms_days: number
          default_prices_include_vat: boolean
          default_quote_terms: string
          default_vat_rate: number
          email: string
          id: boolean
          invoice_next_number: number
          invoice_prefix: string
          logo_url: string | null
          payment_reminders_enabled: boolean
          pdf_template: string
          phone: string
          quote_next_number: number
          quote_prefix: string
          registration_number: string
          reminder_review_email: string | null
          show_company_name: boolean
          trading_name: string
          updated_at: string
          vat_number: string
          vat_registered: boolean
          website: string
        }
        Insert: {
          accounts_notification_email?: string | null
          address_physical?: string
          address_postal?: string
          bank_account_name?: string
          bank_account_number?: string
          bank_account_type?: string
          bank_branch_code?: string
          bank_name?: string
          brand_color?: string | null
          company_name?: string
          credit_note_next_number?: number
          credit_note_prefix?: string
          customer_next_number?: number
          default_currency?: string
          default_invoice_footer?: string
          default_invoice_notes?: string
          default_payment_terms_days?: number
          default_prices_include_vat?: boolean
          default_quote_terms?: string
          default_vat_rate?: number
          email?: string
          id?: boolean
          invoice_next_number?: number
          invoice_prefix?: string
          logo_url?: string | null
          payment_reminders_enabled?: boolean
          pdf_template?: string
          phone?: string
          quote_next_number?: number
          quote_prefix?: string
          registration_number?: string
          reminder_review_email?: string | null
          show_company_name?: boolean
          trading_name?: string
          updated_at?: string
          vat_number?: string
          vat_registered?: boolean
          website?: string
        }
        Update: {
          accounts_notification_email?: string | null
          address_physical?: string
          address_postal?: string
          bank_account_name?: string
          bank_account_number?: string
          bank_account_type?: string
          bank_branch_code?: string
          bank_name?: string
          brand_color?: string | null
          company_name?: string
          credit_note_next_number?: number
          credit_note_prefix?: string
          customer_next_number?: number
          default_currency?: string
          default_invoice_footer?: string
          default_invoice_notes?: string
          default_payment_terms_days?: number
          default_prices_include_vat?: boolean
          default_quote_terms?: string
          default_vat_rate?: number
          email?: string
          id?: boolean
          invoice_next_number?: number
          invoice_prefix?: string
          logo_url?: string | null
          payment_reminders_enabled?: boolean
          pdf_template?: string
          phone?: string
          quote_next_number?: number
          quote_prefix?: string
          registration_number?: string
          reminder_review_email?: string | null
          show_company_name?: boolean
          trading_name?: string
          updated_at?: string
          vat_number?: string
          vat_registered?: boolean
          website?: string
        }
        Relationships: []
      }
      credit_note_items: {
        Row: {
          created_at: string
          credit_note_id: string
          description: string
          discount_percent: number
          id: string
          line_subtotal: number
          line_total: number
          line_vat: number
          product_id: string | null
          quantity: number
          sort_order: number
          unit_price: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          credit_note_id: string
          description: string
          discount_percent?: number
          id?: string
          line_subtotal: number
          line_total: number
          line_vat: number
          product_id?: string | null
          quantity: number
          sort_order?: number
          unit_price: number
          vat_rate: number
        }
        Update: {
          created_at?: string
          credit_note_id?: string
          description?: string
          discount_percent?: number
          id?: string
          line_subtotal?: number
          line_total?: number
          line_vat?: number
          product_id?: string | null
          quantity?: number
          sort_order?: number
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_items_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          created_at: string
          created_by: string | null
          credit_note_date: string
          credit_note_number: string
          customer_id: string
          discount_total: number
          id: string
          invoice_id: string | null
          issued_at: string | null
          notes: string
          prices_include_vat: boolean
          reason: string
          status: Database["public"]["Enums"]["credit_note_status"]
          subtotal: number
          terms: string
          total: number
          updated_at: string
          vat_total: number
          voided_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credit_note_date?: string
          credit_note_number: string
          customer_id: string
          discount_total?: number
          id?: string
          invoice_id?: string | null
          issued_at?: string | null
          notes?: string
          prices_include_vat?: boolean
          reason?: string
          status?: Database["public"]["Enums"]["credit_note_status"]
          subtotal?: number
          terms?: string
          total?: number
          updated_at?: string
          vat_total?: number
          voided_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credit_note_date?: string
          credit_note_number?: string
          customer_id?: string
          discount_total?: number
          id?: string
          invoice_id?: string | null
          issued_at?: string | null
          notes?: string
          prices_include_vat?: boolean
          reason?: string
          status?: Database["public"]["Enums"]["credit_note_status"]
          subtotal?: number
          terms?: string
          total?: number
          updated_at?: string
          vat_total?: number
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credits: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          credit_note_id: string | null
          customer_id: string
          id: string
          invoice_id: string | null
          notes: string
          payment_id: string | null
          source: Database["public"]["Enums"]["credit_source"]
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          credit_note_id?: string | null
          customer_id: string
          id?: string
          invoice_id?: string | null
          notes?: string
          payment_id?: string | null
          source: Database["public"]["Enums"]["credit_source"]
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          credit_note_id?: string | null
          customer_id?: string
          id?: string
          invoice_id?: string | null
          notes?: string
          payment_id?: string | null
          source?: Database["public"]["Enums"]["credit_source"]
        }
        Relationships: [
          {
            foreignKeyName: "customer_credits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credits_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credits_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credits_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_physical: string
          address_postal: string
          company_name: string
          contact_person: string
          created_at: string
          created_by: string | null
          customer_reference: string
          customer_type: Database["public"]["Enums"]["customer_type"]
          email: string
          id: string
          is_active: boolean
          mobile: string
          notes: string
          opening_balance: number
          payment_terms_days: number | null
          phone: string
          registration_number: string
          updated_at: string
          vat_number: string
        }
        Insert: {
          address_physical?: string
          address_postal?: string
          company_name: string
          contact_person?: string
          created_at?: string
          created_by?: string | null
          customer_reference?: string
          customer_type?: Database["public"]["Enums"]["customer_type"]
          email?: string
          id?: string
          is_active?: boolean
          mobile?: string
          notes?: string
          opening_balance?: number
          payment_terms_days?: number | null
          phone?: string
          registration_number?: string
          updated_at?: string
          vat_number?: string
        }
        Update: {
          address_physical?: string
          address_postal?: string
          company_name?: string
          contact_person?: string
          created_at?: string
          created_by?: string | null
          customer_reference?: string
          customer_type?: Database["public"]["Enums"]["customer_type"]
          email?: string
          id?: string
          is_active?: boolean
          mobile?: string
          notes?: string
          opening_balance?: number
          payment_terms_days?: number | null
          phone?: string
          registration_number?: string
          updated_at?: string
          vat_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          created_at: string
          email_type: string
          entity: string
          entity_id: string | null
          error: string | null
          id: string
          recipient: string
          status: Database["public"]["Enums"]["email_status"]
          subject: string
        }
        Insert: {
          created_at?: string
          email_type: string
          entity: string
          entity_id?: string | null
          error?: string | null
          id?: string
          recipient: string
          status: Database["public"]["Enums"]["email_status"]
          subject: string
        }
        Update: {
          created_at?: string
          email_type?: string
          entity?: string
          entity_id?: string | null
          error?: string | null
          id?: string
          recipient?: string
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          description: string
          expense_date: string
          id: string
          notes: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          id?: string
          notes?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          id?: string
          notes?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          discount_percent: number
          id: string
          invoice_id: string
          line_subtotal: number
          line_total: number
          line_vat: number
          product_id: string | null
          quantity: number
          sort_order: number
          unit_price: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          description: string
          discount_percent?: number
          id?: string
          invoice_id: string
          line_subtotal: number
          line_total: number
          line_vat: number
          product_id?: string | null
          quantity: number
          sort_order?: number
          unit_price: number
          vat_rate: number
        }
        Update: {
          created_at?: string
          description?: string
          discount_percent?: number
          id?: string
          invoice_id?: string
          line_subtotal?: number
          line_total?: number
          line_vat?: number
          product_id?: string | null
          quantity?: number
          sort_order?: number
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_reminders_sent: {
        Row: {
          id: string
          invoice_id: string
          offset_days: number
          sent_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          offset_days: number
          sent_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          offset_days?: number
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_reminders_sent_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          balance_due: number | null
          created_at: string
          created_by: string | null
          customer_id: string
          discount_total: number
          due_date: string
          id: string
          invoice_date: string
          invoice_number: string
          notes: string
          prices_include_vat: boolean
          quote_id: string | null
          recurring_invoice_id: string | null
          reference: string
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          terms: string
          total: number
          updated_at: string
          vat_total: number
          voided_at: string | null
        }
        Insert: {
          amount_paid?: number
          balance_due?: number | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          discount_total?: number
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string
          prices_include_vat?: boolean
          quote_id?: string | null
          recurring_invoice_id?: string | null
          reference?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          terms?: string
          total?: number
          updated_at?: string
          vat_total?: number
          voided_at?: string | null
        }
        Update: {
          amount_paid?: number
          balance_due?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          discount_total?: number
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string
          prices_include_vat?: boolean
          quote_id?: string | null
          recurring_invoice_id?: string | null
          reference?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          terms?: string
          total?: number
          updated_at?: string
          vat_total?: number
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_recurring_invoice_id_fkey"
            columns: ["recurring_invoice_id"]
            isOneToOne: false
            referencedRelation: "recurring_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          payment_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          payment_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_checkpoints_sent: {
        Row: {
          checkpoint: string
          id: string
          invoice_id: string
          period_month: string
          sent_at: string
        }
        Insert: {
          checkpoint: string
          id?: string
          invoice_id: string
          period_month: string
          sent_at?: string
        }
        Update: {
          checkpoint?: string
          id?: string
          invoice_id?: string
          period_month?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_checkpoints_sent_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          allocation_status: Database["public"]["Enums"]["payment_allocation_status"]
          amount: number
          bank_reference: string
          created_at: string
          created_by: string | null
          customer_id: string
          description: string
          id: string
          notes: string
          payment_date: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          source: string
        }
        Insert: {
          allocation_status?: Database["public"]["Enums"]["payment_allocation_status"]
          amount: number
          bank_reference?: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          description?: string
          id?: string
          notes?: string
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          source?: string
        }
        Update: {
          allocation_status?: Database["public"]["Enums"]["payment_allocation_status"]
          amount?: number
          bank_reference?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          description?: string
          id?: string
          notes?: string
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          cost_price: number | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_active: boolean
          name: string
          selling_price: number
          sku: string
          type: Database["public"]["Enums"]["product_type"]
          unit: string
          updated_at: string
          vat_rate: number
        }
        Insert: {
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_active?: boolean
          name: string
          selling_price?: number
          sku?: string
          type?: Database["public"]["Enums"]["product_type"]
          unit?: string
          updated_at?: string
          vat_rate: number
        }
        Update: {
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          selling_price?: number
          sku?: string
          type?: Database["public"]["Enums"]["product_type"]
          unit?: string
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          staff_module_permissions: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          staff_module_permissions?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          staff_module_permissions?: Json
          updated_at?: string
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          created_at: string
          description: string
          discount_percent: number
          id: string
          line_subtotal: number
          line_total: number
          line_vat: number
          product_id: string | null
          quantity: number
          quote_id: string
          sort_order: number
          unit_price: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          description: string
          discount_percent?: number
          id?: string
          line_subtotal: number
          line_total: number
          line_vat: number
          product_id?: string | null
          quantity: number
          quote_id: string
          sort_order?: number
          unit_price: number
          vat_rate: number
        }
        Update: {
          created_at?: string
          description?: string
          discount_percent?: number
          id?: string
          line_subtotal?: number
          line_total?: number
          line_vat?: number
          product_id?: string | null
          quantity?: number
          quote_id?: string
          sort_order?: number
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          converted_invoice_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          discount_total: number
          expiry_date: string | null
          id: string
          notes: string
          prices_include_vat: boolean
          quote_date: string
          quote_number: string
          reference: string
          status: Database["public"]["Enums"]["quote_status"]
          subtotal: number
          terms: string
          total: number
          updated_at: string
          vat_total: number
        }
        Insert: {
          converted_invoice_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          discount_total?: number
          expiry_date?: string | null
          id?: string
          notes?: string
          prices_include_vat?: boolean
          quote_date?: string
          quote_number: string
          reference?: string
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          terms?: string
          total?: number
          updated_at?: string
          vat_total?: number
        }
        Update: {
          converted_invoice_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          discount_total?: number
          expiry_date?: string | null
          id?: string
          notes?: string
          prices_include_vat?: boolean
          quote_date?: string
          quote_number?: string
          reference?: string
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          terms?: string
          total?: number
          updated_at?: string
          vat_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_converted_invoice_id_fkey"
            columns: ["converted_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_invoice_items: {
        Row: {
          created_at: string
          description: string
          discount_percent: number
          id: string
          product_id: string | null
          quantity: number
          recurring_invoice_id: string
          sort_order: number
          unit_price: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          description: string
          discount_percent?: number
          id?: string
          product_id?: string | null
          quantity: number
          recurring_invoice_id: string
          sort_order?: number
          unit_price: number
          vat_rate: number
        }
        Update: {
          created_at?: string
          description?: string
          discount_percent?: number
          id?: string
          product_id?: string | null
          quantity?: number
          recurring_invoice_id?: string
          sort_order?: number
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_invoice_items_recurring_invoice_id_fkey"
            columns: ["recurring_invoice_id"]
            isOneToOne: false
            referencedRelation: "recurring_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_invoices: {
        Row: {
          auto_generate: boolean
          auto_send_email: boolean
          created_at: string
          created_by: string | null
          custom_interval_days: number | null
          customer_id: string
          description: string
          end_date: string | null
          frequency: Database["public"]["Enums"]["recurring_frequency"]
          id: string
          last_generated_date: string | null
          next_invoice_date: string
          notes: string
          payment_terms_days: number | null
          prices_include_vat: boolean
          start_date: string
          status: Database["public"]["Enums"]["recurring_invoice_status"]
          terms: string
          updated_at: string
        }
        Insert: {
          auto_generate?: boolean
          auto_send_email?: boolean
          created_at?: string
          created_by?: string | null
          custom_interval_days?: number | null
          customer_id: string
          description: string
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          id?: string
          last_generated_date?: string | null
          next_invoice_date: string
          notes?: string
          payment_terms_days?: number | null
          prices_include_vat?: boolean
          start_date?: string
          status?: Database["public"]["Enums"]["recurring_invoice_status"]
          terms?: string
          updated_at?: string
        }
        Update: {
          auto_generate?: boolean
          auto_send_email?: boolean
          created_at?: string
          created_by?: string | null
          custom_interval_days?: number | null
          customer_id?: string
          description?: string
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          id?: string
          last_generated_date?: string | null
          next_invoice_date?: string
          notes?: string
          payment_terms_days?: number | null
          prices_include_vat?: boolean
          start_date?: string
          status?: Database["public"]["Enums"]["recurring_invoice_status"]
          terms?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address_physical: string
          company_name: string
          contact_person: string
          created_at: string
          created_by: string | null
          email: string
          id: string
          is_active: boolean
          notes: string
          phone: string
          updated_at: string
          vat_number: string
        }
        Insert: {
          address_physical?: string
          company_name: string
          contact_person?: string
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          is_active?: boolean
          notes?: string
          phone?: string
          updated_at?: string
          vat_number?: string
        }
        Update: {
          address_physical?: string
          company_name?: string
          contact_person?: string
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          is_active?: boolean
          notes?: string
          phone?: string
          updated_at?: string
          vat_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_customer_credit: {
        Args: {
          p_amount: number
          p_customer_id: string
          p_invoice_id: string
          p_notes: string
        }
        Returns: undefined
      }
      auto_match_bank_transactions: {
        Args: { p_batch_id?: string | null }
        Returns: number
      }
      compute_next_recurring_date: {
        Args: {
          p_current: string
          p_custom_interval_days: number
          p_frequency: Database["public"]["Enums"]["recurring_frequency"]
        }
        Returns: string
      }
      convert_quote_to_invoice: {
        Args: { p_quote_id: string }
        Returns: string
      }
      create_credit_note: {
        Args: {
          p_credit_note_date: string
          p_customer_id: string
          p_discount_total: number
          p_invoice_id?: string | null
          p_line_items: Json
          p_notes: string
          p_prices_include_vat: boolean
          p_reason: string
          p_subtotal: number
          p_terms: string
          p_total: number
          p_vat_total: number
        }
        Returns: string
      }
      create_invoice: {
        Args: {
          p_customer_id: string
          p_discount_total: number
          p_due_date: string
          p_invoice_date: string
          p_line_items: Json
          p_notes: string
          p_prices_include_vat: boolean
          p_quote_id?: string
          p_reference: string
          p_subtotal: number
          p_terms: string
          p_total: number
          p_vat_total: number
        }
        Returns: string
      }
      create_quote: {
        Args: {
          p_customer_id: string
          p_discount_total: number
          p_expiry_date: string | null
          p_line_items: Json
          p_notes: string
          p_prices_include_vat: boolean
          p_quote_date: string
          p_reference: string
          p_subtotal: number
          p_terms: string
          p_total: number
          p_vat_total: number
        }
        Returns: string
      }
      create_recurring_invoice: {
        Args: {
          p_auto_generate: boolean
          p_auto_send_email: boolean
          p_custom_interval_days: number | null
          p_customer_id: string
          p_description: string
          p_end_date: string | null
          p_frequency: Database["public"]["Enums"]["recurring_frequency"]
          p_line_items: Json
          p_notes: string
          p_payment_terms_days: number | null
          p_prices_include_vat: boolean
          p_start_date: string
          p_terms: string
        }
        Returns: string
      }
      current_role_name: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      generate_recurring_invoice: {
        Args: {
          p_discount_total: number
          p_due_date: string
          p_invoice_date: string
          p_line_items: Json
          p_recurring_invoice_id: string
          p_subtotal: number
          p_total: number
          p_vat_total: number
        }
        Returns: string
      }
      get_aging_report: {
        Args: { p_as_of: string }
        Returns: {
          bucket_1_30: number
          bucket_31_60: number
          bucket_61_90: number
          bucket_90_plus: number
          bucket_current: number
          customer_id: string
          customer_name: string
          total: number
        }[]
      }
      get_invoice_summary_totals: {
        Args: never
        Returns: {
          outstanding: number
          overdue: number
          total_paid: number
          total_sales: number
        }[]
      }
      has_module_access: { Args: { module: string }; Returns: boolean }
      import_bank_transactions: {
        Args: { p_filename: string; p_rows: Json }
        Returns: {
          batch_id: string
          duplicate_count: number
          imported_count: number
          row_count: number
        }[]
      }
      is_active_staff: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      issue_credit_note: {
        Args: { p_credit_note_id: string }
        Returns: undefined
      }
      match_bank_transaction: {
        Args: { p_payment_id: string; p_transaction_id: string }
        Returns: undefined
      }
      next_credit_note_number: { Args: never; Returns: string }
      next_customer_account_number: {
        Args: { p_company_name: string }
        Returns: string
      }
      next_invoice_number: { Args: never; Returns: string }
      next_quote_number: { Args: never; Returns: string }
      record_payment: {
        Args: {
          p_amount: number
          p_bank_reference: string
          p_bank_transaction_id?: string | null
          p_customer_id: string
          p_description: string
          p_invoice_allocations: Json
          p_notes: string
          p_payment_date: string
          p_payment_method: Database["public"]["Enums"]["payment_method"]
          p_source?: string
        }
        Returns: string
      }
      skip_next_recurring_invoice: {
        Args: { p_id: string }
        Returns: undefined
      }
      unmatch_bank_transaction: {
        Args: { p_transaction_id: string }
        Returns: undefined
      }
      update_credit_note: {
        Args: {
          p_credit_note_date: string
          p_credit_note_id: string
          p_customer_id: string
          p_discount_total: number
          p_invoice_id?: string | null
          p_line_items: Json
          p_notes: string
          p_prices_include_vat: boolean
          p_reason: string
          p_subtotal: number
          p_terms: string
          p_total: number
          p_vat_total: number
        }
        Returns: undefined
      }
      update_invoice: {
        Args: {
          p_customer_id: string
          p_discount_total: number
          p_due_date: string
          p_invoice_date: string
          p_invoice_id: string
          p_line_items: Json
          p_notes: string
          p_prices_include_vat: boolean
          p_reference: string
          p_subtotal: number
          p_terms: string
          p_total: number
          p_vat_total: number
        }
        Returns: undefined
      }
      update_quote: {
        Args: {
          p_customer_id: string
          p_discount_total: number
          p_expiry_date: string | null
          p_line_items: Json
          p_notes: string
          p_prices_include_vat: boolean
          p_quote_date: string
          p_quote_id: string
          p_reference: string
          p_subtotal: number
          p_terms: string
          p_total: number
          p_vat_total: number
        }
        Returns: undefined
      }
      update_recurring_invoice: {
        Args: {
          p_auto_generate: boolean
          p_auto_send_email: boolean
          p_custom_interval_days: number | null
          p_customer_id: string
          p_description: string
          p_end_date: string | null
          p_frequency: Database["public"]["Enums"]["recurring_frequency"]
          p_id: string
          p_line_items: Json
          p_notes: string
          p_payment_terms_days: number | null
          p_prices_include_vat: boolean
          p_terms: string
        }
        Returns: undefined
      }
      void_credit_note: {
        Args: { p_credit_note_id: string }
        Returns: undefined
      }
    }
    Enums: {
      bank_transaction_status: "unmatched" | "matched" | "ignored"
      credit_note_status: "draft" | "issued" | "cancelled"
      credit_source:
        | "overpayment"
        | "applied_to_invoice"
        | "manual_adjustment"
        | "credit_note"
      customer_type: "business" | "individual"
      email_status: "sent" | "failed" | "skipped"
      invoice_status:
        | "draft"
        | "sent"
        | "partially_paid"
        | "paid"
        | "cancelled"
        | "void"
      payment_allocation_status:
        | "unallocated"
        | "partially_allocated"
        | "fully_allocated"
      payment_method:
        | "eft"
        | "cash"
        | "card"
        | "debit_order"
        | "instant_eft"
        | "other"
      product_type: "product" | "service"
      quote_status:
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "expired"
        | "cancelled"
      recurring_frequency:
        | "weekly"
        | "monthly"
        | "every_2_months"
        | "quarterly"
        | "every_6_months"
        | "annually"
        | "custom"
      recurring_invoice_status: "active" | "paused" | "cancelled"
      user_role: "owner_admin" | "accountant" | "staff"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      bank_transaction_status: ["unmatched", "matched", "ignored"],
      credit_note_status: ["draft", "issued", "cancelled"],
      credit_source: [
        "overpayment",
        "applied_to_invoice",
        "manual_adjustment",
        "credit_note",
      ],
      customer_type: ["business", "individual"],
      email_status: ["sent", "failed", "skipped"],
      invoice_status: [
        "draft",
        "sent",
        "partially_paid",
        "paid",
        "cancelled",
        "void",
      ],
      payment_allocation_status: [
        "unallocated",
        "partially_allocated",
        "fully_allocated",
      ],
      payment_method: [
        "eft",
        "cash",
        "card",
        "debit_order",
        "instant_eft",
        "other",
      ],
      product_type: ["product", "service"],
      quote_status: [
        "draft",
        "sent",
        "accepted",
        "rejected",
        "expired",
        "cancelled",
      ],
      recurring_frequency: [
        "weekly",
        "monthly",
        "every_2_months",
        "quarterly",
        "every_6_months",
        "annually",
        "custom",
      ],
      recurring_invoice_status: ["active", "paused", "cancelled"],
      user_role: ["owner_admin", "accountant", "staff"],
    },
  },
} as const
