import type { EventStatus, UserRole } from "../types";

export const STATUS_TEXT_CLASS: Record<EventStatus, string> = {
  Upcoming: "text-blue-700",
  Ongoing: "text-emerald-700",
  Completed: "text-slate-500",
  Cancelled: "text-rose-700",
  Postponed: "text-amber-700",
};

export const ROLE_TEXT_CLASS: Record<UserRole, string> = {
  Admin: "text-rose-700",
  Organizer: "text-blue-700",
  Attendee: "text-slate-600",
};

export function formatProgrammeLabel(parts: {
  branch_name?: string | null;
  short_code?: string | null;
  department_name?: string | null;
}): string {
  const branch = parts.branch_name?.trim();
  const code = parts.short_code?.trim();
  if (branch && code) return `${branch} (${code})`;
  if (branch) return branch;
  return parts.department_name?.trim() || "";
}

export function formatEventProgramme(event: {
  department_branch?: string | null;
  department_short_code?: string | null;
  department_name?: string | null;
}): string {
  return formatProgrammeLabel({
    branch_name: event.department_branch,
    short_code: event.department_short_code,
    department_name: event.department_name,
  });
}

export function formatEventType(eventType: string): string {
  if (eventType === "College-wide") return "University-wide";
  return eventType;
}

export function formatEventDate(isoDate: string): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTimestamp(ts: string): string {
  if (!ts) return "";
  const parsed = new Date(ts.includes("T") ? ts : `${ts.replace(" ", "T")}Z`);
  if (Number.isNaN(parsed.getTime())) return ts;
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
