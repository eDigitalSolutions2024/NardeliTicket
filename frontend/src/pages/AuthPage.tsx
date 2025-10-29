// src/pages/AuthPage.tsx
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { useMemo, useEffect, useCallback } from "react";
import Login from "./Login";
import Register from "./Register";
import "../CSS/Auth.css";
import { useAuth } from "../auth/AuthProviders";

type Tab = "login" | "register";

export default function AuthPage() {
  const [params, setParams] = useSearchParams();
  const tab = useMemo<Tab>(
    () => (params.get("tab") === "register" ? "register" : "login"),
    [params]
  );

  const setTab = (t: Tab) => {
    params.set("tab", t);
    setParams(params, { replace: true });
  };

  const location = useLocation() as any;
  const navigate = useNavigate();
  const redirectTo: string = location.state?.redirectTo || "/cart";

  // ✅ usa el contexto de auth (no localStorage)
  const { user, ready } = useAuth();

  // Cuando esté listo el provider y haya usuario, redirige
  useEffect(() => {
    if (!ready) return;
    if (user) {
      navigate(redirectTo, { replace: true });
    }
  }, [ready, user, navigate, redirectTo]);

  // onSuccess: solo navega. Nada de tokens aquí.
  const handleAuthSuccess = useCallback(() => {
    // intenta recuperar payload pendiente y pásalo como state
    let pending: any = null;
    try {
      const raw = sessionStorage.getItem("NT_PENDING_CHECKOUT");
      if (raw) pending = JSON.parse(raw);
    } catch {}
    navigate(redirectTo, { replace: true, state: pending || undefined });
  }, [navigate, redirectTo]);

  return (
    <div className="auth">
      <div className="auth__card">
        <div className="auth__panel" role="tabpanel">
          {tab === "login"
            ? <Login onSuccess={handleAuthSuccess} />
            : <Register onSuccess={handleAuthSuccess} />
          }
        </div>

        <div className="auth__tabs" role="tablist" aria-label="Autenticación">
          <button
            role="tab"
            aria-selected={tab === "login"}
            className={`auth__tab ${tab === "login" ? "is-active" : ""}`}
            onClick={() => setTab("login")}
          >
            Iniciar sesión
          </button>
          <button
            role="tab"
            aria-selected={tab === "register"}
            className={`auth__tab ${tab === "register" ? "is-active" : ""}`}
            onClick={() => setTab("register")}
          >
            Registrarse
          </button>
        </div>
      </div>
    </div>
  );
}
