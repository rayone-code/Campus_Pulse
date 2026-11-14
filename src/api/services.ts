import apiClient from "./client";
import type {
  Announcement,
  CampusEvent,
  Department,
  EventCategory,
  EventStatus,
  Pagination,
  User,
  UserRole,
} from "../types";

export const authApi = {
  getConfig() {
    return apiClient
      .get<{
        googleClientId: string | null;
        googleConfigured: boolean;
        demoModeEnabled: boolean;
        allowedDomain: string | null;
        seededStudents: Array<{ name: string; shortCode: string; enrollmentNo: string }>;
        seededStaff: Array<{ role: "Organizer" | "Admin"; loginId: string; password: string }>;
      }>("/auth/config")
      .then((r) => r.data);
  },

  loginWithGoogle(idToken: string) {
    return apiClient
      .post<{ access_token: string; user: User }>("/auth/google", {
        id_token: idToken,
      })
      .then((r) => r.data);
  },

  loginWithDemo(email: string, name?: string) {
    return apiClient
      .post<{ access_token: string; user: User }>("/auth/demo", { email, name })
      .then((r) => r.data);
  },

  loginWithSeeded(payload: {
    role: "Attendee" | "Organizer" | "Admin";
    name?: string;
    department_id?: number;
    enrollment_no?: string;
    login_id?: string;
    password?: string;
  }) {
    return apiClient
      .post<{ access_token: string; user: User }>("/auth/seeded", payload)
      .then((r) => r.data);
  },

  getMe() {
    return apiClient.get<{ user: User }>("/users/me").then((r) => r.data.user);
  },
};

export const eventsApi = {
  getPreview() {
    return apiClient
      .get<{ events: CampusEvent[] }>("/events/preview")
      .then((r) => r.data.events);
  },

  list(params: Record<string, string | number | undefined | null> = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== "" && v !== null && v !== undefined)
    );
    return apiClient
      .get<{ events: CampusEvent[]; pagination: Pagination }>("/events", {
        params: cleanParams,
      })
      .then((r) => r.data);
  },

  getById(eventId: string | number) {
    return apiClient
      .get<{ event: CampusEvent; announcements: Announcement[] }>(`/events/${eventId}`)
      .then((r) => r.data);
  },

  create(payload: Record<string, unknown>) {
    return apiClient
      .post<{ event: CampusEvent }>("/events", payload)
      .then((r) => r.data.event);
  },

  update(eventId: number, payload: Record<string, unknown>) {
    return apiClient
      .put<{ event: CampusEvent }>(`/events/${eventId}`, payload)
      .then((r) => r.data.event);
  },

  uploadPoster(dataUrl: string) {
    return apiClient
      .post<{ poster_url: string }>("/posters", { image: dataUrl })
      .then((r) => r.data.poster_url);
  },

  updateStatus(eventId: number, status: EventStatus) {
    return apiClient
      .patch<{ event: CampusEvent }>(`/events/${eventId}/status`, { status })
      .then((r) => r.data.event);
  },

  setAccessCode(eventId: number, payload: { department_id: number; access_code: string }) {
    return apiClient
      .post<{ message: string }>(`/events/${eventId}/access`, payload)
      .then((r) => r.data);
  },

  verifyAccess(
    eventId: string | number,
    payload: { department_id: number; access_code: string }
  ) {
    return apiClient
      .post<{ access_token: string; expires_in: number }>(
        `/events/${eventId}/verify-access`,
        payload
      )
      .then((r) => r.data);
  },

  getRegistrationLink(eventId: string | number, eventAccessToken?: string | null) {
    const headers = eventAccessToken
      ? { "X-Event-Access-Token": eventAccessToken }
      : {};
    return apiClient
      .get<{ event_id: number; registration_url: string }>(
        `/events/${eventId}/registration-link`,
        { headers }
      )
      .then((r) => r.data);
  },
};

export const announcementsApi = {
  list(eventId?: string | number | null) {
    const params = eventId ? { event_id: eventId } : {};
    return apiClient
      .get<{ announcements: Announcement[] }>("/announcements", { params })
      .then((r) => r.data.announcements);
  },

  create(payload: { event_id: number; title: string; message: string }) {
    return apiClient
      .post<{ announcement: Announcement }>("/announcements", payload)
      .then((r) => r.data.announcement);
  },

  update(announcementId: number, payload: { title: string; message: string }) {
    return apiClient
      .put<{ announcement: Announcement }>(
        `/announcements/${announcementId}`,
        payload
      )
      .then((r) => r.data.announcement);
  },

  remove(announcementId: number) {
    return apiClient
      .delete<{ message: string }>(`/announcements/${announcementId}`)
      .then((r) => r.data);
  },
};

export const referenceApi = {
  getDepartments() {
    return apiClient
      .get<{ departments: Department[] }>("/departments")
      .then((r) => r.data.departments);
  },
  createDepartment(payload: {
    department_name: string;
    short_code: string;
    branch_name: string;
  }) {
    return apiClient
      .post<{ department: Department }>("/departments", payload)
      .then((r) => r.data.department);
  },
  updateDepartment(
    id: number,
    payload: { department_name: string; short_code: string; branch_name: string }
  ) {
    return apiClient
      .put<{ department: Department }>(`/departments/${id}`, payload)
      .then((r) => r.data.department);
  },
  deleteDepartment(id: number) {
    return apiClient.delete(`/departments/${id}`).then((r) => r.data);
  },

  getCategories() {
    return apiClient
      .get<{ categories: EventCategory[] }>("/categories")
      .then((r) => r.data.categories);
  },
  createCategory(category_name: string) {
    return apiClient
      .post<{ category: EventCategory }>("/categories", { category_name })
      .then((r) => r.data.category);
  },
  updateCategory(id: number, category_name: string) {
    return apiClient
      .put<{ category: EventCategory }>(`/categories/${id}`, { category_name })
      .then((r) => r.data.category);
  },
  deleteCategory(id: number) {
    return apiClient.delete(`/categories/${id}`).then((r) => r.data);
  },
};

export const adminApi = {
  listUsers(params: Record<string, string | undefined> = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== "" && v !== undefined)
    );
    return apiClient
      .get<{ users: User[] }>("/admin/users", { params: cleanParams })
      .then((r) => r.data.users);
  },

  updateUserRole(userId: number, role: UserRole) {
    return apiClient
      .patch<{ user: User }>(`/admin/users/${userId}/role`, { role })
      .then((r) => r.data.user);
  },
};
