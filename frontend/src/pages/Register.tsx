import { useState } from "react";
import { useAuth } from "../auth/AuthProviders";
import { register as apiRegister } from "../api/auth";
import { Link } from "react-router-dom";

type Props = { onSuccess?: () => void };

export default function Register({ onSuccess }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth(); // reutilizamos el login del provider

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // 1) crea la cuenta
      await apiRegister(name, email, password);
      // 2) inicia sesión con las mismas credenciales (consistente con el provider)
      await login(email, password);
      onSuccess?.(); // AuthPage hace el redirect
    } catch {
      alert("No se pudo registrar (¿email ya usado?)");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420, paddingTop: 40 }}>
      <h1>Registrarse</h1>
      <form onSubmit={onSubmit} className="admin-form">
        <label>
          Nombre
          <input value={name} onChange={(e)=>setName(e.target.value)} required />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Creando..." : "Crear cuenta"}
        </button>
      </form>
      <p>¿Ya tienes cuenta? <Link to="/auth?tab=login">Ingresa</Link></p>
    </div>
  );
}
