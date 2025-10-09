import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../store/useAuth";
import { getMe } from "../api/auth";

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { token, user, setAuth, logout } = useAuth();
  const location = useLocation();
  const [checking, setChecking] = useState(false);

  // Si hay token pero aún no tenemos user (refresh), tratamos de hidratar con /me
  useEffect(() => {
    (async () => {
      if (token && !user && !checking) {
        setChecking(true);
        try {
          const { user: u } = await getMe();
          setAuth(u, token);
        } catch {
          logout();
        } finally {
          setChecking(false);
        }
      }
    })();
  }, [token, user, checking, setAuth, logout]);

  if (!token) {
    // no logueado → manda a login y recuerda a dónde iba
    return <Navigate to="/auth?tab=login" replace state={{ from: location.pathname }} />;
  }
  if (checking) return null; // o un loader/spinner

  if (user && user.role !== "admin") {
    // logueado pero no admin → a inicio o /403
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
