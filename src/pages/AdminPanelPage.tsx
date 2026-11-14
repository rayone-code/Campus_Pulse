import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Ban,
  Check,
  Clock,
  KeyRound,
  Megaphone,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  adminApi,
  announcementsApi,
  eventsApi,
  referenceApi,
} from "../api/services";
import { getApiErrorMessage } from "../api/client";
import {
  formatEventDate,
  formatEventProgramme,
  formatEventType,
  formatProgrammeLabel,
  formatTimestamp,
  ROLE_TEXT_CLASS,
  STATUS_TEXT_CLASS,
} from "../utils/formatters";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import type {
  Announcement,
  CampusEvent,
  Department,
  EventCategory,
  EventStatus,
  User,
  UserRole,
} from "../types";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import EmptyState from "../components/EmptyState";
import EventFormModal from "../components/EventFormModal";
import SetAccessCodeModal from "../components/SetAccessCodeModal";
import AnnouncementsModal from "../components/AnnouncementsModal";
import ConfirmDialog from "../components/ConfirmDialog";

type AdminTab = "users" | "events" | "announcements" | "departments" | "categories";

export default function AdminPanelPage() {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<AdminTab>("users");

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<number | null>(null);

  // Events state
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [eventSearch, setEventSearch] = useState("");
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CampusEvent | null>(null);
  const [accessCodeEvent, setAccessCodeEvent] = useState<CampusEvent | null>(null);
  const [announcementsEvent, setAnnouncementsEvent] = useState<CampusEvent | null>(null);
  const [statusTarget, setStatusTarget] = useState<{
    event: CampusEvent;
    nextStatus: Extract<EventStatus, "Postponed" | "Cancelled">;
  } | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Announcements state
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annLoading, setAnnLoading] = useState(false);
  const [annError, setAnnError] = useState<string | null>(null);
  const [deleteAnnTarget, setDeleteAnnTarget] = useState<Announcement | null>(null);
  const [deletingAnn, setDeletingAnn] = useState(false);

  // Departments & Categories state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptCode, setNewDeptCode] = useState("");
  const [newDeptBranch, setNewDeptBranch] = useState("");
  const [editingDeptId, setEditingDeptId] = useState<number | null>(null);
  const [editingDeptName, setEditingDeptName] = useState("");
  const [editingDeptCode, setEditingDeptCode] = useState("");
  const [editingDeptBranch, setEditingDeptBranch] = useState("");
  const [deleteDeptTarget, setDeleteDeptTarget] = useState<Department | null>(null);

  const [newCatName, setNewCatName] = useState("");
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [deleteCatTarget, setDeleteCatTarget] = useState<EventCategory | null>(null);

  const [refBusy, setRefBusy] = useState(false);

  const loadReferenceData = useCallback(() => {
    Promise.all([referenceApi.getDepartments(), referenceApi.getCategories()])
      .then(([depts, cats]) => {
        setDepartments(depts);
        setCategories(cats);
      })
      .catch(() => {});
  }, []);

  const loadUsers = useCallback(() => {
    setUsersLoading(true);
    setUsersError(null);
    adminApi
      .listUsers({ search: userSearch, role: userRoleFilter })
      .then((list) => setUsers(list))
      .catch((err) => setUsersError(getApiErrorMessage(err, "Failed to load users.")))
      .finally(() => setUsersLoading(false));
  }, [userSearch, userRoleFilter]);

  const loadEvents = useCallback(() => {
    setEventsLoading(true);
    setEventsError(null);
    eventsApi
      .list({ q: eventSearch, limit: 50, sort: "date_desc" })
      .then((res) => setEvents(res.events || []))
      .catch((err) => setEventsError(getApiErrorMessage(err, "Failed to load events.")))
      .finally(() => setEventsLoading(false));
  }, [eventSearch]);

  const loadAnnouncements = useCallback(() => {
    setAnnLoading(true);
    setAnnError(null);
    announcementsApi
      .list()
      .then((list) => setAnnouncements(list))
      .catch((err) =>
        setAnnError(getApiErrorMessage(err, "Failed to load announcements."))
      )
      .finally(() => setAnnLoading(false));
  }, []);

  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  useEffect(() => {
    if (activeTab === "users") loadUsers();
    if (activeTab === "events") loadEvents();
    if (activeTab === "announcements") loadAnnouncements();
  }, [activeTab, loadUsers, loadEvents, loadAnnouncements]);

  const handleRoleChange = async (targetUser: User, nextRole: UserRole) => {
    if (targetUser.role === nextRole) return;
    setUpdatingRoleId(targetUser.user_id);
    try {
      const updated = await adminApi.updateUserRole(targetUser.user_id, nextRole);
      setUsers((prev) =>
        prev.map((u) => (u.user_id === updated.user_id ? updated : u))
      );
      showToast(`Updated ${updated.name} to ${updated.role}.`, "success");
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to update role."), "error");
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleConfirmStatusChange = async () => {
    if (!statusTarget) return;
    setUpdatingStatus(true);
    try {
      await eventsApi.updateStatus(statusTarget.event.event_id, statusTarget.nextStatus);
      showToast(`Event marked as ${statusTarget.nextStatus}.`, "success");
      setStatusTarget(null);
      loadEvents();
    } catch (err) {
      showToast(getApiErrorMessage(err, "Could not update event status."), "error");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeleteAnnouncement = async () => {
    if (!deleteAnnTarget) return;
    setDeletingAnn(true);
    try {
      await announcementsApi.remove(deleteAnnTarget.announcement_id);
      showToast("Announcement deleted.", "info");
      setDeleteAnnTarget(null);
      loadAnnouncements();
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to delete announcement."), "error");
    } finally {
      setDeletingAnn(false);
    }
  };

  const handleCreateDepartment = async (e: FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim() || !newDeptCode.trim() || !newDeptBranch.trim()) return;
    setRefBusy(true);
    try {
      await referenceApi.createDepartment({
        department_name: newDeptName.trim(),
        short_code: newDeptCode.trim(),
        branch_name: newDeptBranch.trim(),
      });
      setNewDeptName("");
      setNewDeptCode("");
      setNewDeptBranch("");
      showToast("Department created.", "success");
      loadReferenceData();
    } catch (err) {
      showToast(getApiErrorMessage(err, "Could not create department."), "error");
    } finally {
      setRefBusy(false);
    }
  };

  const handleSaveDepartmentEdit = async (id: number) => {
    if (!editingDeptName.trim() || !editingDeptCode.trim() || !editingDeptBranch.trim()) return;
    setRefBusy(true);
    try {
      await referenceApi.updateDepartment(id, {
        department_name: editingDeptName.trim(),
        short_code: editingDeptCode.trim(),
        branch_name: editingDeptBranch.trim(),
      });
      setEditingDeptId(null);
      setEditingDeptName("");
      setEditingDeptCode("");
      setEditingDeptBranch("");
      showToast("Department updated.", "success");
      loadReferenceData();
    } catch (err) {
      showToast(getApiErrorMessage(err, "Could not update department."), "error");
    } finally {
      setRefBusy(false);
    }
  };

  const handleDeleteDepartment = async () => {
    if (!deleteDeptTarget) return;
    setRefBusy(true);
    try {
      await referenceApi.deleteDepartment(deleteDeptTarget.department_id);
      setDeleteDeptTarget(null);
      showToast("Department deleted.", "info");
      loadReferenceData();
    } catch (err) {
      showToast(getApiErrorMessage(err, "Could not delete department."), "error");
    } finally {
      setRefBusy(false);
    }
  };

  const handleCreateCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setRefBusy(true);
    try {
      await referenceApi.createCategory(newCatName.trim());
      setNewCatName("");
      showToast("Category created.", "success");
      loadReferenceData();
    } catch (err) {
      showToast(getApiErrorMessage(err, "Could not create category."), "error");
    } finally {
      setRefBusy(false);
    }
  };

  const handleSaveCategoryEdit = async (id: number) => {
    if (!editingCatName.trim()) return;
    setRefBusy(true);
    try {
      await referenceApi.updateCategory(id, editingCatName.trim());
      setEditingCatId(null);
      setEditingCatName("");
      showToast("Category renamed.", "success");
      loadReferenceData();
    } catch (err) {
      showToast(getApiErrorMessage(err, "Could not update category."), "error");
    } finally {
      setRefBusy(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCatTarget) return;
    setRefBusy(true);
    try {
      await referenceApi.deleteCategory(deleteCatTarget.category_id);
      setDeleteCatTarget(null);
      showToast("Category deleted.", "info");
      loadReferenceData();
    } catch (err) {
      showToast(getApiErrorMessage(err, "Could not delete category."), "error");
    } finally {
      setRefBusy(false);
    }
  };

  const tabs: { key: AdminTab; label: string }[] = [
    { key: "users", label: "Users & Roles" },
    { key: "events", label: "All Events" },
    { key: "announcements", label: "Announcements" },
    { key: "departments", label: "Schools" },
    { key: "categories", label: "Categories" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin Panel</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage DAVV roles, oversee published events, and maintain schools and categories.
        </p>
      </div>

      {/* Tab Bar */}
      <div className="mt-6 flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? "border-blue-700 text-blue-700"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Users */}
      {activeTab === "users" && (
        <section className="mt-6 space-y-4">
          <div className="surface-card grid gap-3 p-4 sm:grid-cols-3">
            <div className="relative sm:col-span-2">
              <label htmlFor="admin-user-q" className="sr-only">
                Search users
              </label>
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="admin-user-q"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="input-field pl-9"
              />
            </div>
            <div>
              <label htmlFor="admin-user-role" className="sr-only">
                Filter by role
              </label>
              <select
                id="admin-user-role"
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="input-field"
              >
                <option value="">All Roles</option>
                <option value="Admin">Admin</option>
                <option value="Organizer">Organizer</option>
                <option value="Attendee">Attendee</option>
              </select>
            </div>
          </div>

          {usersLoading && <LoadingSpinner label="Loading users..." />}
          {!usersLoading && usersError && (
            <ErrorMessage message={usersError} onRetry={loadUsers} />
          )}
          {!usersLoading && !usersError && users.length === 0 && (
            <EmptyState
              title="No matching users"
              description="Try adjusting your name, email, or role filter."
            />
          )}
          {!usersLoading && !usersError && users.length > 0 && (
            <div className="surface-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">User</th>
                      <th className="px-4 py-3.5">Current Role</th>
                      <th className="px-4 py-3.5">Joined</th>
                      <th className="px-5 py-3.5 text-right">Change Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {users.map((u) => {
                      const isSelf = u.user_id === currentUser?.user_id;
                      return (
                        <tr key={u.user_id} className="hover:bg-slate-50/70">
                          <td className="px-5 py-4">
                            <div className="font-semibold text-slate-900">
                              {u.name}
                              {isSelf && (
                                <span className="ml-2 font-mono text-xs font-medium text-slate-400">
                                  (You)
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">{u.email}</div>
                          </td>
                          <td className="px-4 py-4 text-xs font-semibold">
                            <span className={ROLE_TEXT_CLASS[u.role]}>{u.role}</span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 font-mono text-xs text-slate-500 tabular-nums">
                            {formatTimestamp(u.created_at)}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <select
                              aria-label={`Role for ${u.name}`}
                              value={u.role}
                              disabled={isSelf || updatingRoleId === u.user_id}
                              onChange={(e) =>
                                handleRoleChange(u, e.target.value as UserRole)
                              }
                              className="inline-block w-36 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              <option value="Attendee">Attendee</option>
                              <option value="Organizer">Organizer</option>
                              <option value="Admin">Admin</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Tab 2: Events */}
      {activeTab === "events" && (
        <section className="mt-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <label htmlFor="admin-ev-q" className="sr-only">
                Search all events
              </label>
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="admin-ev-q"
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                placeholder="Search events..."
                className="input-field pl-9"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingEvent(null);
                setEventFormOpen(true);
              }}
              className="btn-primary"
            >
              <Plus className="h-4 w-4" />
              Create Event
            </button>
          </div>

          {eventsLoading && <LoadingSpinner label="Loading campus events..." />}
          {!eventsLoading && eventsError && (
            <ErrorMessage message={eventsError} onRetry={loadEvents} />
          )}
          {!eventsLoading && !eventsError && events.length === 0 && (
            <EmptyState
              title="No events found"
              description="No events match your search query."
            />
          )}
          {!eventsLoading && !eventsError && events.length > 0 && (
            <div className="surface-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">Event & Organizer</th>
                      <th className="px-4 py-3.5">Date & Time</th>
                      <th className="px-4 py-3.5">Scope</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {events.map((ev) => {
                      const isTerminal =
                        ev.status === "Cancelled" || ev.status === "Completed";
                      return (
                        <tr key={ev.event_id} className="hover:bg-slate-50/70">
                          <td className="px-5 py-4">
                            <Link
                              to={`/events/${ev.event_id}`}
                              className="font-semibold text-slate-900 hover:text-blue-700"
                            >
                              {ev.title}
                            </Link>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {ev.organizer_name || "Unknown Organizer"} · {ev.venue}
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 font-mono text-xs text-slate-600 tabular-nums">
                            <div>{formatEventDate(ev.event_date)}</div>
                            <div className="text-slate-400">
                              {ev.start_time}–{ev.end_time}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-xs text-slate-600">
                            <div className="font-medium text-slate-800">{formatEventType(ev.event_type)}</div>
                            {formatEventProgramme(ev) && (
                              <div className="text-slate-500">{formatEventProgramme(ev)}</div>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-xs font-semibold">
                            <span className={STATUS_TEXT_CLASS[ev.status]}>{ev.status}</span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingEvent(ev);
                                  setEventFormOpen(true);
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </button>

                              {ev.event_type === "Department-specific" && (
                                <button
                                  type="button"
                                  onClick={() => setAccessCodeEvent(ev)}
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  <KeyRound className="h-3.5 w-3.5" />
                                  Access Code
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setAnnouncementsEvent(ev)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <Megaphone className="h-3.5 w-3.5" />
                                Updates
                              </button>

                              {ev.status !== "Postponed" && !isTerminal && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setStatusTarget({ event: ev, nextStatus: "Postponed" })
                                  }
                                  className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                                >
                                  <Clock className="h-3.5 w-3.5" />
                                  Postpone
                                </button>
                              )}

                              {!isTerminal && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setStatusTarget({ event: ev, nextStatus: "Cancelled" })
                                  }
                                  className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                  Cancel
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Tab 3: Announcements */}
      {activeTab === "announcements" && (
        <section className="mt-6 space-y-4">
          {annLoading && <LoadingSpinner label="Loading announcements..." />}
          {!annLoading && annError && (
            <ErrorMessage message={annError} onRetry={loadAnnouncements} />
          )}
          {!annLoading && !annError && announcements.length === 0 && (
            <EmptyState
              title="No announcements"
              description="No event updates have been posted yet."
            />
          )}
          {!annLoading && !annError && announcements.length > 0 && (
            <div className="space-y-3">
              {announcements.map((ann) => (
                <div
                  key={ann.announcement_id}
                  className="surface-card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-start"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span className="font-semibold text-slate-800">
                        {ann.event_title || `Event #${ann.event_id}`}
                      </span>
                      {ann.creator_name && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{ann.creator_name}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {formatTimestamp(ann.created_at)}
                      </span>
                    </div>
                    <h3 className="mt-1.5 text-base font-bold text-slate-900">
                      {ann.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">{ann.message}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDeleteAnnTarget(ann)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Tab 4: Departments */}
      {activeTab === "departments" && (
        <section className="mt-6 max-w-2xl space-y-5">
          <form onSubmit={handleCreateDepartment} className="surface-card grid gap-3 p-4 sm:grid-cols-2">
            <div>
              <label htmlFor="new-dept-branch" className="mb-1 block text-xs font-semibold text-slate-700">
                Branch
              </label>
              <input
                id="new-dept-branch"
                value={newDeptBranch}
                onChange={(e) => setNewDeptBranch(e.target.value)}
                placeholder="Computer Science"
                className="input-field"
                maxLength={120}
                required
              />
            </div>
            <div>
              <label htmlFor="new-dept-code" className="mb-1 block text-xs font-semibold text-slate-700">
                School code
              </label>
              <input
                id="new-dept-code"
                value={newDeptCode}
                onChange={(e) => setNewDeptCode(e.target.value)}
                placeholder="IIPS"
                className="input-field"
                maxLength={20}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="new-dept-name" className="mb-1 block text-xs font-semibold text-slate-700">
                Full school name
              </label>
              <input
                id="new-dept-name"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                placeholder="International Institute of Professional Studies"
                className="input-field"
                maxLength={150}
                required
              />
            </div>
            <button type="submit" disabled={refBusy} className="btn-primary sm:col-span-2">
              <Plus className="h-4 w-4" />
              Add school
            </button>
          </form>

          <div className="surface-card divide-y divide-slate-100">
            {departments.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">
                No schools configured yet.
              </p>
            ) : (
              departments.map((dept) => {
                const editing = editingDeptId === dept.department_id;
                return (
                  <div
                    key={dept.department_id}
                    className="flex items-center justify-between gap-3 px-5 py-3.5"
                  >
                    {editing ? (
                      <div className="grid flex-1 gap-2 sm:grid-cols-2">
                        <input
                          value={editingDeptBranch}
                          onChange={(e) => setEditingDeptBranch(e.target.value)}
                          className="input-field"
                          maxLength={120}
                          aria-label="Branch"
                        />
                        <input
                          value={editingDeptCode}
                          onChange={(e) => setEditingDeptCode(e.target.value)}
                          className="input-field"
                          maxLength={20}
                          aria-label="School code"
                        />
                        <input
                          value={editingDeptName}
                          onChange={(e) => setEditingDeptName(e.target.value)}
                          className="input-field sm:col-span-2"
                          maxLength={150}
                          aria-label="Full school name"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={refBusy}
                            onClick={() => handleSaveDepartmentEdit(dept.department_id)}
                            className="rounded-lg bg-blue-700 p-2 text-white hover:bg-blue-800"
                            aria-label="Save school"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDeptId(null);
                              setEditingDeptName("");
                              setEditingDeptCode("");
                              setEditingDeptBranch("");
                            }}
                            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                            aria-label="Cancel editing"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatProgrammeLabel(dept)}
                          </p>
                          <p className="text-xs text-slate-500">{dept.department_name}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDeptId(dept.department_id);
                              setEditingDeptName(dept.department_name);
                              setEditingDeptCode(dept.short_code);
                              setEditingDeptBranch(dept.branch_name);
                            }}
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-700"
                            aria-label={`Edit ${formatProgrammeLabel(dept)}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteDeptTarget(dept)}
                            className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                            aria-label={`Delete ${formatProgrammeLabel(dept)}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* Tab 5: Categories */}
      {activeTab === "categories" && (
        <section className="mt-6 max-w-2xl space-y-5">
          <form onSubmit={handleCreateCategory} className="surface-card flex gap-3 p-4">
            <label htmlFor="new-cat-name" className="sr-only">
              New category name
            </label>
            <input
              id="new-cat-name"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="New category name (e.g., Hackathon)"
              className="input-field flex-1"
              maxLength={100}
              required
            />
            <button type="submit" disabled={refBusy} className="btn-primary">
              <Plus className="h-4 w-4" />
              Add
            </button>
          </form>

          <div className="surface-card divide-y divide-slate-100">
            {categories.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">
                No event categories configured yet.
              </p>
            ) : (
              categories.map((cat) => {
                const editing = editingCatId === cat.category_id;
                return (
                  <div
                    key={cat.category_id}
                    className="flex items-center justify-between gap-3 px-5 py-3.5"
                  >
                    {editing ? (
                      <div className="flex flex-1 items-center gap-2">
                        <input
                          value={editingCatName}
                          onChange={(e) => setEditingCatName(e.target.value)}
                          className="input-field flex-1"
                          maxLength={100}
                        />
                        <button
                          type="button"
                          disabled={refBusy}
                          onClick={() => handleSaveCategoryEdit(cat.category_id)}
                          className="rounded-lg bg-blue-700 p-2 text-white hover:bg-blue-800"
                          aria-label="Save category name"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCatId(null);
                            setEditingCatName("");
                          }}
                          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                          aria-label="Cancel editing"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-semibold text-slate-900">
                          {cat.category_name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCatId(cat.category_id);
                              setEditingCatName(cat.category_name);
                            }}
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-700"
                            aria-label={`Edit ${cat.category_name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteCatTarget(cat)}
                            className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                            aria-label={`Delete ${cat.category_name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* Shared Modals & Confirmation Dialogs */}
      <EventFormModal
        isOpen={eventFormOpen}
        onClose={() => {
          setEventFormOpen(false);
          setEditingEvent(null);
        }}
        eventToEdit={editingEvent}
        departments={departments}
        categories={categories}
        onSaved={() => loadEvents()}
      />

      <SetAccessCodeModal
        isOpen={Boolean(accessCodeEvent)}
        onClose={() => setAccessCodeEvent(null)}
        event={accessCodeEvent}
      />

      <AnnouncementsModal
        isOpen={Boolean(announcementsEvent)}
        onClose={() => setAnnouncementsEvent(null)}
        event={announcementsEvent}
      />

      <ConfirmDialog
        isOpen={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        onConfirm={handleConfirmStatusChange}
        loading={updatingStatus}
        danger={statusTarget?.nextStatus === "Cancelled"}
        title={
          statusTarget?.nextStatus === "Cancelled"
            ? "Cancel Event"
            : "Postpone Event"
        }
        confirmLabel={
          statusTarget?.nextStatus === "Cancelled"
            ? "Yes, Cancel Event"
            : "Yes, Postpone Event"
        }
        message={
          statusTarget?.nextStatus === "Cancelled"
            ? `Cancel "${statusTarget?.event.title}"? Registration links will stop working immediately.`
            : `Mark "${statusTarget?.event.title}" as Postponed?`
        }
      />

      <ConfirmDialog
        isOpen={Boolean(deleteAnnTarget)}
        onClose={() => setDeleteAnnTarget(null)}
        onConfirm={handleDeleteAnnouncement}
        loading={deletingAnn}
        danger
        title="Delete Announcement"
        confirmLabel="Delete"
        message={`Delete announcement "${deleteAnnTarget?.title}"? This cannot be undone.`}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteDeptTarget)}
        onClose={() => setDeleteDeptTarget(null)}
        onConfirm={handleDeleteDepartment}
        loading={refBusy}
        danger
        title="Delete Department"
        confirmLabel="Delete"
        message={`Delete ${deleteDeptTarget ? formatProgrammeLabel(deleteDeptTarget) : "this school"}? Schools still assigned to events cannot be deleted.`}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteCatTarget)}
        onClose={() => setDeleteCatTarget(null)}
        onConfirm={handleDeleteCategory}
        loading={refBusy}
        danger
        title="Delete Category"
        confirmLabel="Delete"
        message={`Delete category "${deleteCatTarget?.category_name}"?`}
      />
    </div>
  );
}
