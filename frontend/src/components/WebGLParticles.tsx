import { useEffect, useRef } from "react";

/**
 * Sistema de partículas fluido en WebGL.
 * - Emite partículas suaves (glow) desde el cursor con inercia + swirl (curl).
 * - Emisión ambiental para que siempre haya movimiento.
 * - Canvas a pantalla completa (fixed): clientX/clientY mapean directo.
 */

type Props = {
  className?: string;
  /** color RGB 0..1 */
  color?: [number, number, number];
  /** densidad de emisión ambiental (0 = solo mouse) */
  ambient?: number;
};

const MAX = 1500;

const VERT = `
attribute vec2 a_pos;
attribute float a_size;
attribute float a_alpha;
uniform vec2 u_res;
uniform float u_dpr;
varying float v_alpha;
void main() {
  vec2 clip = (a_pos / u_res) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = a_size * u_dpr;
  v_alpha = a_alpha;
}
`;

const FRAG = `
precision mediump float;
varying float v_alpha;
uniform vec3 u_color;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  // circulo suave con núcleo brillante
  float a = smoothstep(0.5, 0.0, r);
  a = pow(a, 1.6);
  gl_FragColor = vec4(u_color, a * v_alpha);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

export default function WebGLParticles({
  className,
  color = [0.62, 0.4, 0.98],
  ambient = 1,
}: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const gl =
      (canvas.getContext("webgl", { premultipliedAlpha: false, alpha: true }) as WebGLRenderingContext | null) ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    // Buffers
    const posArr = new Float32Array(MAX * 2);
    const sizeArr = new Float32Array(MAX);
    const alphaArr = new Float32Array(MAX);

    const posBuf = gl.createBuffer();
    const sizeBuf = gl.createBuffer();
    const alphaBuf = gl.createBuffer();

    const aPos = gl.getAttribLocation(prog, "a_pos");
    const aSize = gl.getAttribLocation(prog, "a_size");
    const aAlpha = gl.getAttribLocation(prog, "a_alpha");
    const uRes = gl.getUniformLocation(prog, "u_res");
    const uDpr = gl.getUniformLocation(prog, "u_dpr");
    const uColor = gl.getUniformLocation(prog, "u_color");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // aditivo → glow

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let cssW = 0;
    let cssH = 0;
    const resize = () => {
      cssW = canvas.clientWidth;
      cssH = canvas.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(cssW * dpr));
      canvas.height = Math.max(1, Math.floor(cssH * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    // Estado de partículas (SoA)
    const px = new Float32Array(MAX);
    const py = new Float32Array(MAX);
    const pvx = new Float32Array(MAX);
    const pvy = new Float32Array(MAX);
    const plife = new Float32Array(MAX);
    const pttl = new Float32Array(MAX);
    const psize = new Float32Array(MAX);
    const pa = new Float32Array(MAX); // alpha base
    let head = 0;
    let count = 0;

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    const spawn = (
      x: number,
      y: number,
      vx: number,
      vy: number,
      big = false,
      aMul = 1
    ) => {
      const i = head;
      head = (head + 1) % MAX;
      if (count < MAX) count++;
      px[i] = x;
      py[i] = y;
      pvx[i] = vx + rand(-0.25, 0.25);
      pvy[i] = vy + rand(-0.25, 0.25) - 0.15;
      plife[i] = 0;
      pttl[i] = rand(120, 200); // ~2 a 3.3 s → desaparecen a los pocos segundos
      psize[i] = big ? rand(30, 54) : rand(16, 32);
      pa[i] = Math.min(1, rand(0.18, 0.4) * aMul);
    };

    // Mouse
    let mx = -9999;
    let my = -9999;
    let pmx = -9999;
    let pmy = -9999;
    let hasMouse = false;
    const onMove = (x: number, y: number) => {
      pmx = hasMouse ? mx : x;
      pmy = hasMouse ? my : y;
      mx = x;
      my = y;
      hasMouse = true;
      const dx = mx - pmx;
      const dy = my - pmy;
      const dist = Math.hypot(dx, dy);
      // más pasos = estela continua y fluida que sigue al mouse
      const steps = Math.min(24, Math.max(1, Math.floor(dist / 4)));
      for (let s = 0; s < steps; s++) {
        const tt = s / steps;
        // big=true → más grandes/visibles; hereda más velocidad del mouse → más fluidas
        spawn(
          pmx + dx * tt,
          pmy + dy * tt,
          dx * 0.22,
          dy * 0.22,
          true,
          1.3
        );
      }
    };
    const mouseHandler = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const touchHandler = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) onMove(t.clientX, t.clientY);
    };
    if (!reduced) {
      window.addEventListener("mousemove", mouseHandler);
      window.addEventListener("touchmove", touchHandler, { passive: true });
    }

    let raf = 0;
    let t = 0;
    const frame = () => {
      t += 0.016;

      // emisión ambiental (humo que sube suave, tenue)
      if (!reduced && ambient > 0) {
        const n = Math.ceil(ambient * 2.5);
        for (let k = 0; k < n; k++) {
          if (Math.random() < 0.7) {
            spawn(rand(0, cssW), rand(cssH * 0.35, cssH + 20), rand(-0.2, 0.2), rand(-0.45, -0.12), true);
          }
        }
      }

      // actualizar
      for (let i = 0; i < MAX; i++) {
        if (plife[i] >= pttl[i]) {
          alphaArr[i] = 0;
          continue;
        }
        // swirl tipo curl (fluidez) — dos frecuencias para un flujo más orgánico
        const cx =
          Math.sin(py[i] * 0.008 + t) * 0.09 +
          Math.sin(py[i] * 0.021 - t * 0.6) * 0.04;
        const cy =
          Math.cos(px[i] * 0.008 - t) * 0.09 +
          Math.cos(px[i] * 0.019 + t * 0.5) * 0.04;
        pvx[i] += cx;
        pvy[i] += cy - 0.006; // flotabilidad hacia arriba
        pvx[i] *= 0.975; // menos fricción → glide más fluido
        pvy[i] *= 0.975;
        px[i] += pvx[i];
        py[i] += pvy[i];
        plife[i] += 1;

        const lt = plife[i] / pttl[i];
        const fade = Math.sin(Math.PI * lt); // entra y sale
        posArr[i * 2] = px[i];
        posArr[i * 2 + 1] = py[i];
        sizeArr[i] = psize[i] * (0.6 + lt * 0.9); // crece
        alphaArr[i] = fade * pa[i];
      }

      // subir a GPU
      gl.uniform2f(uRes, cssW, cssH);
      gl.uniform1f(uDpr, dpr);
      gl.uniform3f(uColor, color[0], color[1], color[2]);

      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, posArr, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuf);
      gl.bufferData(gl.ARRAY_BUFFER, sizeArr, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(aSize);
      gl.vertexAttribPointer(aSize, 1, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, alphaBuf);
      gl.bufferData(gl.ARRAY_BUFFER, alphaArr, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(aAlpha);
      gl.vertexAttribPointer(aAlpha, 1, gl.FLOAT, false, 0, 0);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.POINTS, 0, MAX);

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", mouseHandler);
      window.removeEventListener("touchmove", touchHandler);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(posBuf);
      gl.deleteBuffer(sizeBuf);
      gl.deleteBuffer(alphaBuf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}
