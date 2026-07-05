/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { hasAccess } from "./roleAccess";

const AuthContext = createContext(null);

async function readJson(response) {
  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const applySession = useCallback((session) => {
    setUser(session?.user ?? null);
    setMemberships(Array.isArray(session?.memberships) ? session.memberships : []);
  }, []);

  const refreshAuth = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/me", {
        credentials: "same-origin",
      });

      if (response.status === 401) {
        applySession(null);
        return null;
      }

      if (!response.ok) {
        throw new Error(`Auth check failed with status ${response.status}`);
      }

      const session = await readJson(response);
      applySession(session);
      return session;
    } catch (caughtError) {
      applySession(null);
      setError(caughtError);
      return null;
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  useEffect(() => {
    let active = true;

    async function loadAuth() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/auth/me", {
          credentials: "same-origin",
        });

        if (!active) {
          return;
        }

        if (response.status === 401) {
          applySession(null);
          return;
        }

        if (!response.ok) {
          throw new Error(`Auth check failed with status ${response.status}`);
        }

        const session = await readJson(response);
        if (!active) {
          return;
        }

        applySession(session);
      } catch (caughtError) {
        if (!active) {
          return;
        }

        applySession(null);
        setError(caughtError);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadAuth();

    return () => {
      active = false;
    };
  }, [applySession]);

  const login = useCallback(
    async (credentials) => {
      setError(null);

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(credentials),
      });

      const payload = await readJson(response);
      if (!response.ok) {
        const message = payload?.error?.message ?? `Login failed with status ${response.status}`;
        const loginError = new Error(message);
        setError(loginError);
        throw loginError;
      }

      applySession(payload);
      return payload;
    },
    [applySession],
  );

  const register = useCallback(
    async (registration) => {
      setError(null);

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(registration),
      });

      const payload = await readJson(response);
      if (!response.ok) {
        const message = payload?.error?.message ?? `Registration failed with status ${response.status}`;
        const registerError = new Error(message);
        setError(registerError);
        throw registerError;
      }

      applySession(payload);
      return payload;
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    setError(null);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      applySession(null);
    }
  }, [applySession]);

  const hasAnyRole = useCallback(
    (roles = []) => hasAccess(user, memberships, roles),
    [memberships, user],
  );

  const value = useMemo(
    () => ({
      user,
      memberships,
      loading,
      error,
      refreshAuth,
      login,
      register,
      logout,
      hasAnyRole,
    }),
    [error, hasAnyRole, loading, login, logout, memberships, refreshAuth, register, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
