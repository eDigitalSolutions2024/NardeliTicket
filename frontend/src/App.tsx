// src/App.tsx
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from "react-router-dom";
import AdminDashboard from "./pages/AdminDashboard";

export default function App() {
  return (
    <Router>
      <header style={{ background: "#222", padding: "10px" }}>
        <nav>
          <Link to="/admin" style={{ color: "#fff", fontWeight: 700 }}>
            Admin
          </Link>
        </nav>
      </header>

      <Routes>
        {/* Redirige la raíz a /admin */}
        <Route path="/" element={<Navigate to="/admin" replace />} />
        {/* Única página activa */}
        <Route path="/admin" element={<AdminDashboard />} />
        {/* Cualquier otra ruta también va a /admin */}
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Router>
  );
}
