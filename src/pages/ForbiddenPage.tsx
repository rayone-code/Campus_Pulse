import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import type { UserRole } from "../types";

export default function ForbiddenPage({
  requiredRoles = [],
}: {
  requiredRoles?: UserRole[];
}) {
  const { role } = useAuth();

  return (
    <div className="flex min-h-[calc(100vh-160px)] items-center justify-center px-4 py-12">
      <div className="surface-card w-full max-w-md p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">Access Not Allowed</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your current role (<strong>{role}</strong>) does not have permission to view
          this section.
          {requiredRoles.length > 0 && (
            <> Required role: {requiredRoles.join(" or ")}.</>
          )}
        </p>
        <div className="mt-6 flex justify-center">
          <Link to="/events" className="btn-primary">
            Back to Events
          </Link>
        </div>
      </div>
    </div>
  );
}
