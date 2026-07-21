// El bloqueo por onKeyDown no es suficiente: Firefox permite escribir letras
// en un <input type="number"> igual (solo lo marca inválido al enviar), y
// ninguno de los dos navegadores filtra el pegado. Por eso se sanea el valor
// en cada cambio en vez de intentar bloquear teclas.

/** Deja solo dígitos y un único punto decimal; todo lo demás (letras, +, -, e, puntos extra) se descarta. */
export function sanitizeAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  if (rest.length === 0) return whole;
  return whole + "." + rest.join("");
}
