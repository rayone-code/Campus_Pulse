export type UserRole = "Admin" | "Organizer" | "Attendee";

export type EventType = "College-wide" | "Department-specific";

export type EventStatus =
  | "Upcoming"
  | "Ongoing"
  | "Completed"
  | "Cancelled"
  | "Postponed";

export interface User {
  user_id: number;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface Department {
  department_id: number;
  department_name: string;
  short_code: string;
  branch_name: string;
}

export interface EventCategory {
  category_id: number;
  category_name: string;
}

export interface CampusEvent {
  event_id: number;
  title: string;
  description: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue: string;
  event_type: EventType;
  status: EventStatus;
  poster_url: string | null;
  organizer_id: number;
  organizer_name: string | null;
  department_id: number | null;
  department_name: string | null;
  department_branch: string | null;
  department_short_code: string | null;
  category_id: number | null;
  category_name: string | null;
  created_at: string;
}

export interface Announcement {
  announcement_id: number;
  event_id: number;
  title: string;
  message: string;
  created_by: number;
  created_at: string;
  event_title?: string | null;
  creator_name?: string | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}
