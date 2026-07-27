// El bloqueo por onKeyDown no es suficiente: Firefox permite escribir letras
// en un <input type="number"> igual (solo lo marca inválido al enviar), y
// ninguno de los dos navegadores filtra el pegado. Por eso se sanea el valor
// en cada cambio en vez de intentar bloquear teclas.

/** Deja solo dígitos y un único separador decimal (punto o coma); todo lo demás (letras, +, -, e, separadores extra) se descarta. */
export function sanitizeAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.,]/g, "");
  const separatorIndex = cleaned.search(/[.,]/);
  if (separatorIndex === -1) return cleaned;
  const whole = cleaned.slice(0, separatorIndex).replace(/[.,]/g, "");
  const separator = cleaned[separatorIndex];
  const rest = cleaned.slice(separatorIndex + 1).replace(/[.,]/g, "");
  return whole + separator + rest;
}

/** Convierte un valor saneado por sanitizeAmountInput a número, aceptando coma o punto como separador decimal. */
export function parseAmountInput(value: string): number {
  return parseFloat(value.replace(",", "."));
}
