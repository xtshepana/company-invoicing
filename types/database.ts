export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          created_at: string;
          entity: string;
          entity_id: string | null;
          id: string;
          new_value: Json | null;
          old_value: Json | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          entity: string;
          entity_id?: string | null;
          id?: string;
          new_value?: Json | null;
          old_value?: Json | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          entity?: string;
          entity_id?: string | null;
          id?: string;
          new_value?: Json | null;
          old_value?: Json | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      company_settings: {
        Row: {
          address_physical: string;
          address_postal: string;
          bank_account_name: string;
          bank_account_number: string;
          bank_account_type: string;
          bank_branch_code: string;
          bank_name: string;
          company_name: string;
          credit_note_next_number: number;
          credit_note_prefix: string;
          default_currency: string;
          default_invoice_footer: string;
          default_invoice_notes: string;
          default_payment_terms_days: number;
          default_prices_include_vat: boolean;
          default_quote_terms: string;
          default_vat_rate: number;
          email: string;
          id: boolean;
          invoice_next_number: number;
          invoice_prefix: string;
          logo_url: string | null;
          payment_reminders_enabled: boolean;
          phone: string;
          quote_next_number: number;
          quote_prefix: string;
          registration_number: string;
          trading_name: string;
          updated_at: string;
          vat_number: string;
          website: string;
        };
        Insert: Partial<Database["public"]["Tables"]["company_settings"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["company_settings"]["Row"]>;
        Relationships: [];
      };
      customers: {
        Row: {
          address_physical: string;
          address_postal: string;
          company_name: string;
          contact_person: string;
          created_at: string;
          created_by: string | null;
          customer_reference: string;
          customer_type: Database["public"]["Enums"]["customer_type"];
          email: string;
          id: string;
          is_active: boolean;
          mobile: string;
          notes: string;
          opening_balance: number;
          payment_terms_days: number | null;
          phone: string;
          registration_number: string;
          updated_at: string;
          vat_number: string;
        };
        Insert: {
          address_physical?: string;
          address_postal?: string;
          company_name: string;
          contact_person?: string;
          created_at?: string;
          created_by?: string | null;
          customer_reference?: string;
          customer_type?: Database["public"]["Enums"]["customer_type"];
          email?: string;
          id?: string;
          is_active?: boolean;
          mobile?: string;
          notes?: string;
          opening_balance?: number;
          payment_terms_days?: number | null;
          phone?: string;
          registration_number?: string;
          updated_at?: string;
          vat_number?: string;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "customers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_allocations: {
        Row: {
          amount: number;
          created_at: string;
          created_by: string | null;
          id: string;
          invoice_id: string;
          payment_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          invoice_id: string;
          payment_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["payment_allocations"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "payment_allocations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          allocation_status: Database["public"]["Enums"]["payment_allocation_status"];
          amount: number;
          bank_reference: string;
          created_at: string;
          created_by: string | null;
          customer_id: string;
          description: string;
          id: string;
          notes: string;
          payment_date: string;
          payment_method: Database["public"]["Enums"]["payment_method"];
          source: string;
        };
        Insert: {
          allocation_status?: Database["public"]["Enums"]["payment_allocation_status"];
          amount: number;
          bank_reference?: string;
          created_at?: string;
          created_by?: string | null;
          customer_id: string;
          description?: string;
          id?: string;
          notes?: string;
          payment_date?: string;
          payment_method?: Database["public"]["Enums"]["payment_method"];
          source?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "payments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      bank_import_batches: {
        Row: {
          duplicate_count: number;
          filename: string;
          id: string;
          imported_by: string | null;
          imported_count: number;
          row_count: number;
          created_at: string;
        };
        Insert: {
          duplicate_count?: number;
          filename: string;
          id?: string;
          imported_by?: string | null;
          imported_count?: number;
          row_count: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["bank_import_batches"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "bank_import_batches_imported_by_fkey";
            columns: ["imported_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      bank_transactions: {
        Row: {
          amount: number;
          balance_after: number | null;
          created_at: string;
          dedupe_hash: string;
          description: string;
          id: string;
          import_batch_id: string;
          matched_at: string | null;
          matched_by: string | null;
          matched_payment_id: string | null;
          notes: string;
          reference: string | null;
          status: Database["public"]["Enums"]["bank_transaction_status"];
          transaction_date: string;
        };
        Insert: {
          amount: number;
          balance_after?: number | null;
          created_at?: string;
          dedupe_hash: string;
          description: string;
          id?: string;
          import_batch_id: string;
          matched_at?: string | null;
          matched_by?: string | null;
          matched_payment_id?: string | null;
          notes?: string;
          reference?: string | null;
          status?: Database["public"]["Enums"]["bank_transaction_status"];
          transaction_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["bank_transactions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "bank_transactions_import_batch_id_fkey";
            columns: ["import_batch_id"];
            isOneToOne: false;
            referencedRelation: "bank_import_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bank_transactions_matched_by_fkey";
            columns: ["matched_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bank_transactions_matched_payment_id_fkey";
            columns: ["matched_payment_id"];
            isOneToOne: true;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          cost_price: number | null;
          created_at: string;
          created_by: string | null;
          description: string;
          id: string;
          is_active: boolean;
          name: string;
          selling_price: number;
          sku: string;
          type: Database["public"]["Enums"]["product_type"];
          unit: string;
          updated_at: string;
          vat_rate: number;
        };
        Insert: {
          cost_price?: number | null;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          selling_price?: number;
          sku?: string;
          type?: Database["public"]["Enums"]["product_type"];
          unit?: string;
          updated_at?: string;
          vat_rate: number;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "products_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_credits: {
        Row: {
          amount: number;
          created_at: string;
          created_by: string | null;
          credit_note_id: string | null;
          customer_id: string;
          id: string;
          invoice_id: string | null;
          notes: string;
          payment_id: string | null;
          source: Database["public"]["Enums"]["credit_source"];
        };
        Insert: {
          amount: number;
          created_at?: string;
          created_by?: string | null;
          credit_note_id?: string | null;
          customer_id: string;
          id?: string;
          invoice_id?: string | null;
          notes?: string;
          payment_id?: string | null;
          source: Database["public"]["Enums"]["credit_source"];
        };
        Update: Partial<Database["public"]["Tables"]["customer_credits"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "customer_credits_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_credits_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_credits_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_credits_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_credits_credit_note_id_fkey";
            columns: ["credit_note_id"];
            isOneToOne: false;
            referencedRelation: "credit_notes";
            referencedColumns: ["id"];
          },
        ];
      };
      credit_notes: {
        Row: {
          created_at: string;
          created_by: string | null;
          credit_note_date: string;
          credit_note_number: string;
          customer_id: string;
          discount_total: number;
          id: string;
          invoice_id: string | null;
          issued_at: string | null;
          notes: string;
          prices_include_vat: boolean;
          reason: string;
          status: Database["public"]["Enums"]["credit_note_status"];
          subtotal: number;
          terms: string;
          total: number;
          updated_at: string;
          vat_total: number;
          voided_at: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          credit_note_date?: string;
          credit_note_number: string;
          customer_id: string;
          discount_total?: number;
          id?: string;
          invoice_id?: string | null;
          issued_at?: string | null;
          notes?: string;
          prices_include_vat?: boolean;
          reason?: string;
          status?: Database["public"]["Enums"]["credit_note_status"];
          subtotal?: number;
          terms?: string;
          total?: number;
          updated_at?: string;
          vat_total?: number;
          voided_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["credit_notes"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "credit_notes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_notes_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      credit_note_items: {
        Row: {
          created_at: string;
          credit_note_id: string;
          description: string;
          discount_percent: number;
          id: string;
          line_subtotal: number;
          line_total: number;
          line_vat: number;
          product_id: string | null;
          quantity: number;
          sort_order: number;
          unit_price: number;
          vat_rate: number;
        };
        Insert: {
          created_at?: string;
          credit_note_id: string;
          description: string;
          discount_percent?: number;
          id?: string;
          line_subtotal: number;
          line_total: number;
          line_vat: number;
          product_id?: string | null;
          quantity: number;
          sort_order?: number;
          unit_price: number;
          vat_rate: number;
        };
        Update: Partial<Database["public"]["Tables"]["credit_note_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "credit_note_items_credit_note_id_fkey";
            columns: ["credit_note_id"];
            isOneToOne: false;
            referencedRelation: "credit_notes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_note_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      email_logs: {
        Row: {
          created_at: string;
          email_type: string;
          entity: string;
          entity_id: string | null;
          error: string | null;
          id: string;
          recipient: string;
          status: Database["public"]["Enums"]["email_status"];
          subject: string;
        };
        Insert: {
          created_at?: string;
          email_type: string;
          entity: string;
          entity_id?: string | null;
          error?: string | null;
          id?: string;
          recipient: string;
          status: Database["public"]["Enums"]["email_status"];
          subject: string;
        };
        Update: Partial<Database["public"]["Tables"]["email_logs"]["Insert"]>;
        Relationships: [];
      };
      invoice_items: {
        Row: {
          created_at: string;
          description: string;
          discount_percent: number;
          id: string;
          invoice_id: string;
          line_subtotal: number;
          line_total: number;
          line_vat: number;
          product_id: string | null;
          quantity: number;
          sort_order: number;
          unit_price: number;
          vat_rate: number;
        };
        Insert: {
          created_at?: string;
          description: string;
          discount_percent?: number;
          id?: string;
          invoice_id: string;
          line_subtotal: number;
          line_total: number;
          line_vat: number;
          product_id?: string | null;
          quantity: number;
          sort_order?: number;
          unit_price: number;
          vat_rate: number;
        };
        Update: Partial<Database["public"]["Tables"]["invoice_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_reminders_sent: {
        Row: {
          id: string;
          invoice_id: string;
          offset_days: number;
          sent_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          offset_days: number;
          sent_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["invoice_reminders_sent"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "invoice_reminders_sent_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          amount_paid: number;
          balance_due: number | null;
          created_at: string;
          created_by: string | null;
          customer_id: string;
          discount_total: number;
          due_date: string;
          id: string;
          invoice_date: string;
          invoice_number: string;
          notes: string;
          prices_include_vat: boolean;
          quote_id: string | null;
          recurring_invoice_id: string | null;
          reference: string;
          status: Database["public"]["Enums"]["invoice_status"];
          subtotal: number;
          terms: string;
          total: number;
          updated_at: string;
          vat_total: number;
          voided_at: string | null;
        };
        Insert: {
          amount_paid?: number;
          created_at?: string;
          created_by?: string | null;
          customer_id: string;
          discount_total?: number;
          due_date?: string;
          id?: string;
          invoice_date?: string;
          invoice_number: string;
          notes?: string;
          prices_include_vat?: boolean;
          quote_id?: string | null;
          recurring_invoice_id?: string | null;
          reference?: string;
          status?: Database["public"]["Enums"]["invoice_status"];
          subtotal?: number;
          terms?: string;
          total?: number;
          updated_at?: string;
          vat_total?: number;
          voided_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["invoices"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "invoices_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_recurring_invoice_id_fkey";
            columns: ["recurring_invoice_id"];
            isOneToOne: false;
            referencedRelation: "recurring_invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      quote_items: {
        Row: {
          created_at: string;
          description: string;
          discount_percent: number;
          id: string;
          line_subtotal: number;
          line_total: number;
          line_vat: number;
          product_id: string | null;
          quantity: number;
          quote_id: string;
          sort_order: number;
          unit_price: number;
          vat_rate: number;
        };
        Insert: {
          created_at?: string;
          description: string;
          discount_percent?: number;
          id?: string;
          line_subtotal: number;
          line_total: number;
          line_vat: number;
          product_id?: string | null;
          quantity: number;
          quote_id: string;
          sort_order?: number;
          unit_price: number;
          vat_rate: number;
        };
        Update: Partial<Database["public"]["Tables"]["quote_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "quote_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
        ];
      };
      quotes: {
        Row: {
          converted_invoice_id: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string;
          discount_total: number;
          expiry_date: string | null;
          id: string;
          notes: string;
          prices_include_vat: boolean;
          quote_date: string;
          quote_number: string;
          reference: string;
          status: Database["public"]["Enums"]["quote_status"];
          subtotal: number;
          terms: string;
          total: number;
          updated_at: string;
          vat_total: number;
        };
        Insert: {
          converted_invoice_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id: string;
          discount_total?: number;
          expiry_date?: string | null;
          id?: string;
          notes?: string;
          prices_include_vat?: boolean;
          quote_date?: string;
          quote_number: string;
          reference?: string;
          status?: Database["public"]["Enums"]["quote_status"];
          subtotal?: number;
          terms?: string;
          total?: number;
          updated_at?: string;
          vat_total?: number;
        };
        Update: Partial<Database["public"]["Tables"]["quotes"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "quotes_converted_invoice_id_fkey";
            columns: ["converted_invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      recurring_invoice_items: {
        Row: {
          created_at: string;
          description: string;
          discount_percent: number;
          id: string;
          product_id: string | null;
          quantity: number;
          recurring_invoice_id: string;
          sort_order: number;
          unit_price: number;
          vat_rate: number;
        };
        Insert: {
          created_at?: string;
          description: string;
          discount_percent?: number;
          id?: string;
          product_id?: string | null;
          quantity: number;
          recurring_invoice_id: string;
          sort_order?: number;
          unit_price: number;
          vat_rate: number;
        };
        Update: Partial<Database["public"]["Tables"]["recurring_invoice_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "recurring_invoice_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_invoice_items_recurring_invoice_id_fkey";
            columns: ["recurring_invoice_id"];
            isOneToOne: false;
            referencedRelation: "recurring_invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      recurring_invoices: {
        Row: {
          auto_generate: boolean;
          auto_send_email: boolean;
          created_at: string;
          created_by: string | null;
          custom_interval_days: number | null;
          customer_id: string;
          description: string;
          end_date: string | null;
          frequency: Database["public"]["Enums"]["recurring_frequency"];
          id: string;
          last_generated_date: string | null;
          next_invoice_date: string;
          notes: string;
          payment_terms_days: number | null;
          prices_include_vat: boolean;
          start_date: string;
          status: Database["public"]["Enums"]["recurring_invoice_status"];
          terms: string;
          updated_at: string;
        };
        Insert: {
          auto_generate?: boolean;
          auto_send_email?: boolean;
          created_at?: string;
          created_by?: string | null;
          custom_interval_days?: number | null;
          customer_id: string;
          description: string;
          end_date?: string | null;
          frequency?: Database["public"]["Enums"]["recurring_frequency"];
          id?: string;
          last_generated_date?: string | null;
          next_invoice_date: string;
          notes?: string;
          payment_terms_days?: number | null;
          prices_include_vat?: boolean;
          start_date?: string;
          status?: Database["public"]["Enums"]["recurring_invoice_status"];
          terms?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recurring_invoices"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "recurring_invoices_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_invoices_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          role: Database["public"]["Enums"]["user_role"];
          staff_module_permissions: Json;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string;
          id: string;
          is_active?: boolean;
          role?: Database["public"]["Enums"]["user_role"];
          staff_module_permissions?: Json;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          role?: Database["public"]["Enums"]["user_role"];
          staff_module_permissions?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_invoice_summary_totals: {
        Args: Record<string, never>;
        Returns: { total_sales: number; total_paid: number; outstanding: number; overdue: number }[];
      };
      apply_customer_credit: {
        Args: { p_amount: number; p_customer_id: string; p_invoice_id: string; p_notes: string };
        Returns: undefined;
      };
      record_payment: {
        Args: {
          p_amount: number;
          p_bank_reference: string;
          p_bank_transaction_id?: string | null;
          p_customer_id: string;
          p_description: string;
          p_invoice_allocations: Json;
          p_notes: string;
          p_payment_date: string;
          p_payment_method: Database["public"]["Enums"]["payment_method"];
          p_source?: string;
        };
        Returns: string;
      };
      next_credit_note_number: { Args: Record<string, never>; Returns: string };
      create_credit_note: {
        Args: {
          p_credit_note_date: string;
          p_customer_id: string;
          p_discount_total: number;
          p_invoice_id?: string | null;
          p_line_items: Json;
          p_notes: string;
          p_prices_include_vat: boolean;
          p_reason: string;
          p_subtotal: number;
          p_terms: string;
          p_total: number;
          p_vat_total: number;
        };
        Returns: string;
      };
      update_credit_note: {
        Args: {
          p_credit_note_date: string;
          p_credit_note_id: string;
          p_customer_id: string;
          p_discount_total: number;
          p_invoice_id?: string | null;
          p_line_items: Json;
          p_notes: string;
          p_prices_include_vat: boolean;
          p_reason: string;
          p_subtotal: number;
          p_terms: string;
          p_total: number;
          p_vat_total: number;
        };
        Returns: undefined;
      };
      issue_credit_note: { Args: { p_credit_note_id: string }; Returns: undefined };
      void_credit_note: { Args: { p_credit_note_id: string }; Returns: undefined };
      import_bank_transactions: {
        Args: { p_filename: string; p_rows: Json };
        Returns: { batch_id: string; imported_count: number; duplicate_count: number; row_count: number }[];
      };
      match_bank_transaction: {
        Args: { p_transaction_id: string; p_payment_id: string };
        Returns: undefined;
      };
      unmatch_bank_transaction: {
        Args: { p_transaction_id: string };
        Returns: undefined;
      };
      auto_match_bank_transactions: {
        Args: { p_batch_id?: string | null };
        Returns: number;
      };
      compute_next_recurring_date: {
        Args: {
          p_current: string;
          p_custom_interval_days: number | null;
          p_frequency: Database["public"]["Enums"]["recurring_frequency"];
        };
        Returns: string;
      };
      create_recurring_invoice: {
        Args: {
          p_auto_generate: boolean;
          p_auto_send_email: boolean;
          p_custom_interval_days: number | null;
          p_customer_id: string;
          p_description: string;
          p_end_date: string | null;
          p_frequency: Database["public"]["Enums"]["recurring_frequency"];
          p_line_items: Json;
          p_notes: string;
          p_payment_terms_days: number | null;
          p_prices_include_vat: boolean;
          p_start_date: string;
          p_terms: string;
        };
        Returns: string;
      };
      update_recurring_invoice: {
        Args: {
          p_auto_generate: boolean;
          p_auto_send_email: boolean;
          p_custom_interval_days: number | null;
          p_customer_id: string;
          p_description: string;
          p_end_date: string | null;
          p_frequency: Database["public"]["Enums"]["recurring_frequency"];
          p_id: string;
          p_line_items: Json;
          p_notes: string;
          p_payment_terms_days: number | null;
          p_prices_include_vat: boolean;
          p_terms: string;
        };
        Returns: undefined;
      };
      skip_next_recurring_invoice: { Args: { p_id: string }; Returns: undefined };
      generate_recurring_invoice: {
        Args: {
          p_discount_total: number;
          p_due_date: string;
          p_invoice_date: string;
          p_line_items: Json;
          p_recurring_invoice_id: string;
          p_subtotal: number;
          p_total: number;
          p_vat_total: number;
        };
        Returns: string;
      };
      convert_quote_to_invoice: { Args: { p_quote_id: string }; Returns: string };
      create_invoice: {
        Args: {
          p_customer_id: string;
          p_discount_total: number;
          p_due_date: string;
          p_invoice_date: string;
          p_line_items: Json;
          p_notes: string;
          p_prices_include_vat: boolean;
          p_quote_id?: string;
          p_reference: string;
          p_subtotal: number;
          p_terms: string;
          p_total: number;
          p_vat_total: number;
        };
        Returns: string;
      };
      create_quote: {
        Args: {
          p_customer_id: string;
          p_discount_total: number;
          p_expiry_date: string | null;
          p_line_items: Json;
          p_notes: string;
          p_prices_include_vat: boolean;
          p_quote_date: string;
          p_reference: string;
          p_subtotal: number;
          p_terms: string;
          p_total: number;
          p_vat_total: number;
        };
        Returns: string;
      };
      current_role_name: {
        Args: Record<string, never>;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      has_module_access: { Args: { module: string }; Returns: boolean };
      is_active_staff: { Args: Record<string, never>; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      next_invoice_number: { Args: Record<string, never>; Returns: string };
      next_quote_number: { Args: Record<string, never>; Returns: string };
      update_invoice: {
        Args: {
          p_customer_id: string;
          p_discount_total: number;
          p_due_date: string;
          p_invoice_date: string;
          p_invoice_id: string;
          p_line_items: Json;
          p_notes: string;
          p_prices_include_vat: boolean;
          p_reference: string;
          p_subtotal: number;
          p_terms: string;
          p_total: number;
          p_vat_total: number;
        };
        Returns: undefined;
      };
      update_quote: {
        Args: {
          p_customer_id: string;
          p_discount_total: number;
          p_expiry_date: string | null;
          p_line_items: Json;
          p_notes: string;
          p_prices_include_vat: boolean;
          p_quote_date: string;
          p_quote_id: string;
          p_reference: string;
          p_subtotal: number;
          p_terms: string;
          p_total: number;
          p_vat_total: number;
        };
        Returns: undefined;
      };
    };
    Enums: {
      bank_transaction_status: "unmatched" | "matched" | "ignored";
      credit_note_status: "draft" | "issued" | "cancelled";
      credit_source: "overpayment" | "applied_to_invoice" | "manual_adjustment" | "credit_note";
      customer_type: "business" | "individual";
      email_status: "sent" | "failed" | "skipped";
      invoice_status: "draft" | "sent" | "partially_paid" | "paid" | "cancelled" | "void";
      payment_allocation_status: "unallocated" | "partially_allocated" | "fully_allocated";
      payment_method: "eft" | "cash" | "card" | "debit_order" | "instant_eft" | "other";
      product_type: "product" | "service";
      quote_status: "draft" | "sent" | "accepted" | "rejected" | "expired" | "cancelled";
      recurring_frequency:
        | "weekly"
        | "monthly"
        | "every_2_months"
        | "quarterly"
        | "every_6_months"
        | "annually"
        | "custom";
      recurring_invoice_status: "active" | "paused" | "cancelled";
      user_role: "owner_admin" | "accountant" | "staff";
    };
    CompositeTypes: Record<string, never>;
  };
};

type DefaultSchema = Database["public"];

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"];
export type Enums<T extends keyof DefaultSchema["Enums"]> =
  DefaultSchema["Enums"][T];
