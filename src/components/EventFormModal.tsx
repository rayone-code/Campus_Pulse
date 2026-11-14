import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Modal from "./Modal";
import { eventsApi } from "../api/services";
import { resolvePosterUrl } from "../utils/posterAssets";
import { getApiErrorMessage } from "../api/client";
import { useToast } from "../hooks/useToast";
import { formatProgrammeLabel } from "../utils/formatters";
import type { CampusEvent, Department, EventCategory } from "../types";

const EMPTY_FORM = {
  title: "",
  description: "",
  event_date: "",
  start_time: "09:00",
  end_time: "17:00",
  venue: "",
  event_type: "College-wide",
  status: "Upcoming",
  department_id: "",
  category_id: "",
  registration_url: "",
  poster_url: "",
};

function isValidGoogleFormsUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase();
    return (
      parsed.protocol === "https:" &&
      ((host === "docs.google.com" && parsed.pathname.startsWith("/forms")) ||
        (host === "forms.gle" && parsed.pathname.replace(/\//g, "").length > 0))
    );
  } catch {
    return false;
  }
}

function isValidPosterUrl(url: string): boolean {
  if (url.trim().startsWith("/src/assets/images/") || url.trim().startsWith("/uploads/posters/")) {
    return !url.includes("..");
  }
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:" && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export default function EventFormModal({
  isOpen,
  onClose,
  eventToEdit = null,
  departments,
  categories,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  eventToEdit?: CampusEvent | null;
  departments: Department[];
  categories: EventCategory[];
  onSaved: (saved: CampusEvent) => void;
}) {
  const isEditing = Boolean(eventToEdit);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!isOpen) return;
    setFormError("");
    if (eventToEdit) {
      setForm({
        title: eventToEdit.title || "",
        description: eventToEdit.description || "",
        event_date: eventToEdit.event_date || "",
        start_time: eventToEdit.start_time || "09:00",
        end_time: eventToEdit.end_time || "17:00",
        venue: eventToEdit.venue || "",
        event_type: eventToEdit.event_type || "College-wide",
        status: eventToEdit.status || "Upcoming",
        department_id: eventToEdit.department_id ? String(eventToEdit.department_id) : "",
        category_id: eventToEdit.category_id ? String(eventToEdit.category_id) : "",
        registration_url: "",
        poster_url: eventToEdit.poster_url || "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [isOpen, eventToEdit]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "event_type" && value === "College-wide") {
        next.department_id = "";
      }
      return next;
    });
  };

  const validateClientSide = (): string | null => {
    if (!form.title.trim() || !form.description.trim() || !form.venue.trim()) {
      return "Title, description, and venue are required.";
    }
    if (!form.event_date || !form.start_time || !form.end_time) {
      return "Date, start time, and end time are required.";
    }
    if (form.end_time <= form.start_time) {
      return "End time must be after start time.";
    }
    if (form.event_type === "Department-specific" && !form.department_id) {
      return "Please select a department for Department-specific events.";
    }
    if (!isEditing && !form.registration_url.trim()) {
      return "Google Forms registration URL is required.";
    }
    if (form.registration_url.trim() && !isValidGoogleFormsUrl(form.registration_url)) {
      return "Registration URL must be an https Google Forms URL (docs.google.com/forms or forms.gle).";
    }
    if (form.poster_url.trim() && !isValidPosterUrl(form.poster_url)) {
      return "Poster URL must be a valid https URL.";
    }
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errMsg = validateClientSide();
    if (errMsg) {
      setFormError(errMsg);
      return;
    }

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim(),
      event_date: form.event_date,
      start_time: form.start_time,
      end_time: form.end_time,
      venue: form.venue.trim(),
      event_type: form.event_type,
      status: form.status,
      department_id:
        form.event_type === "Department-specific" ? Number(form.department_id) : null,
      category_id: form.category_id ? Number(form.category_id) : null,
      poster_url: form.poster_url.trim() || null,
    };

    if (form.registration_url.trim()) {
      payload.registration_url = form.registration_url.trim();
    }

    setSaving(true);
    setFormError("");
    try {
      const saved =
        isEditing && eventToEdit
          ? await eventsApi.update(eventToEdit.event_id, payload)
          : await eventsApi.create(payload);
      showToast(
        isEditing ? "Event updated successfully." : "Event published successfully.",
        "success"
      );
      onSaved(saved);
      onClose();
    } catch (err) {
      setFormError(getApiErrorMessage(err, "Failed to save event."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Event" : "Create New Event"}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
          >
            {formError}
          </div>
        )}

        <div>
          <label htmlFor="ev-title" className="mb-1 block text-xs font-semibold text-slate-700">
            Event Title *
          </label>
          <input
            id="ev-title"
            name="title"
            value={form.title}
            onChange={handleChange}
            maxLength={200}
            className="input-field"
            placeholder="e.g., Annual Robotics Hackathon"
            required
          />
        </div>

        <div>
          <label htmlFor="ev-desc" className="mb-1 block text-xs font-semibold text-slate-700">
            Description *
          </label>
          <textarea
            id="ev-desc"
            name="description"
            rows={3}
            value={form.description}
            onChange={handleChange}
            className="input-field"
            placeholder="Describe agenda, eligibility, and key details..."
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="ev-date" className="mb-1 block text-xs font-semibold text-slate-700">
              Event Date *
            </label>
            <input
              id="ev-date"
              type="date"
              name="event_date"
              value={form.event_date}
              onChange={handleChange}
              className="input-field font-mono tabular-nums"
              required
            />
          </div>
          <div>
            <label htmlFor="ev-start" className="mb-1 block text-xs font-semibold text-slate-700">
              Start Time *
            </label>
            <input
              id="ev-start"
              type="time"
              name="start_time"
              value={form.start_time}
              onChange={handleChange}
              className="input-field font-mono tabular-nums"
              required
            />
          </div>
          <div>
            <label htmlFor="ev-end" className="mb-1 block text-xs font-semibold text-slate-700">
              End Time *
            </label>
            <input
              id="ev-end"
              type="time"
              name="end_time"
              value={form.end_time}
              onChange={handleChange}
              className="input-field font-mono tabular-nums"
              required
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ev-venue" className="mb-1 block text-xs font-semibold text-slate-700">
              Venue *
            </label>
            <input
              id="ev-venue"
              name="venue"
              value={form.venue}
              onChange={handleChange}
              maxLength={200}
              className="input-field"
              placeholder="Takshashila Campus Auditorium"
              required
            />
          </div>
          <div>
            <label htmlFor="ev-cat" className="mb-1 block text-xs font-semibold text-slate-700">
              Category
            </label>
            <select
              id="ev-cat"
              name="category_id"
              value={form.category_id}
              onChange={handleChange}
              className="input-field"
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.category_id} value={c.category_id}>
                  {c.category_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ev-type" className="mb-1 block text-xs font-semibold text-slate-700">
              Event Type *
            </label>
            <select
              id="ev-type"
              name="event_type"
              value={form.event_type}
              onChange={handleChange}
              className="input-field"
            >
              <option value="College-wide">University-wide</option>
              <option value="Department-specific">Department-specific</option>
            </select>
          </div>

          <div>
            <label htmlFor="ev-dept" className="mb-1 block text-xs font-semibold text-slate-700">
              Department {form.event_type === "Department-specific" ? "*" : "(N/A)"}
            </label>
            <select
              id="ev-dept"
              name="department_id"
              value={form.department_id}
              onChange={handleChange}
              disabled={form.event_type !== "Department-specific"}
              className="input-field"
            >
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d.department_id} value={d.department_id}>
                  {formatProgrammeLabel(d)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isEditing && (
          <div>
            <label htmlFor="ev-status" className="mb-1 block text-xs font-semibold text-slate-700">
              Status
            </label>
            <select
              id="ev-status"
              name="status"
              value={form.status}
              onChange={handleChange}
              className="input-field"
            >
              {["Upcoming", "Ongoing", "Completed", "Cancelled", "Postponed"].map(
                (st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                )
              )}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="ev-reg-url" className="mb-1 block text-xs font-semibold text-slate-700">
            Google Forms Registration URL{" "}
            {isEditing ? "(leave blank to keep existing)" : "*"}
          </label>
          <input
            id="ev-reg-url"
            type="url"
            name="registration_url"
            value={form.registration_url}
            onChange={handleChange}
            className="input-field"
            placeholder="https://docs.google.com/forms/d/e/.../viewform or https://forms.gle/..."
            required={!isEditing}
          />
        </div>

        <div>
          <label htmlFor="ev-poster-file" className="mb-1 block text-xs font-semibold text-slate-700">
            Poster image
          </label>
          <input
            id="ev-poster-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="input-field"
            disabled={uploadingPoster}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const reader = new FileReader();
              reader.onload = async () => {
                setUploadingPoster(true);
                setFormError("");
                try {
                  const posterUrl = await eventsApi.uploadPoster(String(reader.result));
                  setForm((prev) => ({ ...prev, poster_url: posterUrl }));
                  showToast("Poster saved on the server.", "success");
                } catch (err) {
                  setFormError(getApiErrorMessage(err, "Could not upload the poster."));
                } finally {
                  setUploadingPoster(false);
                }
              };
              reader.readAsDataURL(file);
            }}
          />
          <p className="mt-1 text-[11px] text-slate-500">
            {uploadingPoster
              ? "Uploading poster..."
              : "Upload a JPG, PNG, or WebP. It is stored with the app, so the card keeps it."}
          </p>
          {form.poster_url && resolvePosterUrl(form.poster_url) && (
            <img
              src={resolvePosterUrl(form.poster_url) || ""}
              alt="Poster preview"
              className="mt-3 max-h-48 w-full rounded-lg object-contain"
            />
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving..." : isEditing ? "Save Changes" : "Publish Event"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
