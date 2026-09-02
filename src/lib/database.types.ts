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
          actor_name_snapshot: string
          actor_role_snapshot: Database["public"]["Enums"]["user_role"]
          actor_user_id: string
          created_at: string
          entity_id: string
          entity_name_snapshot: string | null
          entity_type: string
          id: string
          metadata: Json | null
          organization_id: string
        }
        Insert: {
          action: string
          actor_name_snapshot: string
          actor_role_snapshot: Database["public"]["Enums"]["user_role"]
          actor_user_id: string
          created_at?: string
          entity_id: string
          entity_name_snapshot?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          organization_id: string
        }
        Update: {
          action?: string
          actor_name_snapshot?: string
          actor_role_snapshot?: Database["public"]["Enums"]["user_role"]
          actor_user_id?: string
          created_at?: string
          entity_id?: string
          entity_name_snapshot?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bike_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          assignment_notes: string | null
          bike_id: string
          condition_at_assignment: string
          condition_at_return: string | null
          courier_id: string
          created_at: string | null
          id: string
          organization_id: string
          plan_duration_unit: Database["public"]["Enums"]["duration_unit"]
          plan_duration_value: number
          plan_name: string
          plan_price: number
          rental_plan_id: string
          return_notes: string | null
          returned_at: string | null
          returned_by: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          assignment_notes?: string | null
          bike_id: string
          condition_at_assignment: string
          condition_at_return?: string | null
          courier_id: string
          created_at?: string | null
          id?: string
          organization_id: string
          plan_duration_unit: Database["public"]["Enums"]["duration_unit"]
          plan_duration_value: number
          plan_name: string
          plan_price: number
          rental_plan_id: string
          return_notes?: string | null
          returned_at?: string | null
          returned_by?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          assignment_notes?: string | null
          bike_id?: string
          condition_at_assignment?: string
          condition_at_return?: string | null
          courier_id?: string
          created_at?: string | null
          id?: string
          organization_id?: string
          plan_duration_unit?: Database["public"]["Enums"]["duration_unit"]
          plan_duration_value?: number
          plan_name?: string
          plan_price?: number
          rental_plan_id?: string
          return_notes?: string | null
          returned_at?: string | null
          returned_by?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bike_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_assignments_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bike_status_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_assignments_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_assignments_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes_awaiting_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_assignments_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_assignments_rental_plan_id_fkey"
            columns: ["rental_plan_id"]
            isOneToOne: false
            referencedRelation: "rental_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_assignments_returned_by_fkey"
            columns: ["returned_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bike_inspections: {
        Row: {
          assignment_id: string | null
          battery_condition:
            | Database["public"]["Enums"]["inspection_condition"]
            | null
          bike_id: string
          brakes_condition:
            | Database["public"]["Enums"]["inspection_condition"]
            | null
          created_at: string | null
          damage_notes: string | null
          damage_photos: string[] | null
          frame_condition:
            | Database["public"]["Enums"]["inspection_condition"]
            | null
          id: string
          inspected_at: string
          inspected_by: string | null
          lights_condition:
            | Database["public"]["Enums"]["inspection_condition"]
            | null
          next_status: Database["public"]["Enums"]["bike_status"]
          notes: string | null
          organization_id: string
          overall_condition: Database["public"]["Enums"]["inspection_condition"]
          requires_maintenance: boolean | null
          tires_condition:
            | Database["public"]["Enums"]["inspection_condition"]
            | null
        }
        Insert: {
          assignment_id?: string | null
          battery_condition?:
            | Database["public"]["Enums"]["inspection_condition"]
            | null
          bike_id: string
          brakes_condition?:
            | Database["public"]["Enums"]["inspection_condition"]
            | null
          created_at?: string | null
          damage_notes?: string | null
          damage_photos?: string[] | null
          frame_condition?:
            | Database["public"]["Enums"]["inspection_condition"]
            | null
          id?: string
          inspected_at?: string
          inspected_by?: string | null
          lights_condition?:
            | Database["public"]["Enums"]["inspection_condition"]
            | null
          next_status: Database["public"]["Enums"]["bike_status"]
          notes?: string | null
          organization_id: string
          overall_condition: Database["public"]["Enums"]["inspection_condition"]
          requires_maintenance?: boolean | null
          tires_condition?:
            | Database["public"]["Enums"]["inspection_condition"]
            | null
        }
        Update: {
          assignment_id?: string | null
          battery_condition?:
            | Database["public"]["Enums"]["inspection_condition"]
            | null
          bike_id?: string
          brakes_condition?:
            | Database["public"]["Enums"]["inspection_condition"]
            | null
          created_at?: string | null
          damage_notes?: string | null
          damage_photos?: string[] | null
          frame_condition?:
            | Database["public"]["Enums"]["inspection_condition"]
            | null
          id?: string
          inspected_at?: string
          inspected_by?: string | null
          lights_condition?:
            | Database["public"]["Enums"]["inspection_condition"]
            | null
          next_status?: Database["public"]["Enums"]["bike_status"]
          notes?: string | null
          organization_id?: string
          overall_condition?: Database["public"]["Enums"]["inspection_condition"]
          requires_maintenance?: boolean | null
          tires_condition?:
            | Database["public"]["Enums"]["inspection_condition"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "bike_inspections_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "bike_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_inspections_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "bike_status_summary"
            referencedColumns: ["current_assignment_id"]
          },
          {
            foreignKeyName: "bike_inspections_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bike_status_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_inspections_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_inspections_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes_awaiting_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_inspections_inspected_by_fkey"
            columns: ["inspected_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_inspections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bikes: {
        Row: {
          battery_info: string | null
          bike_number: string
          condition_notes: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string
          image_url: string | null
          model: string
          organization_id: string
          purchase_date: string | null
          purchase_price: number | null
          serial_number: string | null
          status: Database["public"]["Enums"]["bike_status"] | null
          updated_at: string | null
        }
        Insert: {
          battery_info?: string | null
          bike_number: string
          condition_notes?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          image_url?: string | null
          model: string
          organization_id: string
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["bike_status"] | null
          updated_at?: string | null
        }
        Update: {
          battery_info?: string | null
          bike_number?: string
          condition_notes?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          image_url?: string | null
          model?: string
          organization_id?: string
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["bike_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bikes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bikes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      couriers: {
        Row: {
          address: string | null
          courier_code: string
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          emergency_contact: string | null
          full_name: string
          id: string
          identification_number: string | null
          notes: string | null
          organization_id: string
          phone: string
          start_date: string
          status: Database["public"]["Enums"]["courier_status"] | null
          updated_at: string | null
          yandex_identifier: string | null
        }
        Insert: {
          address?: string | null
          courier_code: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          emergency_contact?: string | null
          full_name: string
          id?: string
          identification_number?: string | null
          notes?: string | null
          organization_id: string
          phone: string
          start_date?: string
          status?: Database["public"]["Enums"]["courier_status"] | null
          updated_at?: string | null
          yandex_identifier?: string | null
        }
        Update: {
          address?: string | null
          courier_code?: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          emergency_contact?: string | null
          full_name?: string
          id?: string
          identification_number?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string
          start_date?: string
          status?: Database["public"]["Enums"]["courier_status"] | null
          updated_at?: string | null
          yandex_identifier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "couriers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couriers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deductions: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          deduction_type: Database["public"]["Enums"]["deduction_type"]
          description: string
          earnings_period_id: string
          id: string
          organization_id: string
          reference_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          deduction_type: Database["public"]["Enums"]["deduction_type"]
          description: string
          earnings_period_id: string
          id?: string
          organization_id: string
          reference_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          deduction_type?: Database["public"]["Enums"]["deduction_type"]
          description?: string
          earnings_period_id?: string
          id?: string
          organization_id?: string
          reference_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deductions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deductions_earnings_period_id_fkey"
            columns: ["earnings_period_id"]
            isOneToOne: false
            referencedRelation: "earnings_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deductions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      earnings_activity: {
        Row: {
          activity_type: Database["public"]["Enums"]["earnings_activity_type"]
          actor_id: string
          created_at: string | null
          details: Json | null
          earnings_period_id: string
          id: string
          organization_id: string
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["earnings_activity_type"]
          actor_id: string
          created_at?: string | null
          details?: Json | null
          earnings_period_id: string
          id?: string
          organization_id: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["earnings_activity_type"]
          actor_id?: string
          created_at?: string | null
          details?: Json | null
          earnings_period_id?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "earnings_activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "earnings_activity_earnings_period_id_fkey"
            columns: ["earnings_period_id"]
            isOneToOne: false
            referencedRelation: "earnings_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "earnings_activity_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      earnings_periods: {
        Row: {
          courier_id: string
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          gross_earnings: number
          id: string
          net_payout: number
          notes: string | null
          organization_id: string
          paid_at: string | null
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["earnings_status"] | null
          total_deductions: number
          updated_at: string | null
        }
        Insert: {
          courier_id: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          gross_earnings?: number
          id?: string
          net_payout?: number
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["earnings_status"] | null
          total_deductions?: number
          updated_at?: string | null
        }
        Update: {
          courier_id?: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          gross_earnings?: number
          id?: string
          net_payout?: number
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["earnings_status"] | null
          total_deductions?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "earnings_periods_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "earnings_periods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "earnings_periods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string
          expense_date: string
          expense_number: string
          id: string
          organization_id: string
          receipt_url: string | null
          updated_at: string | null
          vendor: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description: string
          expense_date?: string
          expense_number: string
          id?: string
          organization_id: string
          receipt_url?: string | null
          updated_at?: string | null
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          expense_date?: string
          expense_number?: string
          id?: string
          organization_id?: string
          receipt_url?: string | null
          updated_at?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      income_entries: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          earnings_period_id: string
          id: string
          notes: string | null
          organization_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          earnings_period_id: string
          id?: string
          notes?: string | null
          organization_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          earnings_period_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_entries_earnings_period_id_fkey"
            columns: ["earnings_period_id"]
            isOneToOne: false
            referencedRelation: "earnings_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_records: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          bike_id: string
          cost: number | null
          created_at: string | null
          description: string
          id: string
          image_urls: string[]
          maintenance_type: Database["public"]["Enums"]["maintenance_type"]
          notes: string | null
          organization_id: string
          parts_replaced: string | null
          performed_at: string
          performed_by: string | null
          requires_approval: boolean | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          bike_id: string
          cost?: number | null
          created_at?: string | null
          description: string
          id?: string
          image_urls: string[]
          maintenance_type: Database["public"]["Enums"]["maintenance_type"]
          notes?: string | null
          organization_id: string
          parts_replaced?: string | null
          performed_at?: string
          performed_by?: string | null
          requires_approval?: boolean | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          bike_id?: string
          cost?: number | null
          created_at?: string | null
          description?: string
          id?: string
          image_urls?: string[]
          maintenance_type?: Database["public"]["Enums"]["maintenance_type"]
          notes?: string | null
          organization_id?: string
          parts_replaced?: string | null
          performed_at?: string
          performed_by?: string | null
          requires_approval?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_records_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bike_status_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes_awaiting_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          name: string
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      rental_plans: {
        Row: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string | null
          duration_unit: Database["public"]["Enums"]["duration_unit"]
          duration_value: number
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          duration_unit: Database["public"]["Enums"]["duration_unit"]
          duration_value: number
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          price: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          duration_unit?: Database["public"]["Enums"]["duration_unit"]
          duration_value?: number
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rental_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          organization_id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean | null
          organization_id: string
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          organization_id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      bike_status_summary: {
        Row: {
          assigned_at: string | null
          bike_number: string | null
          courier_id: string | null
          courier_name: string | null
          current_assignment_id: string | null
          id: string | null
          last_inspection_at: string | null
          last_maintenance_at: string | null
          model: string | null
          organization_id: string | null
          status: Database["public"]["Enums"]["bike_status"] | null
          total_maintenance_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bike_assignments_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bikes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bikes_awaiting_inspection: {
        Row: {
          bike_number: string | null
          condition_at_return: string | null
          courier_id: string | null
          courier_name: string | null
          id: string | null
          image_url: string | null
          model: string | null
          organization_id: string | null
          returned_at: string | null
          returned_by: string | null
          returned_by_name: string | null
          status: Database["public"]["Enums"]["bike_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "bike_assignments_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_assignments_returned_by_fkey"
            columns: ["returned_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bikes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_pending_approval: {
        Row: {
          bike_id: string | null
          bike_number: string | null
          cost: number | null
          created_at: string | null
          description: string | null
          id: string | null
          maintenance_type:
            | Database["public"]["Enums"]["maintenance_type"]
            | null
          model: string | null
          organization_id: string | null
          performed_at: string | null
          performed_by: string | null
          performed_by_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_records_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bike_status_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes_awaiting_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recent_audit_activity: {
        Row: {
          action: string | null
          actor_name_snapshot: string | null
          actor_role_snapshot: Database["public"]["Enums"]["user_role"] | null
          actor_user_id: string | null
          created_at: string | null
          description: string | null
          entity_id: string | null
          entity_name_snapshot: string | null
          entity_type: string | null
          id: string | null
          metadata: Json | null
          organization_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      adjust_inventory: {
        Args: {
          p_delta: number
          p_item_id: string
          p_notes?: string
          p_organization_id: string
          p_product_id: string
          p_reason: string
        }
        Returns: string
      }
      current_organization_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      fn_reallocate_customer_payments: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      fn_sale_holds_stock: { Args: { p_sale_id: string }; Returns: boolean }
      generate_bike_number: { Args: { org_id: string }; Returns: string }
      generate_courier_code: { Args: { org_id: string }; Returns: string }
      generate_earnings_number: { Args: { org_id: string }; Returns: string }
      generate_expense_number: { Args: { org_id: string }; Returns: string }
      has_role_or_above: {
        Args: { required_role: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_entity_id: string
          p_entity_name?: string
          p_entity_type: string
          p_metadata?: Json
          p_organization_id: string
        }
        Returns: string
      }
      remove_sale_item: {
        Args: {
          p_item_id: string
          p_organization_id: string
          p_sale_id: string
        }
        Returns: undefined
      }
      set_inventory_count: {
        Args: {
          p_counted: number
          p_item_id: string
          p_notes?: string
          p_organization_id: string
          p_product_id: string
        }
        Returns: string
      }
      update_payment_amount: {
        Args: {
          p_amount: number
          p_organization_id: string
          p_payment_id: string
        }
        Returns: undefined
      }
      upsert_sale_item: {
        Args: {
          p_discount?: number
          p_item_id?: string
          p_organization_id: string
          p_product_id?: string
          p_quantity?: number
          p_sale_id: string
          p_unit_price?: number
        }
        Returns: string
      }
      void_sale: {
        Args: { p_organization_id: string; p_sale_id: string }
        Returns: undefined
      }
    }
    Enums: {
      bike_status:
        | "available"
        | "assigned"
        | "returned"
        | "maintenance"
        | "damaged"
        | "retired"
      courier_status: "active" | "inactive" | "suspended"
      deduction_type: "rental" | "damage" | "equipment" | "other"
      duration_unit: "days" | "weeks" | "months"
      earnings_activity_type:
        | "period_created"
        | "period_updated"
        | "period_deleted"
        | "status_changed"
        | "marked_as_paid"
        | "income_added"
        | "income_deleted"
        | "deduction_added"
        | "deduction_deleted"
      earnings_status: "draft" | "approved" | "paid"
      inspection_condition: "excellent" | "good" | "fair" | "poor" | "damaged"
      maintenance_type:
        | "repair"
        | "inspection"
        | "replacement"
        | "cleaning"
        | "other"
      user_role: "admin" | "manager" | "mechanic"
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
      bike_status: [
        "available",
        "assigned",
        "returned",
        "maintenance",
        "damaged",
        "retired",
      ],
      courier_status: ["active", "inactive", "suspended"],
      deduction_type: ["rental", "damage", "equipment", "other"],
      duration_unit: ["days", "weeks", "months"],
      earnings_activity_type: [
        "period_created",
        "period_updated",
        "period_deleted",
        "status_changed",
        "marked_as_paid",
        "income_added",
        "income_deleted",
        "deduction_added",
        "deduction_deleted",
      ],
      earnings_status: ["draft", "approved", "paid"],
      inspection_condition: ["excellent", "good", "fair", "poor", "damaged"],
      maintenance_type: [
        "repair",
        "inspection",
        "replacement",
        "cleaning",
        "other",
      ],
      user_role: ["admin", "manager", "mechanic"],
    },
  },
} as const
