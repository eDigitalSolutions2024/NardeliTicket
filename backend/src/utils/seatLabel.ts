export function numToLetter(n: number): string {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return "";

  let s = "";
  let v = Math.floor(x);

  while (v > 0) {
    const r = (v - 1) % 26;
    s = String.fromCharCode(65 + r) + s; // 65 = 'A'
    v = Math.floor((v - 1) / 26);
  }

  return s;
}

/**
 * Extrae el número de "VIP-01" o "ORO-18" y lo convierte a letra: A, R, etc.
 * - Si no puede parsear, regresa null.
 */
export function tableLetterFromTableId(tableId?: string | null): string | null {
  if (!tableId) return null;
  const m = String(tableId).match(/-(\d+)\s*$/); // toma lo que está después del último "-"
  if (!m) return null;

  const num = parseInt(m[1], 10);
  if (!Number.isFinite(num) || num <= 0) return null;

  const letter = numToLetter(num);
  return letter || null;
}

/**
 * Convierte "VIP-01" -> "VIP-A" / "ORO-18" -> "ORO-R"
 * - Si no puede convertir, regresa el tableId original.
 */
export function tableLabelFromTableId(tableId?: string | null): string {
  if (!tableId) return "-";
  const raw = String(tableId);

  const parts = raw.split("-");
  const zone = parts[0] || raw;

  const letter = tableLetterFromTableId(raw);
  if (!letter) return raw;

  return `${zone}-${letter}`;
}

/**
 * Obtiene el seatLabel (A4, R2, etc.) a partir del payload del item.
 * - Usa seatLabels[] si viene (preferido).
 * - Si no viene, hace fallback a seatId (S324, etc.).
 */
export function seatLabelForHold(
  it: any,
  seatId: string,
  idx: number
): string {
  const labels = Array.isArray(it?.seatLabels) ? it.seatLabels : null;
  const label = labels?.[idx];
  if (typeof label === "string" && label.trim()) return label.trim();
  return String(seatId);
}
