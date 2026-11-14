import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { resolvePosterUrl } from "../utils/posterAssets";

export default function EventPoster({
  posterUrl,
  title,
  className = "h-44 w-full",
  fit = "cover",
}: {
  posterUrl: string | null;
  title: string;
  className?: string;
  fit?: "cover" | "contain";
}) {
  const [failed, setFailed] = useState(false);
  const resolved = resolvePosterUrl(posterUrl);

  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  if (!resolved || failed) {
    return (
      <div
        className={`poster-fallback flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 px-6 text-center ${className}`}
      >
        <CalendarDays className="h-7 w-7 text-slate-400" />
        <span className="mt-2 line-clamp-1 text-xs font-medium text-slate-500">
          {title}
        </span>
      </div>
    );
  }

  return (
    <img
      src={resolved}
      alt={`${title} event poster`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${fit === "contain" ? "object-contain" : "object-cover"} ${className}`}
    />
  );
}
