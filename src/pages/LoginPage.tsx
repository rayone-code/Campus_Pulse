import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { authApi, referenceApi } from "../api/services";
import { useAuth } from "../hooks/useAuth";
import { formatProgrammeLabel } from "../utils/formatters";
import type { Department, UserRole } from "../types";
import GoogleSignInButton from "../components/GoogleSignInButton";
import LoadingSpinner from "../components/LoadingSpinner";

const PRESET_ACCOUNTS = [
  {
    label: "Sign in as Event Organizer",
    email: "organizer@scsit.davv",
    name: "SCSIT Event Organizer",
    detail: "Create events, set school access codes, post announcements",
  },
  {
    label: "Sign in as DAVV Admin",
    email: "admin@davv.ac.in",
    name: "DAVV Administrator",
    detail: "Manage roles, all events, schools, and categories",
  },
  {
    label: "Sign in as a demo attendee",
    email: "student.cs@iips.davv",
    name: "IIPS CS Student",
    detail: "Quick browse account. The seeded student form is separate.",
  },
];

type LoginMode = "demo" | "seeded";
type SeededRole = Extract<UserRole, "Attendee" | "Organizer" | "Admin">;

interface AuthConfig {
  googleClientId: string | null;
  googleConfigured: boolean;
  demoModeEnabled: boolean;
  allowedDomain: string | null;
  seededStudents: Array<{ name: string; shortCode: string; enrollmentNo: string }>;
  seededStaff: Array<{ role: "Organizer" | "Admin"; loginId: string; password: string }>;
}

const EMPTY_CONFIG: AuthConfig = {
  googleClientId: null,
  googleConfigured: false,
  demoModeEnabled: true,
  allowedDomain: null,
  seededStudents: [
    { name: "Ananya Joshi", shortCode: "SCSIT", enrollmentNo: "2025SCSIT014" },
    { name: "Rohan Patel", shortCode: "SoI", enrollmentNo: "2026SOI008" },
  ],
  seededStaff: [
    { role: "Organizer", loginId: "SCSIT-ORG", password: "Organizer@2026" },
    { role: "Admin", loginId: "DAVV-ADMIN", password: "Admin@2026" },
  ],
};

export default function LoginPage() {
  const { loginWithGoogle, loginWithDemo, loginWithSeeded } = useAuth();
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [mode, setMode] = useState<LoginMode>("seeded");
  const [seededRole, setSeededRole] = useState<SeededRole>("Attendee");
  const [submitting, setSubmitting] = useState(false);
  const [customEmail, setCustomEmail] = useState("");
  const [customName, setCustomName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [enrollmentNo, setEnrollmentNo] = useState("");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ||
    "/events";

  useEffect(() => {
    authApi
      .getConfig()
      .then((loaded) => setConfig({ ...EMPTY_CONFIG, ...loaded }))
      .catch(() => setConfig(EMPTY_CONFIG));
    referenceApi
      .getDepartments()
      .then((list) => setDepartments(list))
      .catch(() => setDepartments([]));
  }, []);

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      setSubmitting(true);
      try {
        await loginWithGoogle(credential);
        navigate(redirectTo, { replace: true });
      } catch {
        // Error toast handled by AuthContext
      } finally {
        setSubmitting(false);
      }
    },
    [loginWithGoogle, navigate, redirectTo]
  );

  const handleDemoLogin = async (email: string, name?: string) => {
    setSubmitting(true);
    try {
      await loginWithDemo(email, name);
      navigate(redirectTo, { replace: true });
    } catch {
      // Error toast handled by AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  const handleCustomSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim()) return;
    await handleDemoLogin(customEmail.trim(), customName.trim() || undefined);
  };

  const handleSeededSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (seededRole === "Attendee") {
        await loginWithSeeded({
          role: "Attendee",
          name: studentName.trim(),
          department_id: Number(departmentId),
          enrollment_no: enrollmentNo.trim(),
        });
      } else {
        await loginWithSeeded({
          role: seededRole,
          login_id: loginId.trim(),
          password,
        });
      }
      navigate(redirectTo, { replace: true });
    } catch {
      // Error toast handled by AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  if (!config) {
    return <LoadingSpinner fullScreen label="Loading sign-in options..." />;
  }

  return (
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center px-4 py-12">
      <div className="surface-card w-full max-w-md p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#101D3A]">Sign in to CampusPulse</h1>
            <p className="text-xs text-slate-500">Devi Ahilya Vishwavidyalaya, Indore</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMode("seeded")}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              mode === "seeded" ? "bg-white text-[#101D3A] shadow-sm" : "text-slate-600"
            }`}
          >
            Seeded login
          </button>
          <button
            type="button"
            onClick={() => setMode("demo")}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              mode === "demo" ? "bg-white text-[#101D3A] shadow-sm" : "text-slate-600"
            }`}
          >
            Demo login
          </button>
        </div>

        {config.allowedDomain && (
          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Sign-in is restricted to <strong>@{config.allowedDomain}</strong> accounts.
          </p>
        )}

        <div className="mt-6">
          {submitting ? (
            <LoadingSpinner label="Verifying credentials..." />
          ) : mode === "demo" ? (
            config.googleConfigured && config.googleClientId ? (
              <div className="space-y-3 text-center">
                <GoogleSignInButton
                  clientId={config.googleClientId}
                  onCredential={handleGoogleCredential}
                />
                <p className="text-xs text-slate-400">
                  Google ID tokens are verified server-side before issuing your session.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold text-slate-700">
                    One-click demo accounts. No password.
                  </p>
                  {PRESET_ACCOUNTS.map((acct) => (
                    <button
                      key={acct.email}
                      type="button"
                      onClick={() => handleDemoLogin(acct.email, acct.name)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-blue-600 hover:bg-blue-50/40"
                    >
                      <div className="text-sm font-semibold text-slate-900">{acct.label}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{acct.detail}</div>
                    </button>
                  ))}
                </div>
                <div className="border-t border-slate-200 pt-5">
                  <p className="text-xs font-semibold text-slate-700">
                    Or sign in with a new campus email (creates Attendee)
                  </p>
                  <form onSubmit={handleCustomSubmit} className="mt-3 space-y-3">
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Full name (optional)"
                      className="input-field"
                      aria-label="Full name"
                    />
                    <input
                      type="email"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      placeholder="name@school.davv"
                      className="input-field"
                      aria-label="Campus email"
                      required
                    />
                    <button type="submit" className="btn-primary w-full">
                      Continue as Attendee
                    </button>
                  </form>
                </div>
              </div>
            )
          ) : (
            <form onSubmit={handleSeededSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {(["Attendee", "Organizer", "Admin"] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSeededRole(role)}
                    className={`rounded-lg border px-2 py-2 text-xs font-semibold ${
                      seededRole === role
                        ? "border-[#2457D6] bg-blue-50 text-[#2457D6]"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>

              {seededRole === "Attendee" ? (
                <>
                  <div>
                    <label htmlFor="seed-name" className="mb-1 block text-xs font-semibold text-slate-700">
                      Name
                    </label>
                    <input
                      id="seed-name"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      className="input-field"
                      placeholder="Student name"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="seed-dept" className="mb-1 block text-xs font-semibold text-slate-700">
                      Department
                    </label>
                    <select
                      id="seed-dept"
                      value={departmentId}
                      onChange={(e) => setDepartmentId(e.target.value)}
                      className="input-field"
                      required
                    >
                      <option value="">Select department</option>
                      {departments.map((department) => (
                        <option key={department.department_id} value={department.department_id}>
                          {formatProgrammeLabel(department)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="seed-enroll" className="mb-1 block text-xs font-semibold text-slate-700">
                      Enrollment number
                    </label>
                    <input
                      id="seed-enroll"
                      value={enrollmentNo}
                      onChange={(e) => setEnrollmentNo(e.target.value)}
                      className="input-field"
                      placeholder="Enrollment number"
                      required
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label htmlFor="seed-id" className="mb-1 block text-xs font-semibold text-slate-700">
                      ID
                    </label>
                    <input
                      id="seed-id"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      className="input-field"
                      placeholder={seededRole === "Admin" ? "Admin ID" : "Organizer ID"}
                      autoComplete="username"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="seed-pass" className="mb-1 block text-xs font-semibold text-slate-700">
                      Password
                    </label>
                    <input
                      id="seed-pass"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-field"
                      placeholder="Password"
                      autoComplete="current-password"
                      required
                    />
                  </div>
                </>
              )}

              <button type="submit" className="btn-primary w-full">
                Sign in
              </button>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-relaxed text-slate-600">
                <p className="font-semibold text-slate-700">Fixed seeded accounts</p>
                <ul className="mt-2 space-y-1">
                  {config.seededStudents.map((student) => (
                    <li key={student.enrollmentNo}>
                      {student.name} · {student.shortCode} · {student.enrollmentNo}
                    </li>
                  ))}
                  {config.seededStaff.map((staff) => (
                    <li key={staff.loginId}>
                      {staff.role}: {staff.loginId} / {staff.password}
                    </li>
                  ))}
                </ul>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
