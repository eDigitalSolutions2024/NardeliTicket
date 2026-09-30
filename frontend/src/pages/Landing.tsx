import { useState } from "react";
import { useNavigate } from "react-router-dom";
import WebGLParticles from "../components/WebGLParticles";
import logoWhite from "../assets/nardeli-mark-white.png";
import "../CSS/Landing.css";

export default function Landing() {
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);

  const enter = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(() => navigate("/home"), 620);
  };

  return (
    <div className={`landing ${leaving ? "is-leaving" : ""}`}>
      <WebGLParticles className="landing__smoke" ambient={1.2} />
      <div className="landing__vignette" aria-hidden />

      <div className="landing__content">
        <span className="landing__eyebrow">¿ Listo para vivirlo ?</span>

        <img className="landing__logo" src={logoWhite} alt="Nardeli" />

        <h1 className="landing__brand">
          Nardeli<span className="landing__brand-accent">Ticket</span>
        </h1>

        <p className="landing__tagline">Boletos para tus mejores momentos</p>

        <button className="landing__cta" onClick={enter}>
          <span>Comenzar</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <p className="landing__hint">Tu boletera digital sin fronteras</p>
      </div>

      <footer className="landing__footer">
        © NardeliTicket {new Date().getFullYear()} · Todos los derechos reservados
      </footer>
    </div>
  );
}
