import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import Layout from "./components/Layout";
import PublicRoute from "./routes/PublicRoute";
import PrivateRoute from "./routes/PrivateRoute";
import RoleRoute from "./routes/RoleRoute";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import EventsPage from "./pages/EventsPage";
import EventDetailPage from "./pages/EventDetailPage";
import DepartmentVerifyPage from "./pages/DepartmentVerifyPage";
import AnnouncementsPage from "./pages/AnnouncementsPage";
import OrganizerDashboardPage from "./pages/OrganizerDashboardPage";
import AdminPanelPage from "./pages/AdminPanelPage";

export default function App() {
  return (
    <ThemeProvider>
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<LandingPage />} />

              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <LoginPage />
                  </PublicRoute>
                }
              />

              <Route
                path="/events"
                element={
                  <PrivateRoute>
                    <EventsPage />
                  </PrivateRoute>
                }
              />

              <Route
                path="/events/:eventId"
                element={
                  <PrivateRoute>
                    <EventDetailPage />
                  </PrivateRoute>
                }
              />

              <Route
                path="/events/:eventId/verify-access"
                element={
                  <PrivateRoute>
                    <DepartmentVerifyPage />
                  </PrivateRoute>
                }
              />

              <Route
                path="/announcements"
                element={
                  <PrivateRoute>
                    <AnnouncementsPage />
                  </PrivateRoute>
                }
              />

              <Route
                path="/organizer"
                element={
                  <RoleRoute allowedRoles={["Organizer", "Admin"]}>
                    <OrganizerDashboardPage />
                  </RoleRoute>
                }
              />

              <Route
                path="/admin"
                element={
                  <RoleRoute allowedRoles={["Admin"]}>
                    <AdminPanelPage />
                  </RoleRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
    </ThemeProvider>
  );
}
