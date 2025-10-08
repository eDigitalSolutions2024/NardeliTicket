import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
//import EventDetail from "./pages/EventDetail";
//import Cart from "./pages/Cart";
//import AdminDashboard from "./pages/AdminDashboard";

export default function App() {
  return (
    <Router>
      <nav style={{ padding: "10px", background: "#222", color: "#fff" }}>
        <Link to="/" style={{ marginRight: 10, color: "#fff" }}>Inicio</Link>
        <Link to="/cart" style={{ marginRight: 10, color: "#fff" }}>Carrito</Link>
        <Link to="/admin" style={{ color: "#fff" }}>Admin</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        {/*<Route path="/evento/:id" element={<EventDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/admin" element={<AdminDashboard />} />*/}
      </Routes>
    </Router>
  );
}
