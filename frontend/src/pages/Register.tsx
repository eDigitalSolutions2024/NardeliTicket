import { useState } from "react";
import { register } from "../api/auth";
import { useAuth } from "../store/useAuth";
import { useNavigate, Link } from "react-router-dom";

export default function Register() {
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false); const setAuth = useAuth(s=>s.setAuth);
  const nav = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    try {
      const { user, token } = await register(name, email, password);
      setAuth(user, token);
      nav("/admin");
    } catch { alert("No se pudo registrar (¿email ya usado?)"); }
    finally { setLoading(false); }
  }

  return (
    <div className="container" style={{ maxWidth: 420, paddingTop: 40 }}>
      <h1>Registrarse</h1>
      <form onSubmit={onSubmit} className="admin-form">
        <label>Nombre <input value={name} onChange={e=>setName(e.target.value)} required /></label>
        <label>Email <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
        <label>Contraseña <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
        <button type="submit" disabled={loading}>{loading ? "Creando..." : "Crear cuenta"}</button>
      </form>
      <p>¿Ya tienes cuenta? <Link to="/login">Ingresa</Link></p>
    </div>
  );
}
