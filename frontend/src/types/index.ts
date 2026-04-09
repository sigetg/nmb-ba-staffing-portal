// User types
export type UserRole = 'ba' | 'admin'

export interface User {
  id: string
  email: string
  role: UserRole
  created_at: string
  updated_at?: string
}

// BA Profile types
export type BAStatus = 'pending' | 'approved' | 'rejected' | 'suspended'

export interface BAProfile {
  id: string
  user_id: string
  name: string
  phone: string
  zip_code: string
  status: BAStatus
  availability: Record<string, unknown>
  languages?: string[]
  shirt_size?: string
  additional_info?: string
  admin_notes?: string
  resume_url?: string
  has_seen_welcome?: boolean
  stripe_account_id?: string
  latitude?: number | null
  longitude?: number | null
  created_at: string
  updated_at?: string
  email?: string
}

export interface BAPhoto {
  id: string
  ba_id: string
  photo_type: string
  url: string
  created_at: string
}

// Job types
export type JobStatus = 'draft' | 'published' | 'cancelled' | 'archived'
export type DisplayJobStatus = 'draft' | 'upcoming' | 'in_progress' | 'completed' | 'cancelled' | 'archived'

export interface Job {
  id: string
  title: string
  brand: string
  description: string
  pay_rate: number
  slots: number
  slots_filled: number
  status: JobStatus
  timezone: string
  worksheet_url?: string
  job_type_id?: string | null
  job_types?: { id: string; name: string } | null
  created_at: string
  updated_at?: string
  // Multi-day relations (populated when fetched with nested query)
  job_days?: JobDay[]
}

// Job Type system
export interface JobType {
  id: string
  name: string
  description?: string | null
  sort_order: number
  is_archived: boolean
  created_at: string
  updated_at?: string | null
  job_type_kpis?: JobTypeKpi[]
  job_type_questions?: JobTypeQuestion[]
}

export interface JobTypeKpi {
  id: string
  job_type_id: string
  name: string
  label: string
  kpi_type: string
  aggregation: 'sum' | 'avg'
  sort_order: number
  created_at: string
}

export interface JobTypeQuestion {
  id: string
  job_type_id: string
  question_text: string
  question_type: 'multiple_choice' | 'free_text'
  is_required: boolean
  sort_order: number
  created_at: string
  job_type_question_options?: JobTypeQuestionOption[]
}

export interface JobTypeQuestionOption {
  id: string
  question_id: string
  label: string
  sort_order: number
}

export interface CheckoutResponse {
  id: string
  job_id: string
  ba_id: string
  location_check_in_id?: string | null
  created_at: string
  checkout_response_values?: CheckoutResponseValue[]
}

export interface CheckoutResponseValue {
  id: string
  checkout_response_id: string
  kpi_id?: string | null
  question_id?: string | null
  numeric_value?: number | null
  text_value?: string | null
  option_id?: string | null
}

// Multi-day, multi-location types
export interface JobDay {
  id: string
  job_id: string
  date: string
  sort_order: number
  created_at: string
  // Nested locations (populated when fetched with nested query)
  job_day_locations?: JobDayLocation[]
}

export interface JobDayLocation {
  id: string
  job_day_id: string
  job_id: string
  location: string
  latitude?: number | null
  longitude?: number | null
  start_time: string
  end_time: string
  sort_order: number
  created_at: string
}

export interface LocationCheckIn {
  id: string
  job_day_location_id: string
  ba_id: string
  check_in_time: string
  check_in_latitude: number
  check_in_longitude: number
  check_in_gps_override: boolean
  check_in_gps_override_explanation?: string | null
  check_out_time?: string | null
  check_out_latitude?: number | null
  check_out_longitude?: number | null
  is_end_of_day: boolean
  skipped: boolean
  skipped_reason?: string | null
}

export interface TravelLog {
  id: string
  ba_id: string
  from_location_check_in_id: string
  to_location_check_in_id?: string | null
  departure_time: string
  arrival_time?: string | null
}

// Job Application types
export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn'

export interface JobApplication {
  id: string
  job_id: string
  ba_id: string
  status: ApplicationStatus
  applied_at: string
  reviewed_at?: string
  reviewed_by?: string
  notes?: string
}

// Job with nested days/locations (for display helpers)
export type JobWithDays = {
  id: string
  title: string
  brand: string
  pay_rate: number
  slots: number
  slots_filled: number
  status: string
  timezone: string
  job_days: (JobDay & { job_day_locations: JobDayLocation[] })[]
}

// Job Photo types
export interface JobPhoto {
  id: string
  job_id: string
  ba_id: string
  url: string
  caption?: string
  photo_type: string
  job_day_location_id?: string | null
  created_at: string
}
