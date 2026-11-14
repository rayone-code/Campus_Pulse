export default function Footer() {
  return (
    <footer className="bg-[#101D3A] text-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold tracking-[0.22em] text-[#D5AE65]">CAMPUSPULSE</p>
        <h2 className="mt-3 max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
          Campus life, connected.
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
          One platform. Every event. A better campus experience.
        </p>
        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>CampusPulse · DAVV Indore</p>
          <p>Discover · Participate · Experience</p>
        </div>
      </div>
    </footer>
  );
}
