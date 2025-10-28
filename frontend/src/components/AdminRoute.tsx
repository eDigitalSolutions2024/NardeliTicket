// src/components/AdminRoute.tsx
import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProviders"; // 👈 usa el provider nuevo

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return null; // o un spinner

  if (!user) {
    return (
      <Navigate
        to="/auth?tab=login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
