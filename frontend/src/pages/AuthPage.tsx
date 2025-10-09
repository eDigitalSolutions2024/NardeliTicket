// src/pages/AuthPage.tsx
import { useSearchParams } from "react-router-dom";
import { useMemo } from "react";
import Login from "./Login";
import Register from "./Register";
import "../CSS/Auth.css";

export default function AuthPage() {
  const [params, setParams] = useSearchParams();
  const tab = useMemo<"login" | "register">(
    () => (params.get("tab") === "register" ? "register" : "login"),
    [params]
  );

  const setTab = (t: "login" | "register") => {
    params.set("tab", t);
    setParams(params, { replace: true });
  };

  return (
    <div className="auth">
      <div className="auth__card">
        <div className="auth__panel" role="tabpanel">
          {tab === "login" ? <Login /> : <Register />}
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
