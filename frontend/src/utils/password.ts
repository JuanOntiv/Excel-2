// Política de fortaleza de contraseña, espejo de la validación del backend
// (app/utils/password.py). El backend es la fuente de verdad; esto es solo UX
// para dar feedback inmediato antes de enviar el formulario.

export const PASSWORD_REQUIREMENTS =
  "Mínimo 8 caracteres, con al menos una mayúscula, un número y un símbolo.";

export interface PasswordCheck {
  label: string;
  met: boolean;
}

/** Lista de requisitos individuales, para mostrar como checklist en vivo. */
export function getPasswordChecks(password: string): PasswordCheck[] {
  return [
    { label: "Al menos 8 caracteres", met: password.length >= 8 },
    { label: "Una mayúscula", met: /[A-Z]/.test(password) },
    { label: "Un número", met: /[0-9]/.test(password) },
    { label: "Un símbolo", met: /[^A-Za-z0-9]/.test(password) },
  ];
}

/**
 * Devuelve un mensaje de error si la contraseña no cumple la política, o null
 * si es válida.
 */
export function validatePasswordStrength(password: string): string | null {
  const problems = getPasswordChecks(password)
    .filter((c) => !c.met)
    .map((c) => c.label.charAt(0).toLowerCase() + c.label.slice(1));

  if (problems.length === 0) return null;
  return "La contraseña debe tener " + problems.join(", ") + ".";
}
