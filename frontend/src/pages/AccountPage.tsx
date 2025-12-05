// src/pages/AccountPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { Me } from "../api/account";
import {
  fetchMe,
  updateProfile,
  changePassword,
  fetchMyPurchases,
  type MyPurchase,
} from "../api/account";
import { useAuth } from "../auth/AuthProviders";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api/client";
import "../CSS/AccountPage.css";

// PDF combinado por orden: /files/tickets/tickets_order_<orderId>.pdf
function buildOrderPdfUrl(orderId: string): string {
  const base = API_BASE.replace(/\/+$/, "");      // ej. http://localhost:4000/api
  const apiRoot = base.replace(/\/api$/, "");     // ej. http://localhost:4000
  return `${apiRoot}/files/tickets/tickets_order_${orderId}.pdf`;
}

export default function AccountPage() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();

  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");

  const [purchases, setPurchases] = useState<MyPurchase[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(true);

  const initials = useMemo(() => {
    const s = (me?.name || me?.email || "?").trim();
    return s
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [me]);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      navigate("/auth?tab=login");
      return;
    }
    (async () => {
      try {
        const data = await fetchMe();
        setMe(data);
        setName(data.name ?? "");
        setPhone((data as any).phone ?? "");
        const rows = await fetchMyPurchases();
        setPurchases(rows);
      } finally {
        setLoading(false);
        setLoadingPurchases(false);
      }
    })();
  }, [ready, user, navigate]);

  const onSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const upd = await updateProfile({
        name: name.trim(),
        phone: phone.trim() || undefined,
      });
      setMe(upd);
      alert("Perfil actualizado");
    } catch (e: any) {
      alert(e?.response?.data?.message || "No se pudo actualizar el perfil");
    } finally {
      setSaving(false);
    }
  };

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass.length < 8)
      return alert("La nueva contraseña debe tener al menos 8 caracteres");
    if (newPass !== newPass2)
      return alert("Las contraseñas no coinciden");
    try {
      await changePassword({
        currentPassword: curPass,
        newPassword: newPass,
      });
      setCurPass("");
      setNewPass("");
      setNewPass2("");
      alert("Contraseña actualizada");
    } catch (e: any) {
      alert(e?.response?.data?.message || "No se pudo cambiar la contraseña");
    }
  };

  if (loading) return <div className="acc-wrap">Cargando…</div>;

  return (
    <div className="acc-wrap">
      <h2 className="acc-title">
        <span className="chip">{initials || "A"}</span>
        Configuración de la cuenta
      </h2>
      <p className="acc-sub">
        Gestiona tu perfil y la seguridad de tu cuenta de NardeliTicket.
      </p>

      {/* Perfil */}
      <section className="acc-card">
        <h3>Perfil</h3>

        <div className="acc-row">
          <span className="chip" aria-hidden>
            {initials || "A"}
          </span>
          <div className="note">
            Esta inicial aparece en el menú superior.
          </div>
        </div>

        <div className="acc-divider" />

        <form onSubmit={onSaveProfile}>
          <div className="acc-grid cols-2">
            <div className="acc-field">
              <label>Nombre</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
              />
            </div>
            <div className="acc-field">
              <label>Teléfono (WhatsApp)</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="521XXXXXXXXXX"
              />
            </div>
          </div>

          <div className="acc-meta">
            <div>
              <b>Email:</b> {me?.email}
            </div>
            <div>
              <b>Rol:</b>{" "}
              <span className="badge-role">{me?.role}</span>
            </div>
          </div>

          <div className="acc-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setName(me?.name ?? "");
                setPhone((me as any)?.phone ?? "");
              }}
            >
              Deshacer
            </button>
          </div>
        </form>
      </section>

      {/* Seguridad */}
      <section className="acc-card">
        <h3>Seguridad</h3>
        <form onSubmit={onChangePassword}>
          <div className="acc-grid cols-3">
            <div className="acc-field">
              <label>Contraseña actual</label>
              <input
                type="password"
                value={curPass}
                onChange={(e) => setCurPass(e.target.value)}
              />
            </div>
            <div className="acc-field">
              <label>Nueva contraseña</label>
              <input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
              />
            </div>
            <div className="acc-field">
              <label>Repetir nueva</label>
              <input
                type="password"
                value={newPass2}
                onChange={(e) => setNewPass2(e.target.value)}
              />
            </div>
          </div>

          <div className="acc-actions">
            <button className="btn btn-primary" type="submit">
              Actualizar contraseña
            </button>
            <span className="note">Mínimo 8 caracteres.</span>
          </div>
        </form>
      </section>

      {/* Mis compras / boletos */}
      <section className="acc-card">
        <h3>Mis compras y boletos</h3>
        <p className="acc-sub">
          Aquí puedes ver tus órdenes, boletos y descargar los PDFs cuando estén
          disponibles.
        </p>

        {loadingPurchases ? (
          <div className="note">Cargando compras…</div>
        ) : !purchases.length ? (
          <div className="note">Aún no tienes compras registradas.</div>
        ) : (
          <div className="acc-table-wrapper">
            <table className="acc-table">
              <thead>
                <tr>
                  <th>Fecha compra</th>
                  <th>Evento</th>
                  <th>Sesión</th>
                  <th>Zona</th>
                  <th>Asiento</th>
                  <th>Ticket</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th>PDF</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p, i) => (
                  <tr
                    key={p.ticketId || `${p.orderId}-${p.seatLabel || i}`}
                  >
                    <td>
                      {p.paidAt || p.createdAt
                        ? new Date(
                            p.paidAt || p.createdAt!
                          ).toLocaleString("es-MX")
                        : "-"}
                    </td>
                    <td>{p.eventTitle}</td>
                    <td>
                      {p.sessionDate
                        ? new Date(
                            p.sessionDate
                          ).toLocaleString("es-MX")
                        : "-"}
                    </td>
                    <td>{p.zone || "-"}</td>
                    <td>{p.seatLabel || "-"}</td>
                    <td>{p.ticketId || "-"}</td>
                    <td>
                      {typeof p.price === "number"
                        ? `$ ${p.price.toLocaleString("es-MX", {
                            minimumFractionDigits: 2,
                          })}`
                        : "-"}
                    </td>
                    <td>
                      <span
                        className={`badge status--${(
                          p.status || ""
                        ).toLowerCase()}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td>
                      {p.orderId && p.status === "paid" ? (
                        <a
                          href={buildOrderPdfUrl(p.orderId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-link"
                        >
                          Ver boleto(s)
                        </a>
                      ) : p.status === "pending_payment" ? (
                        <span className="note">Pendiente</span>
                      ) : (
                        <span className="note">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
