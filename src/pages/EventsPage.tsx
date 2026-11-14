import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Calendar, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { eventsApi, referenceApi } from "../api/services";
import { getApiErrorMessage } from "../api/client";
import {
  formatEventDate,
  formatEventProgramme,
  formatEventType,
  formatProgrammeLabel,
  STATUS_TEXT_CLASS,
} from "../utils/formatters";
import type { CampusEvent, Department, EventCategory, Pagination } from "../types";
import EventPoster from "../components/EventPoster";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import EmptyState from "../components/EmptyState";

const INITIAL_FILTERS = {
  q: "",
  event_type: "",
  status: "",
  category_id: "",
  department_id: "",
  date_from: "",
  date_to: "",
  sort: "date_asc",
};

export default function EventsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    ...INITIAL_FILTERS,
    department_id: searchParams.get("department_id") || "",
  });
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);

  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 9,
    total: 0,
    pages: 1,
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([referenceApi.getDepartments(), referenceApi.getCategories()])
      .then(([depts, cats]) => {
        setDepartments(depts);
        setCategories(cats);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const departmentId = searchParams.get("department_id") || "";
    setFilters((prev) =>
      prev.department_id === departmentId ? prev : { ...prev, department_id: departmentId }
    );
    if (departmentId) setPage(1);
  }, [searchParams]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedQ(filters.q);
      setPage(1);
    }, 250);
    return () => window.clearTimeout(id);
  }, [filters.q]);

  const fetchEvents = useCallback(() => {
    setLoading(true);
    setError(null);
    eventsApi
      .list({
        ...filters,
        q: debouncedQ,
        page,
        limit: 9,
      })
      .then((res) => {
        setEvents(res.events || []);
        setPagination(res.pagination);
      })
      .catch((err) => setError(getApiErrorMessage(err, "Failed to load events.")))
      .finally(() => setLoading(false));
  }, [filters, debouncedQ, page]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const updateFilter = (name: string, value: string) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
    if (name !== "q") setPage(1);
  };

  const clearFilters = () => {
    setFilters(INITIAL_FILTERS);
    setDebouncedQ("");
    setPage(1);
    if (searchParams.get("department_id")) {
      navigate("/events", { replace: true });
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Student Event Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            University-wide events and department events for the five DAVV schools.
          </p>
        </div>
        <p className="font-mono text-xs font-medium text-slate-500 tabular-nums">
          {pagination.total} event{pagination.total === 1 ? "" : "s"} found
        </p>
      </div>

      {/* Search & Filters */}
      <section className="surface-card mt-6 p-4 sm:p-5" aria-label="Event search and filters">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <label htmlFor="filter-q" className="sr-only">
              Search events
            </label>
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              id="filter-q"
              value={filters.q}
              onChange={(e) => updateFilter("q", e.target.value)}
              placeholder="Search event title or description..."
              className="input-field pl-9"
            />
          </div>

          <div>
            <label htmlFor="filter-type" className="sr-only">
              Event type
            </label>
            <select
              id="filter-type"
              value={filters.event_type}
              onChange={(e) => updateFilter("event_type", e.target.value)}
              className="input-field"
            >
              <option value="">All Event Types</option>
              <option value="College-wide">University-wide</option>
              <option value="Department-specific">Department-specific</option>
            </select>
          </div>

          <div>
            <label htmlFor="filter-status" className="sr-only">
              Event status
            </label>
            <select
              id="filter-status"
              value={filters.status}
              onChange={(e) => updateFilter("status", e.target.value)}
              className="input-field"
            >
              <option value="">All Statuses</option>
              {["Upcoming", "Ongoing", "Completed", "Cancelled", "Postponed"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-cat" className="sr-only">
              Category
            </label>
            <select
              id="filter-cat"
              value={filters.category_id}
              onChange={(e) => updateFilter("category_id", e.target.value)}
              className="input-field"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.category_id} value={c.category_id}>
                  {c.category_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-dept" className="sr-only">
              Department
            </label>
            <select
              id="filter-dept"
              value={filters.department_id}
              onChange={(e) => updateFilter("department_id", e.target.value)}
              className="input-field"
            >
              <option value="">All Schools</option>
              {departments.map((d) => (
                <option key={d.department_id} value={d.department_id}>
                  {formatProgrammeLabel(d)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-from"
              className="mb-1 block text-[11px] font-medium text-slate-500"
            >
              From Date
            </label>
            <input
              id="filter-from"
              type="date"
              value={filters.date_from}
              onChange={(e) => updateFilter("date_from", e.target.value)}
              className="input-field font-mono tabular-nums"
            />
          </div>

          <div>
            <label
              htmlFor="filter-to"
              className="mb-1 block text-[11px] font-medium text-slate-500"
            >
              To Date
            </label>
            <input
              id="filter-to"
              type="date"
              value={filters.date_to}
              onChange={(e) => updateFilter("date_to", e.target.value)}
              className="input-field font-mono tabular-nums"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <label htmlFor="filter-sort">Sort:</label>
            <select
              id="filter-sort"
              value={filters.sort}
              onChange={(e) => updateFilter("sort", e.target.value)}
              className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
            >
              <option value="date_asc">Earliest First</option>
              <option value="date_desc">Latest First</option>
            </select>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-semibold text-blue-700 hover:text-blue-800"
          >
            Reset all filters
          </button>
        </div>
      </section>

      {/* Event Cards */}
      <div className="mt-6">
        {loading && <LoadingSpinner label="Loading events..." />}
        {!loading && error && <ErrorMessage message={error} onRetry={fetchEvents} />}
        {!loading && !error && events.length === 0 && (
          <EmptyState
            title="No matching events"
            description="Try adjusting your search query or clearing your date filters."
            action={
              <button type="button" onClick={clearFilters} className="btn-secondary">
                Reset filters
              </button>
            }
          />
        )}

        {!loading && !error && events.length > 0 && (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((ev) => (
                <article
                  key={ev.event_id}
                  className="surface-card flex flex-col overflow-hidden"
                >
                  <EventPoster posterUrl={ev.poster_url} title={ev.title} />

                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500">
                      <span className={`font-semibold ${STATUS_TEXT_CLASS[ev.status]}`}>
                        {ev.status}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{formatEventType(ev.event_type)}</span>
                      {ev.category_name && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{ev.category_name}</span>
                        </>
                      )}
                    </div>

                    <h2 className="mt-2 text-lg font-bold text-slate-900">{ev.title}</h2>
                    <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-slate-600">
                      {ev.description}
                    </p>

                    <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-600">
                      <div className="flex items-center gap-2 font-mono tabular-nums">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>
                          {formatEventDate(ev.event_date)} · {ev.start_time}–{ev.end_time}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span>{ev.venue}</span>
                      </div>
                      {formatEventProgramme(ev) && <p>{formatEventProgramme(ev)}</p>}
                    </div>

                    <Link to={`/events/${ev.event_id}`} className="btn-primary mt-4 w-full">
                      View Details
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>

            {pagination.pages > 1 && (
              <nav
                aria-label="Event pagination"
                className="mt-8 flex items-center justify-center gap-3"
              >
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="btn-secondary py-1.5"
                >
                  Previous
                </button>
                <span className="font-mono text-sm font-medium text-slate-600 tabular-nums">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  type="button"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="btn-secondary py-1.5"
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
