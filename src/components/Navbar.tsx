import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../context/ThemeContext";

export default function Navbar() {
  const { user, role, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap shrink-0 border-b-2 py-1 text-sm font-medium transition-colors duration-200 ${
      isActive
        ? "border-[#2457D6] text-[#101D3A]"
        : "border-transparent text-slate-600 hover:border-[#D5AE65] hover:text-[#101D3A]"
    }`;

  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-lg px-3 py-2.5 text-sm font-medium ${
      isActive ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50"
    }`;

  const handleLogout = () => {
    logout("You have been signed out.");
    setMobileOpen(false);
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="shrink-0 whitespace-nowrap leading-tight">
          <span className="block font-display text-xl font-extrabold tracking-tight text-[#101D3A]">
            CampusPulse
          </span>
          <span className="block text-[10px] font-semibold tracking-[0.18em] text-[#D5AE65]">
            DAVV INDORE
          </span>
        </Link>

        {/* Zone 2: Primary Navigation Links */}
        <nav className="hidden items-center gap-6 md:flex" aria-label="Main navigation">
          <NavLink to="/" end className={navLinkClass}>
            Home
          </NavLink>
          {isAuthenticated && (
            <>
              <NavLink to="/events" className={navLinkClass}>
                Events
              </NavLink>
              <NavLink to="/announcements" className={navLinkClass}>
                Announcements
              </NavLink>
            </>
          )}
          {(role === "Organizer" || role === "Admin") && (
            <NavLink to="/organizer" className={navLinkClass}>
              Organizer Studio
            </NavLink>
          )}
          {role === "Admin" && (
            <NavLink to="/admin" className={navLinkClass}>
              Admin Panel
            </NavLink>
          )}
        </nav>

        {/* Zone 3: Account Action */}
        <div className="hidden items-center gap-4 shrink-0 md:flex">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
            aria-label={theme === "dark" ? "Switch to day mode" : "Switch to night mode"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {isAuthenticated && user ? (
            <>
              <span className="max-w-[200px] truncate text-xs text-slate-500">
                {user.name} · <strong className="font-semibold text-slate-700">{role}</strong>
              </span>
              <button type="button" onClick={handleLogout} className="btn-secondary py-1.5">
                Sign out
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-primary py-1.5">
              Sign in
            </Link>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
          <div className="space-y-1">
            <NavLink
              to="/"
              end
              className={mobileLinkClass}
              onClick={() => setMobileOpen(false)}
            >
              Home
            </NavLink>
            {isAuthenticated && (
              <>
                <NavLink
                  to="/events"
                  className={mobileLinkClass}
                  onClick={() => setMobileOpen(false)}
                >
                  Events
                </NavLink>
                <NavLink
                  to="/announcements"
                  className={mobileLinkClass}
                  onClick={() => setMobileOpen(false)}
                >
                  Announcements
                </NavLink>
              </>
            )}
            {(role === "Organizer" || role === "Admin") && (
              <NavLink
                to="/organizer"
                className={mobileLinkClass}
                onClick={() => setMobileOpen(false)}
              >
                Organizer Studio
              </NavLink>
            )}
            {role === "Admin" && (
              <NavLink
                to="/admin"
                className={mobileLinkClass}
                onClick={() => setMobileOpen(false)}
              >
                Admin Panel
              </NavLink>
            )}
          </div>

          <div className="mt-4 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={toggleTheme}
              className="btn-secondary mb-3 w-full"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === "dark" ? "Day mode" : "Night mode"}
            </button>
            {isAuthenticated && user ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {user.name}
                  </p>
                  <p className="text-xs text-slate-500">{role}</p>
                </div>
                <button type="button" onClick={handleLogout} className="btn-secondary">
                  Sign out
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="btn-primary w-full"
                onClick={() => setMobileOpen(false)}
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
