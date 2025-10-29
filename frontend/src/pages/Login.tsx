import { useState } from "react";
import { useAuth } from "../auth/AuthProviders";
import { Link } from "react-router-dom";

type Props = { onSuccess?: () => void };

export default function Login({ onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password); // ← guarda AT en memoria y setea user
      onSuccess?.();                // ← AuthPage hará el redirect
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
        <label>
          Email
          <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
      <p>¿No tienes cuenta? <Link to="/auth?tab=register">Regístrate</Link></p>
    </div>
  );
}
