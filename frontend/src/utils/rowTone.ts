// Fondo semitransparente cíclico por id: distingue filas de una misma lista/tabla entre sí, sutilmente.
const ROW_TONES = ["bg-accent/[0.15]", "bg-accent2/[0.15]", "bg-positive/[0.15]", "bg-negative/[0.15]"] as const;

// Mismo ciclo de colores pero sólido, para usar como punto/círculo identificador.
const DOT_TONES = ["bg-accent", "bg-accent2", "bg-positive", "bg-negative"] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function rowToneForId(id: string): string {
  return ROW_TONES[hashString(id) % ROW_TONES.length];
}

export function dotToneForId(id: string): string {
  return DOT_TONES[hashString(id) % DOT_TONES.length];
}
