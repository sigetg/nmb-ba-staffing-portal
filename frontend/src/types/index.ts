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
  stripe_account_id?: string
  created_at: string
  updated_at?: string
}

export interface BAPhoto {
  id: string
  ba_id: string
  photo_type: string
  url: string
  created_at: string
}

// Job types
export type JobStatus = 'draft' | 'published' | 'in_progress' | 'completed' | 'cancelled'

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
}

// Job Photo types
export interface JobPhoto {
  id: string
  job_id: string
  ba_id: string
  url: string
  caption?: string
  created_at: string
}
