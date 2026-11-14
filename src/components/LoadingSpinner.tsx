export default function LoadingSpinner({
  label = "Loading...",
  fullScreen = false,
}: {
  label?: string;
  fullScreen?: boolean;
}) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-3 py-10">
      <div
        className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-blue-700"
        role="status"
        aria-label={label}
      />
      <p className="text-sm font-medium text-slate-600">{label}</p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-50">
        {content}
      </div>
    );
  }
  return content;
}
