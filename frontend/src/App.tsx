// src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import AdminDashboard from "./pages/AdminDashboard";
import AuthPage from "./pages/AuthPage";
import Navbar from "./components/Navbar";
// import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />

        {/* Página única con tabs */}
        <Route path="/auth" element={<AuthPage />} />

        {/* Admin (protegido si ya usas auth) */}
        {/* <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} /> */}
        <Route path="/admin" element={<AdminDashboard />} />

        {/* Backwards compatibility (opcional): redirige /login y /register a /auth */}
        <Route path="/login" element={<Navigate to="/auth?tab=login" replace />} />
        <Route path="/register" element={<Navigate to="/auth?tab=register" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
