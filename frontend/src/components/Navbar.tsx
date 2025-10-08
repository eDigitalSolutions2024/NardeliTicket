import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import "./Navbar.css"; // crea este archivo o cambia por App.css

const BRAND = "NardeliTicket";

function useQueryParam(name: string) {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search).get(name) || "", [search, name]);
}

export default function Navbar() {
  const navigate = useNavigate();
  const qFromUrl = useQueryParam("q");
  const [query, setQuery] = useState(qFromUrl);
  const [cartCount, setCartCount] = useState<number>(0);
  const [menuOpen, setMenuOpen] = useState(false);

  // Sync q from URL → input
  useEffect(() => setQuery(qFromUrl), [qFromUrl]);

  // Demo: lee contador de carrito desde localStorage (ajusta cuando tengas store real)
  useEffect(() => {
    const n = Number(localStorage.getItem("cartCount") || "0");
    setCartCount(Number.isFinite(n) ? n : 0);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "cartCount") {
        const v = Number(e.newValue || "0");
        setCartCount(Number.isFinite(v) ? v : 0);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    query ? params.set("q", query) : params.delete("q");
    // al hacer búsqueda, vuelve a página 1 (si usas paginación)
    params.delete("page");
    navigate({ pathname: "/", search: params.toString() });
    setMenuOpen(false);
  };

  return (
    <header className="nv">
      <div className="nv__inner">
        <div className="nv__left">
          <button
            className="nv__burger"
            aria-label="Abrir menú"
            onClick={() => setMenuOpen(v => !v)}
          >
            ☰
          </button>

          <Link to="/" className="nv__brand" onClick={() => setMenuOpen(false)}>
            <span className="nv__logo" aria-hidden>🎟️</span>
            {BRAND}
          </Link>

          <nav className={`nv__links ${menuOpen ? "is-open" : ""}`}>
            <Link to="/" onClick={() => setMenuOpen(false)}>Inicio</Link>
            <Link to="/events" onClick={() => setMenuOpen(false)}>Eventos</Link>
            <Link to="/categories" onClick={() => setMenuOpen(false)}>Categorías</Link>
          </nav>
        </div>

        <form className="nv__search" onSubmit={onSubmit} role="search" aria-label="Buscar eventos">
          <input
            type="search"
            placeholder="Buscar evento, artista, lugar…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar"
          />
          <button type="submit">Buscar</button>
        </form>

        <div className="nv__right">
          <Link to="/cart" className="nv__cart" aria-label={`Carrito con ${cartCount} artículos`}>
            🛒<span className="nv__badge">{cartCount}</span>
          </Link>
          <Link to="/login" className="nv__login">Iniciar sesión</Link>
        </div>
      </div>
    </header>
  );
}
