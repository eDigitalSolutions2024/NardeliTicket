import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import "./Navbar.css";
import { useAuth } from "../auth/AuthProviders"; // ⬅️ usa el provider nuevo
import logoWhite from "../assets/nardeli-mark-white.png";

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

  // ✅ estado de sesión desde el AuthProvider
  const { user, logout } = useAuth();
  const [openUserMenu, setOpenUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // cerrar dropdown al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(e.target as Node)) setOpenUserMenu(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // Sync q from URL → input
  useEffect(() => setQuery(qFromUrl), [qFromUrl]);

  // Demo cart count
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
    params.delete("page");
    navigate({ pathname: "/home", search: params.toString() });
    setMenuOpen(false);
  };

  const initials = (user?.name || user?.email || "?")
    .split(" ")
    .map(p => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="nv">
      <div className="nv__inner">
        <div className="nv__left">
          <button className="nv__burger" aria-label="Abrir menú" onClick={() => setMenuOpen(v => !v)}>☰</button>
          <Link to="/home" className="nv__brand" onClick={() => setMenuOpen(false)}>
            <img className="nv__logo" src={logoWhite} alt="Nardeli" />{BRAND}
          </Link>
          <nav className={`nv__links ${menuOpen ? "is-open" : ""}`}>
            <Link to="/home" onClick={() => setMenuOpen(false)}>Inicio</Link>
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

                  {user ? (
                    <div className="nv__user" ref={userMenuRef}>
                      <button
                        className="nv__userbtn"
                        onClick={() => setOpenUserMenu(v => !v)}
                        aria-haspopup="menu"
                        aria-expanded={openUserMenu}
                        title={user?.name || user?.email}
                      >
                        <span className="nv__avatar">{initials}</span>
                        <span className="nv__username">{user?.name || user?.email}</span>
                        <span className="nv__chev">▾</span>
                      </button>

                      {openUserMenu && (
                        <div className="nv__menu" role="menu">
                          <Link to="/account" role="menuitem" onClick={() => setOpenUserMenu(false)}>
                            Configuración
                          </Link>
                          {user?.role === "admin" && (
                            <Link to="/admin" role="menuitem" onClick={() => setOpenUserMenu(false)}>
                              Panel Admin
                            </Link>
                          )}
                          <button
                            role="menuitem"
                            onClick={async () => {
                              await logout();
                              setOpenUserMenu(false);
                              navigate("/home");
                            }}
                          >
                            Cerrar sesión
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="nv__guest">
                      {/* Desktop: botón con texto */}
                      <Link to="/auth?tab=login" className="nv__login">
                        Iniciar sesión
                      </Link>

                      {/* Mobile: solo icono de usuario (se muestra por CSS) */}
                      <Link
                        to="/auth?tab=login"
                        className="nv__login-icon"
                        aria-label="Iniciar sesión"
                      >
                        <span className="nv__avatar">👤</span>
                      </Link>
                    </div>
                  )}
                </div>
      </div>
    </header>
  );
}
