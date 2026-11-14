import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  Copy,
  ExternalLink,
  Lock,
  MapPin,
  Megaphone,
  User as UserIcon,
} from "lucide-react";
import { eventsApi } from "../api/services";
import { getApiErrorMessage } from "../api/client";
import {
  formatEventDate,
  formatEventProgramme,
  formatEventType,
  formatTimestamp,
  STATUS_TEXT_CLASS,
} from "../utils/formatters";
import { useToast } from "../hooks/useToast";
import type { Announcement, CampusEvent } from "../types";
import EventPoster from "../components/EventPoster";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";

export default function EventDetailPage() {
  const { eventId } = useParams();
  const { showToast } = useToast();

  const [event, setEvent] = useState<CampusEvent | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [registrationUrl, setRegistrationUrl] = useState<string | null>(null);
  const [fetchingLink, setFetchingLink] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadDetail = useCallback(() => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    eventsApi
      .getById(eventId)
      .then((detail) => {
        setEvent(detail.event);
        setAnnouncements(detail.announcements || []);
      })
      .catch((err) => setError(getApiErrorMessage(err, "Unable to load event details.")))
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    setRegistrationUrl(null);
    loadDetail();
  }, [loadDetail]);

  const handleCollegeWideRegister = async () => {
    if (!event) return;
    setFetchingLink(true);
    try {
      const res = await eventsApi.getRegistrationLink(event.event_id);
      setRegistrationUrl(res.registration_url);
      showToast("Registration link unlocked. Click Open Google Form to continue.", "success");
    } catch (err) {
      showToast(getApiErrorMessage(err, "Could not fetch registration link."), "error");
    } finally {
      setFetchingLink(false);
    }
  };

  const handleCopyLink = () => {
    if (!registrationUrl) return;
    navigator.clipboard?.writeText(registrationUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <LoadingSpinner fullScreen label="Loading event details..." />;
  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <ErrorMessage message={error} onRetry={loadDetail} />
      </div>
    );
  }
  if (!event) return null;

  const isBlockedStatus =
    event.status === "Cancelled" ||
    event.status === "Postponed" ||
    event.status === "Completed";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        to="/events"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Events
      </Link>

      <article className="surface-card mt-4 overflow-hidden">
        <EventPoster
          posterUrl={event.poster_url}
          title={event.title}
          fit="contain"
          className="max-h-[720px] min-h-64 w-full bg-slate-100"
        />

        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <span className={`font-semibold ${STATUS_TEXT_CLASS[event.status]}`}>
              {event.status}
            </span>
            <span aria-hidden="true">·</span>
            <span>{formatEventType(event.event_type)}</span>
            {event.category_name && (
              <>
                <span aria-hidden="true">·</span>
                <span>{event.category_name}</span>
              </>
            )}
          </div>

          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {event.title}
          </h1>

          <div className="mt-5 grid gap-3 border-y border-slate-100 py-4 text-sm text-slate-700 sm:grid-cols-2">
            <div className="flex items-center gap-2.5 font-mono tabular-nums">
              <Calendar className="h-4 w-4 text-blue-700" />
              <span>
                {formatEventDate(event.event_date)} ({event.start_time}–{event.end_time})
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <MapPin className="h-4 w-4 text-blue-700" />
              <span>{event.venue}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <UserIcon className="h-4 w-4 text-blue-700" />
              <span>Organizer: {event.organizer_name || "Campus Organizer"}</span>
            </div>
            {event.department_name && (
              <div className="flex items-center gap-2.5">
                <Building2 className="h-4 w-4 text-blue-700" />
                <span>School: {formatEventProgramme(event)}</span>
              </div>
            )}
          </div>

          <div className="mt-6">
            <h2 className="text-xs font-bold tracking-wide text-slate-500">
              Event Description
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700 sm:text-base">
              {event.description}
            </p>
          </div>

          {/* Registration Area */}
          <div className="mt-8 border-t border-slate-200 pt-6">
            <h2 className="text-base font-bold text-slate-900">Registration</h2>

            {isBlockedStatus ? (
              <div
                role="status"
                className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900"
              >
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <span>
                  {event.status === "Cancelled" &&
                    "This event has been cancelled. Registration is closed."}
                  {event.status === "Postponed" &&
                    "This event is currently postponed. Registration is paused until a new date is announced."}
                  {event.status === "Completed" &&
                    "This event has already ended. Registration is closed."}
                </span>
              </div>
            ) : registrationUrl ? (
              <div className="mt-3 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-emerald-900">
                    Official Google Form ready
                  </p>
                  <p className="mt-0.5 text-xs text-emerald-800">
                    Your registration response will be saved in Google Forms.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="btn-secondary py-2"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy link"}
                  </button>
                  <a
                    href={registrationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary py-2"
                  >
                    Open Google Form
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            ) : event.event_type === "College-wide" ? (
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600">
                  Open to all logged-in students via external Google Forms.
                </p>
                <button
                  type="button"
                  disabled={fetchingLink}
                  onClick={handleCollegeWideRegister}
                  className="btn-primary"
                >
                  {fetchingLink ? "Checking eligibility..." : "Register"}
                  <ExternalLink className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600">
                  This is a <strong>Department-specific</strong> event. Verify your
                  department access code to unlock the Google Form.
                </p>
                <Link
                  to={`/events/${event.event_id}/verify-access`}
                  className="btn-primary"
                >
                  <Lock className="h-4 w-4" />
                  Enter access code
                </Link>
              </div>
            )}
          </div>
        </div>
      </article>

      {/* Related Announcements */}
      <section className="surface-card mt-6 p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-blue-700" />
          <h2 className="text-lg font-bold text-slate-900">Event Announcements</h2>
        </div>

        {announcements.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No announcements have been posted for this event yet.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {announcements.map((ann) => (
              <div key={ann.announcement_id} className="py-4 first:pt-0 last:pb-0">
                <h3 className="text-sm font-bold text-slate-900">{ann.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{ann.message}</p>
                <p className="mt-2 font-mono text-xs text-slate-400">
                  {formatTimestamp(ann.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
