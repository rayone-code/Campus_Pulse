import { useEffect, useState, type FormEvent } from "react";
import Modal from "./Modal";
import { eventsApi } from "../api/services";
import { getApiErrorMessage } from "../api/client";
import { formatEventProgramme } from "../utils/formatters";
import { useToast } from "../hooks/useToast";
import type { CampusEvent } from "../types";

export default function SetAccessCodeModal({
  isOpen,
  onClose,
  event,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  event: CampusEvent | null;
  onSaved?: () => void;
}) {
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!isOpen || !event) return;
    setAccessCode("");
    setError("");
  }, [isOpen, event]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!event) return;
    if (!event.department_id) {
      setError("This event has no school assigned.");
      return;
    }
    if (accessCode.trim().length < 4) {
      setError("Enter an access code of at least 4 characters.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await eventsApi.setAccessCode(event.event_id, {
        department_id: event.department_id,
        access_code: accessCode.trim(),
      });
      showToast("Access code saved. Write-only: it cannot be viewed again.", "success");
      setAccessCode("");
      onSaved?.();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not save access code."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Set Access Code · ${event?.title || ""}`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs leading-relaxed text-slate-600">
          The code is stored as a hash and cannot be viewed again. It applies only to{" "}
          {event ? formatEventProgramme(event) : "this event's school"}.
        </p>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
          >
            {error}
          </div>
        )}

        <div>
          <p className="mb-1 text-xs font-semibold text-slate-700">School</p>
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-800">
            {event ? formatEventProgramme(event) : "—"}
          </p>
        </div>

        <div>
          <label htmlFor="acc-code" className="mb-1 block text-xs font-semibold text-slate-700">
            New Access Code *
          </label>
          <input
            id="acc-code"
            type="password"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            className="input-field"
            placeholder="Minimum 4 characters"
            minLength={4}
            required
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Save Access Code"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
