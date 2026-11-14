import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Calendar, MapPin } from "lucide-react";
import { announcementsApi, eventsApi } from "../api/services";
import { getApiErrorMessage } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import {
  formatEventDate,
  formatEventType,
  STATUS_TEXT_CLASS,
} from "../utils/formatters";
import {
  DAVV_AUDITORIUM_IMAGE,
  DAVV_HERO_IMAGE,
  DAVV_NALANDA_GATE,
  DAVV_SCHOOL_IMAGES,
  resolvePosterUrl,
} from "../utils/posterAssets";
import type { Announcement, CampusEvent } from "../types";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import EmptyState from "../components/EmptyState";

const ACTIVITIES = [
  {
    title: "Technical Events",
    place: "School of Data Science and Forecasting",
    image: DAVV_SCHOOL_IMAGES.SDSF,
    alt: "School of Data Science and Forecasting at DAVV Indore",
  },
  {
    title: "Workshops",
    place: "School of Electronics",
    image: DAVV_SCHOOL_IMAGES.SOEX,
    alt: "School of Electronics at DAVV Indore",
  },
  {
    title: "Cultural Events",
    place: "University Auditorium",
    image: DAVV_AUDITORIUM_IMAGE,
    alt: "DAVV university auditorium",
  },
  {
    title: "Campus Gates",
    place: "Nalanda Campus, Indore",
    image: DAVV_NALANDA_GATE,
    alt: "Nalanda Campus gate, Devi Ahilya Vishwavidyalaya, Indore",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Discover",
    text: "Find events across DAVV, from university programmes to a single school.",
  },
  {
    number: "02",
    title: "Verify",
    text: "Department events stay locked until the school access code is checked.",
  },
  {
    number: "03",
    title: "Participate",
    text: "Open the Google Form, then follow announcements for schedule changes.",
  },
];

function photoForEvent(event: CampusEvent): string {
  const posted = resolvePosterUrl(event.poster_url);
  if (posted && !posted.endsWith(".svg")) return posted;
  const school = event.department_short_code
    ? DAVV_SCHOOL_IMAGES[event.department_short_code]
    : undefined;
  return school || DAVV_AUDITORIUM_IMAGE;
}

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = () => {
    setLoading(true);
    setError(null);
    eventsApi
      .getPreview()
      .then((list) => setEvents(list))
      .catch((err) => setError(getApiErrorMessage(err, "Unable to load events.")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPreview();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setAnnouncements([]);
      return;
    }
    announcementsApi
      .list()
      .then((list) => setAnnouncements(list.slice(0, 3)))
      .catch(() => setAnnouncements([]));
  }, [isAuthenticated]);

  const exploreTo = isAuthenticated ? "/events" : "/login";

  return (
    <div className="bg-[#F5F7FB]">
      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-20 lg:px-8">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-[#D5AE65]">
              DAVV CAMPUS EXPERIENCE
            </p>
            <h1 className="mt-4 max-w-xl text-4xl font-extrabold tracking-tight text-[#101D3A] [text-wrap:balance] sm:text-5xl">
              Your Campus. Your Events. Your Experience.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-600 sm:text-lg">
              Discover workshops, festivals, competitions and everything happening
              across Devi Ahilya Vishwavidyalaya, Indore.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={exploreTo} className="btn-primary px-5 py-2.5">
                Explore Events
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to={exploreTo} className="btn-secondary px-5 py-2.5">
                Get Started
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl shadow-[0_20px_50px_-24px_rgba(16,29,58,0.45)]">
            <img
              src={DAVV_HERO_IMAGE}
              alt="Aerial view of Takshashila Campus, Devi Ahilya Vishwavidyalaya, Indore"
              className="h-72 w-full object-cover sm:h-96 lg:h-[460px]"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-[#101D3A]">
            Discover Campus Activities
          </h2>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Explore different experiences across the university.
          </p>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
          {ACTIVITIES.map((item) => (
            <Link
              key={item.title}
              to={exploreTo}
              className="group overflow-hidden rounded-2xl bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <img
                src={item.image}
                alt={item.alt}
                className="h-36 w-full object-cover transition duration-300 group-hover:scale-[1.03] sm:h-44"
              />
              <div className="p-4">
                <h3 className="text-base font-bold text-[#101D3A]">{item.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.place}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-3xl font-bold tracking-tight text-[#101D3A]">
              Upcoming Events
            </h2>
            <Link
              to={exploreTo}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#2457D6] hover:text-[#1b46b5]"
            >
              View All
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8">
            {loading && <LoadingSpinner label="Loading upcoming events..." />}
            {!loading && error && <ErrorMessage message={error} onRetry={loadPreview} />}
            {!loading && !error && events.length === 0 && (
              <EmptyState
                title="No upcoming events yet"
                description="Approved DAVV events will appear here as soon as organizers publish them."
              />
            )}
            {!loading && !error && events.length > 0 && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {events.map((event) => (
                  <article
                    key={event.event_id}
                    className="flex flex-col overflow-hidden rounded-2xl bg-[#F5F7FB] shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
                  >
                    <img
                      src={photoForEvent(event)}
                      alt={event.title}
                      className="h-48 w-full object-cover"
                    />
                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="text-lg font-bold text-[#101D3A]">{event.title}</h3>
                      <p className="mt-3 flex items-start gap-2 text-sm text-slate-600">
                        <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[#2457D6]" />
                        <span>
                          {formatEventDate(event.event_date)} · {event.start_time}–{event.end_time}
                        </span>
                      </p>
                      <p className="mt-2 flex items-start gap-2 text-sm text-slate-600">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#2457D6]" />
                        <span>{event.venue}</span>
                      </p>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="rounded-full bg-[#D5AE65]/15 px-2.5 py-1 text-xs font-semibold text-[#8A6A24]">
                          {event.category_name || formatEventType(event.event_type)}
                        </span>
                        <span className={`text-xs font-semibold ${STATUS_TEXT_CLASS[event.status]}`}>
                          {event.status}
                        </span>
                      </div>
                      <Link
                        to={isAuthenticated ? `/events/${event.event_id}` : "/login"}
                        className="btn-primary mt-5 w-full"
                      >
                        {isAuthenticated ? "View Details" : "Sign in to View"}
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <h2 className="text-3xl font-bold tracking-tight text-[#101D3A]">
          How CampusPulse Works
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number} className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="font-display text-sm font-bold tracking-[0.16em] text-[#D5AE65]">
                {step.number}
              </p>
              <h3 className="mt-3 text-xl font-bold text-[#101D3A]">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-5 lg:px-8 lg:py-20">
          <div className="lg:col-span-2">
            <h2 className="text-3xl font-bold tracking-tight text-[#101D3A]">
              Latest Campus Announcements
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Stay updated. Important notices, event updates and schedule changes in one place.
            </p>
            <Link to={isAuthenticated ? "/announcements" : "/login"} className="btn-secondary mt-6">
              {isAuthenticated ? "All announcements" : "Sign in to read notices"}
            </Link>
          </div>
          <div className="space-y-3 lg:col-span-3">
            {!isAuthenticated && (
              <div className="rounded-2xl border border-slate-200 bg-[#F5F7FB] p-6 text-sm text-slate-600">
                Notices from organizers appear here after you sign in.
              </div>
            )}
            {isAuthenticated && announcements.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-[#F5F7FB] p-6 text-sm text-slate-600">
                No announcements have been posted yet.
              </div>
            )}
            {announcements.map((item) => (
              <article key={item.announcement_id} className="rounded-2xl border border-slate-200 p-5">
                <p className="text-xs font-semibold tracking-wide text-[#2457D6]">
                  {item.event_title || "Campus notice"}
                </p>
                <h3 className="mt-1 text-base font-bold text-[#101D3A]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.message}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
