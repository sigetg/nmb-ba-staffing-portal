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
export type JobStatus = 'draft' | 'published' | 'cancelled'
export type DisplayJobStatus = 'draft' | 'upcoming' | 'in_progress' | 'completed' | 'cancelled'

export interface Job {
  id: string
  title: string
  brand: string
  description: string
  location: string
  latitude?: number
  longitude?: number
  date: string
  start_time: string
  end_time: string
  pay_rate: number
  slots: number
  slots_filled: number
  status: JobStatus
  timezone: string
  worksheet_url?: string
  created_at: string
  updated_at?: string
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

// Check-in types
export interface KpiSnapshot {
  total_engagements?: number
  qr_codes_scanned?: number
  customers_walked_in?: number
  common_objection?: string
}

export interface Materials {
  condition_acceptable?: boolean
  all_returned?: boolean
  items?: string[]
  other_description?: string
}

export interface ScopeOfWork {
  canvass_neighborhoods?: boolean
  engage_pedestrians?: boolean
  engage_pedestrians_count?: number
  distribute_flyers?: boolean
  distribute_flyers_count?: number
  direct_customers?: boolean
  direct_customers_count?: number
  maintain_appearance?: boolean
}

export interface CheckIn {
  id: string
  job_id: string
  ba_id: string
  check_in_time: string
  check_out_time?: string
  check_in_latitude: number
  check_in_longitude: number
  check_out_latitude?: number
  check_out_longitude?: number
  checkout_notes?: string
  checkout_issues?: string
  checkout_customer_feedback?: string
  checkout_foot_traffic?: string
  kpi_snapshot?: KpiSnapshot
  schedule_deviation?: boolean
  schedule_deviation_explanation?: string
  materials?: Materials
  scope_of_work?: ScopeOfWork
}

// Job Photo types
export interface JobPhoto {
  id: string
  job_id: string
  ba_id: string
  url: string
  caption?: string
  photo_type: string
  created_at: string
}
