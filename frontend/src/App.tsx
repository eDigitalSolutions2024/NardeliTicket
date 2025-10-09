// src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AdminDashboard from "./pages/AdminDashboard";
import Home from "./pages/Home";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute"; // si lo estás usando

export default function App() {
  return (
    <Router>
      <Navbar />

      <Routes>
        {/* Home visible en la raíz */}
        <Route path="/" element={<Home />} />

        {/* Admin (protegido, opcional) */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Cualquier otra ruta -> Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
