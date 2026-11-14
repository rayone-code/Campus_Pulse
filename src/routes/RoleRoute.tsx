import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import type { UserRole } from "../types";
import LoadingSpinner from "../components/LoadingSpinner";
import ForbiddenPage from "../pages/ForbiddenPage";

interface RoleRouteProps {
  allowedRoles: UserRole[];
  children: ReactNode;
}

export default function RoleRoute({ allowedRoles, children }: RoleRouteProps) {
  const { isAuthenticated, isLoading, role } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner fullScreen label="Verifying permissions..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!role || !allowedRoles.includes(role)) {
    return <ForbiddenPage requiredRoles={allowedRoles} />;
  }

  return <>{children}</>;
}
