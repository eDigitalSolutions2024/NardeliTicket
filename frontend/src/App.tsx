import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import EventsPage from "./pages/Events";
import AdminDashboard from "./pages/AdminDashboard";
import AuthPage from "./pages/AuthPage";
import Navbar from "./components/Navbar";
import AdminRoute from "./components/AdminRoute";

export default function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        {/* Públicas */}
        <Route path="/" element={<Home />} />
        <Route path="/events" element={<EventsPage />} />

        {/* Auth */}
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/login" element={<Navigate to="/auth?tab=login" replace />} />
        <Route path="/register" element={<Navigate to="/auth?tab=register" replace />} />

        {/* Admin protegido */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
