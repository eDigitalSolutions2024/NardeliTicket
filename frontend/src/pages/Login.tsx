import { useState } from "react";
import { login } from "../api/auth";
import { useAuth } from "../store/useAuth";
// ❌ ya no navegamos aquí; AuthPage hará el redirect después del éxito
// import { useNavigate, Link } from "react-router-dom";
import { Link } from "react-router-dom";

type Props = { onSuccess?: (token: string) => void };

export default function Login({ onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const setAuth = useAuth((s) => s.setAuth);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { user, token } = await login(email, password);
      setAuth(user, token);
      // ✅ deja que AuthPage redirija con redirectTo
      onSuccess?.(token);
    } catch {
      alert("Credenciales inválidas");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420, paddingTop: 40 }}>
      <h1>Iniciar Sesión</h1>
      <form onSubmit={onSubmit} className="admin-form">
        <label>Email <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required /></label>
        <label>Contraseña <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required /></label>
        <button type="submit" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
      </form>
      <p>¿No tienes cuenta? <Link to="/auth?tab=register">Regístrate</Link></p>
    </div>
  );
}
