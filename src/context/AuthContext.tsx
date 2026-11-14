import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { authApi } from "../api/services";
import { getApiErrorMessage, setUnauthorizedHandler } from "../api/client";
import { tokenStorage } from "../utils/tokenStorage";
import { useToast } from "../hooks/useToast";
import type { User, UserRole } from "../types";

interface AuthContextValue {
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithGoogle: (googleIdToken: string) => Promise<User>;
  loginWithDemo: (email: string, name?: string) => Promise<User>;
  loginWithSeeded: (payload: {
    role: "Attendee" | "Organizer" | "Admin";
    name?: string;
    department_id?: number;
    enrollment_no?: string;
    login_id?: string;
    password?: string;
  }) => Promise<User>;
  logout: (notifyMessage?: string) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  const logout = useCallback(
    (notifyMessage?: string) => {
      tokenStorage.clearToken();
      setUser(null);
      if (window.google?.accounts?.id) {
        window.google.accounts.id.disableAutoSelect();
      }
      if (notifyMessage) {
        showToast(notifyMessage, "info");
      }
    },
    [showToast]
  );

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      showToast("Your session expired. Please sign in again.", "error");
    });
    return () => setUnauthorizedHandler(null);
  }, [showToast]);

  useEffect(() => {
    const token = tokenStorage.getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    let active = true;
    authApi
      .getMe()
      .then((loadedUser) => {
        if (active) setUser(loadedUser);
      })
      .catch(() => {
        tokenStorage.clearToken();
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const loginWithGoogle = useCallback(
    async (googleIdToken: string) => {
      try {
        const res = await authApi.loginWithGoogle(googleIdToken);
        tokenStorage.setToken(res.access_token);
        setUser(res.user);
        showToast(`Signed in as ${res.user.name}`, "success");
        return res.user;
      } catch (err) {
        showToast(getApiErrorMessage(err, "Google sign-in failed."), "error");
        throw err;
      }
    },
    [showToast]
  );

  const loginWithSeeded = useCallback(
    async (payload: {
      role: "Attendee" | "Organizer" | "Admin";
      name?: string;
      department_id?: number;
      enrollment_no?: string;
      login_id?: string;
      password?: string;
    }) => {
      try {
        const res = await authApi.loginWithSeeded(payload);
        tokenStorage.setToken(res.access_token);
        setUser(res.user);
        showToast(`Signed in as ${res.user.name} (${res.user.role})`, "success");
        return res.user;
      } catch (err) {
        showToast(getApiErrorMessage(err, "Sign-in failed."), "error");
        throw err;
      }
    },
    [showToast]
  );

  const loginWithDemo = useCallback(
    async (email: string, name?: string) => {
      try {
        const res = await authApi.loginWithDemo(email, name);
        tokenStorage.setToken(res.access_token);
        setUser(res.user);
        showToast(`Signed in as ${res.user.name} (${res.user.role})`, "success");
        return res.user;
      } catch (err) {
        showToast(getApiErrorMessage(err, "Sign-in failed."), "error");
        throw err;
      }
    },
    [showToast]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        isAuthenticated: Boolean(user),
        isLoading,
        loginWithGoogle,
        loginWithDemo,
        loginWithSeeded,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
