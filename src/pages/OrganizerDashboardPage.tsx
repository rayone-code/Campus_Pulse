import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Ban,
  Clock,
  KeyRound,
  Megaphone,
  Pencil,
  Plus,
} from "lucide-react";
import { eventsApi, referenceApi } from "../api/services";
import { getApiErrorMessage } from "../api/client";
import { formatEventDate, formatEventProgramme, formatEventType, STATUS_TEXT_CLASS } from "../utils/formatters";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import type { CampusEvent, Department, EventCategory, EventStatus } from "../types";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import EmptyState from "../components/EmptyState";
import EventFormModal from "../components/EventFormModal";
import SetAccessCodeModal from "../components/SetAccessCodeModal";
import AnnouncementsModal from "../components/AnnouncementsModal";
import ConfirmDialog from "../components/ConfirmDialog";

interface StatusActionTarget {
  event: CampusEvent;
  nextStatus: Extract<EventStatus, "Postponed" | "Cancelled">;
}

export default function OrganizerDashboardPage() {
  const { role } = useAuth();
  const { showToast } = useToast();
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CampusEvent | null>(null);
  const [accessCodeEvent, setAccessCodeEvent] = useState<CampusEvent | null>(null);
  const [announcementsEvent, setAnnouncementsEvent] = useState<CampusEvent | null>(null);
  const [statusTarget, setStatusTarget] = useState<StatusActionTarget | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      eventsApi.list({
        ...(role === "Admin" ? {} : { mine: "true" }),
        limit: 50,
        sort: "date_desc",
      }),
      referenceApi.getDepartments(),
      referenceApi.getCategories(),
    ])
      .then(([evRes, depts, cats]) => {
        setEvents(evRes.events || []);
        setDepartments(depts);
        setCategories(cats);
      })
      .catch((err) => setError(getApiErrorMessage(err, "Failed to load organizer events.")))
      .finally(() => setLoading(false));
  }, [role]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConfirmStatusChange = async () => {
    if (!statusTarget) return;
    setUpdatingStatus(true);
    try {
      await eventsApi.updateStatus(statusTarget.event.event_id, statusTarget.nextStatus);
      showToast(`Event marked as ${statusTarget.nextStatus}.`, "success");
      setStatusTarget(null);
      loadData();
    } catch (err) {
      showToast(getApiErrorMessage(err, "Could not update event status."), "error");
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Organizer Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {role === "Admin"
              ? "You are viewing every published DAVV event."
              : "Create and manage your event listings, school access codes, and updates."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingEvent(null);
            setFormOpen(true);
          }}
          className="btn-primary"
        >
          <Plus className="h-4 w-4" />
          Create Event
        </button>
      </div>

      <div className="mt-6">
        {loading && <LoadingSpinner label="Loading your events..." />}
        {!loading && error && <ErrorMessage message={error} onRetry={loadData} />}
        {!loading && !error && events.length === 0 && (
          <EmptyState
            title="You have not created any events yet"
            description="Publish a DAVV event and attach its Google Form registration link."
            action={
              <button
                type="button"
                onClick={() => {
                  setEditingEvent(null);
                  setFormOpen(true);
                }}
                className="btn-primary"
              >
                <Plus className="h-4 w-4" />
                Create Event
              </button>
            }
          />
        )}

        {!loading && !error && events.length > 0 && (
          <div className="surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Event</th>
                    <th className="px-4 py-3.5">Schedule</th>
                    <th className="px-4 py-3.5">Access Scope</th>
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
                            {ev.venue}
                            {ev.category_name ? ` · ${ev.category_name}` : ""}
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
                                setFormOpen(true);
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              title="Edit event"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>

                            {ev.event_type === "Department-specific" && (
                              <button
                                type="button"
                                onClick={() => setAccessCodeEvent(ev)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                title="Set write-only department access code"
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                                Access Code
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setAnnouncementsEvent(ev)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              title="Manage event announcements"
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
                                title="Mark event as postponed"
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
                                title="Cancel event"
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
      </div>

      <EventFormModal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingEvent(null);
        }}
        eventToEdit={editingEvent}
        departments={departments}
        categories={categories}
        onSaved={() => loadData()}
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
            ? `Are you sure you want to cancel "${statusTarget?.event.title}"? Registration links will be immediately disabled for all students.`
            : `Mark "${statusTarget?.event.title}" as Postponed? Registration will be paused until you reschedule it.`
        }
      />
    </div>
  );
}
