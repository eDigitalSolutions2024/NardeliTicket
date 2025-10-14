// src/pages/AuthPage.tsx
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { useMemo, useEffect, useCallback } from "react";
import Login from "./Login";
import Register from "./Register";
import "../CSS/Auth.css";

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

  useEffect(() => {
    const tok = localStorage.getItem("token");
    const hasToken = !!tok && tok !== "undefined" && tok !== "null" && tok.trim() !== "";
    if (hasToken) navigate(redirectTo, { replace: true });
  }, [navigate, redirectTo]);

  // src/pages/AuthPage.tsx (solo cambia handleAuthSuccess)
const handleAuthSuccess = useCallback((token: string) => {
  localStorage.setItem("token", token);

  // intenta recuperar el payload pendiente
  let pending: any = null;
  try {
    const raw = sessionStorage.getItem("NT_PENDING_CHECKOUT");
    if (raw) pending = JSON.parse(raw);
  } catch {}

  // navega a /cart con state (si hay), y deja el storage para que Cart lo borre al consumirlo
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
