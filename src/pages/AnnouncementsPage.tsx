import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Megaphone } from "lucide-react";
import { announcementsApi, eventsApi } from "../api/services";
import { getApiErrorMessage } from "../api/client";
import { formatTimestamp } from "../utils/formatters";
import type { Announcement, CampusEvent } from "../types";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import EmptyState from "../components/EmptyState";

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    eventsApi
      .list({ limit: 50, sort: "date_desc" })
      .then((res) => setEvents(res.events || []))
      .catch(() => {});
  }, []);

  const fetchAnnouncements = useCallback(() => {
    setLoading(true);
    setError(null);
    announcementsApi
      .list(selectedEventId || undefined)
      .then((list) => setAnnouncements(list))
      .catch((err) => setError(getApiErrorMessage(err, "Failed to load announcements.")))
      .finally(() => setLoading(false));
  }, [selectedEventId]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Campus Announcements
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Official schedule updates, room changes, and organizer notices.
          </p>
        </div>

        <div className="w-full sm:w-64">
          <label
            htmlFor="ann-event-filter"
            className="mb-1 block text-xs font-semibold text-slate-700"
          >
            Filter by Event
          </label>
          <select
            id="ann-event-filter"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="input-field"
          >
            <option value="">All Events</option>
            {events.map((ev) => (
              <option key={ev.event_id} value={ev.event_id}>
                {ev.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {loading && <LoadingSpinner label="Loading announcements..." />}
        {!loading && error && (
          <ErrorMessage message={error} onRetry={fetchAnnouncements} />
        )}
        {!loading && !error && announcements.length === 0 && (
          <EmptyState
            title="No announcements found"
            description={
              selectedEventId
                ? "There are no announcements posted for the selected event."
                : "No campus event announcements have been posted yet."
            }
            action={
              selectedEventId ? (
                <button
                  type="button"
                  onClick={() => setSelectedEventId("")}
                  className="btn-secondary"
                >
                  Show all announcements
                </button>
              ) : undefined
            }
          />
        )}

        {!loading &&
          !error &&
          announcements.map((ann) => (
            <article key={ann.announcement_id} className="surface-card p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <div className="flex flex-wrap items-center gap-1.5 font-medium">
                  <Megaphone className="h-3.5 w-3.5 text-blue-700" />
                  <span className="font-semibold text-slate-800">
                    {ann.event_title || `Event #${ann.event_id}`}
                  </span>
                  {ann.creator_name && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{ann.creator_name}</span>
                    </>
                  )}
                </div>
                <time className="font-mono tabular-nums text-slate-400">
                  {formatTimestamp(ann.created_at)}
                </time>
              </div>

              <h2 className="mt-2.5 text-lg font-bold text-slate-900">{ann.title}</h2>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                {ann.message}
              </p>

              <div className="mt-4 border-t border-slate-100 pt-3">
                <Link
                  to={`/events/${ann.event_id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800"
                >
                  View Event Details
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </article>
          ))}
      </div>
    </div>
  );
}
