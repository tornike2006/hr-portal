export type Role = "admin" | "hr" | "employee";
export type LeaveType = "paid" | "unpaid" | "sick" | "maternity";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
export type EmployeeStatus = "onboarding" | "active" | "inactive";
export type Stage = "applied" | "screening" | "interview" | "offer" | "hired" | "rejected";

export interface Settings {
  company: string;
  company_code: string;
  address: string;
  city: string;
  director: string;
  six_day_week: boolean;
  annual_leave: number;
}

export interface Profile {
  id: string;
  email: string | null;
  role: Role;
  employee_id: string | null;
}

export interface Department {
  id: string;
  name: string;
  parent_id: string | null;
}

export interface Employee {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  department_id: string | null;
  manager_id: string | null;
  birth_date: string | null;
  start_date: string | null;
  end_date: string | null;
  status: EmployeeStatus;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
}

export interface EmployeePrivate {
  employee_id: string;
  personal_id: string | null;
  address: string | null;
  emergency_contact: string | null;
  bank_account: string | null;
  salary: number;
  pension: boolean;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  days: number;
  note: string | null;
  status: LeaveStatus;
  created_at: string;
}

export interface Absence {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  author_id: string | null;
  created_at: string;
}

export interface Channel {
  id: string;
  name: string | null;
  kind: "public" | "dm";
  created_by: string | null;
}

export interface ChannelMember {
  channel_id: string;
  user_id: string;
  last_read_at: string;
}

export interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface ReviewCycle {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: "active" | "closed";
}

export interface Review {
  id: string;
  cycle_id: string;
  employee_id: string;
  reviewer_id: string | null;
  self_rating: number | null;
  self_comment: string | null;
  self_submitted_at: string | null;
  manager_rating: number | null;
  manager_comment: string | null;
  manager_submitted_at: string | null;
}

export interface Goal {
  id: string;
  employee_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  progress: number;
  status: "on_track" | "at_risk" | "done";
}

export interface Job {
  id: string;
  title: string;
  department_id: string | null;
  location: string | null;
  employment_type: "full_time" | "part_time" | "contract" | "internship";
  description: string | null;
  status: "open" | "paused" | "closed";
  created_at: string;
}

export interface Candidate {
  id: string;
  job_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  stage: Stage;
  rating: number | null;
  notes: string | null;
  cv_path: string | null;
  created_at: string;
}

export interface OnboardingTask {
  id: string;
  employee_id: string;
  title: string;
  category: string;
  due_date: string | null;
  done: boolean;
  sort: number;
}

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  name: string;
  storage_path: string;
  created_at: string;
}
