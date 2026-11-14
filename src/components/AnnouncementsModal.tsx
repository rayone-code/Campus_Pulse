import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Pencil, Trash2 } from "lucide-react";
import Modal from "./Modal";
import { announcementsApi } from "../api/services";
import { getApiErrorMessage } from "../api/client";
import { formatTimestamp } from "../utils/formatters";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import type { Announcement, CampusEvent } from "../types";
import LoadingSpinner from "./LoadingSpinner";

export default function AnnouncementsModal({
  isOpen,
  onClose,
  event,
}: {
  isOpen: boolean;
  onClose: () => void;
  event: CampusEvent | null;
}) {
  const { user, role } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadAnnouncements = useCallback(() => {
    if (!event) return;
    setLoading(true);
    announcementsApi
      .list(event.event_id)
      .then((list) => setItems(list))
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [event]);

  useEffect(() => {
    if (!isOpen || !event) return;
    setEditingId(null);
    setTitle("");
    setMessage("");
    setError("");
    loadAnnouncements();
  }, [isOpen, event, loadAnnouncements]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!event || !title.trim() || !message.trim()) return;
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await announcementsApi.update(editingId, {
          title: title.trim(),
          message: message.trim(),
        });
        showToast("Announcement updated.", "success");
      } else {
        await announcementsApi.create({
          event_id: event.event_id,
          title: title.trim(),
          message: message.trim(),
        });
        showToast("Announcement posted.", "success");
      }
      setEditingId(null);
      setTitle("");
      setMessage("");
      loadAnnouncements();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await announcementsApi.remove(id);
      showToast("Announcement deleted.", "info");
      loadAnnouncements();
    } catch (err) {
      showToast(getApiErrorMessage(err), "error");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Announcements · ${event?.title || ""}`}
      maxWidth="max-w-2xl"
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
      >
        <h3 className="text-sm font-semibold text-slate-800">
          {editingId ? "Edit Announcement" : "Post New Announcement"}
        </h3>
        {error && <p className="text-xs font-medium text-rose-700">{error}</p>}
        <div>
          <label htmlFor="ann-m-title" className="sr-only">
            Announcement title
          </label>
          <input
            id="ann-m-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Announcement title"
            className="input-field"
            maxLength={200}
            required
          />
        </div>
        <div>
          <label htmlFor="ann-m-msg" className="sr-only">
            Announcement message
          </label>
          <textarea
            id="ann-m-msg"
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write an update for attendees..."
            className="input-field"
            required
          />
        </div>
        <div className="flex justify-end gap-2">
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setTitle("");
                setMessage("");
              }}
              className="btn-secondary py-1.5"
            >
              Cancel Edit
            </button>
          )}
          <button type="submit" disabled={saving} className="btn-primary py-1.5">
            {saving ? "Saving..." : editingId ? "Update" : "Post Announcement"}
          </button>
        </div>
      </form>

      <div className="mt-5 space-y-3">
        {loading && <LoadingSpinner label="Loading announcements..." />}
        {!loading && items.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-500">
            No announcements posted for this event yet.
          </p>
        )}
        {items.map((ann) => {
          const canEdit = role === "Admin" || ann.created_by === user?.user_id;
          return (
            <div key={ann.announcement_id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{ann.title}</h4>
                  <p className="mt-1 text-sm text-slate-600">{ann.message}</p>
                  <p className="mt-2 font-mono text-xs text-slate-400">
                    {formatTimestamp(ann.created_at)}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(ann.announcement_id);
                        setTitle(ann.title);
                        setMessage(ann.message);
                      }}
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-700"
                      aria-label="Edit announcement"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(ann.announcement_id)}
                      className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Delete announcement"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
