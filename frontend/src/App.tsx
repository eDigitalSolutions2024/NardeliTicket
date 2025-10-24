// App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import EventsPage from "./pages/Events";
import AdminDashboard from "./pages/AdminDashboard";
import AuthPage from "./pages/AuthPage";
import Navbar from "./components/Navbar";
import AdminRoute from "./components/AdminRoute";
import EventDetail from "./pages/EventDetail";
import SeatSelectionPage from "./pages/SeatSelectionPage";
import CartPage from "./pages/Cart"; // 👈 nuevo
import CheckoutSuccess from "./pages/CheckoutSuccess";
import CheckoutCancel from "./pages/CheckoutCancel";

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem("token");
  const hasToken = !!token && token !== "undefined" && token !== "null" && token.trim() !== "";
  if (!hasToken) {
    return <Navigate to="/auth?tab=login" replace state={{ redirectTo: "/cart" }} />;
  }
  return children;
}



export default function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        {/* Públicas */}
        <Route path="/" element={<Home />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:id" element={<EventDetail />} />

        {/* 👉 Ruta de selección de asientos (sin props) */}
        <Route path="/event/:id/seleccion" element={<SeatSelectionPage />} />
        

        {/* Auth */}
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/login" element={<Navigate to="/auth?tab=login" replace />} />
        <Route path="/register" element={<Navigate to="/auth?tab=register" replace />} />




        {/* Cart (recomendado protegido) */}
        <Route
          path="/cart"
          element={
            <RequireAuth>
              <CartPage />
            </RequireAuth>
          }
        />

        <Route path="/checkout/success" element={<CheckoutSuccess />} />
        <Route path="/checkout/cancel" element={<CheckoutCancel />} />

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
