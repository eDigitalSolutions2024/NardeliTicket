import { useState } from "react";
import { login } from "../api/auth";
import { useAuth } from "../store/useAuth";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false); const setAuth = useAuth(s=>s.setAuth);
  const nav = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    try {
      const { user, token } = await login(email, password);
      setAuth(user, token);
      nav("/admin");
    } catch { alert("Credenciales inválidas"); }
    finally { setLoading(false); }
  }

  return (
    <div className="container" style={{ maxWidth: 420, paddingTop: 40 }}>
      <h1>Iniciar Sesion</h1>
      <form onSubmit={onSubmit} className="admin-form">
        <label>Email <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
        <label>Contraseña <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
        <button type="submit" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
      </form>
      <p>¿No tienes cuenta? <Link to="/register">Regístrate</Link></p>
    </div>
  );
}
