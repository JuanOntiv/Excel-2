import { useState } from "react";
import { PiggyBank } from "lucide-react";
import logoUrl from "./logo.png";
import { APP_NAME } from "../../brand";

/**
 * URL del logo. Se importa como módulo (no como ruta suelta "/logo.png") porque
 * el archivo vive en src/, y Vite solo sirve por URL directa lo que está en public/.
 * Al importarlo, Vite lo procesa: le añade hash de contenido para cache-busting y
 * rompe el build si el archivo se renombra, en vez de fallar en silencio en runtime.
 * Para cambiar el logo: reemplaza src/components/brand/logo.png (o ajusta el import
 * si cambias de extensión). El resto de la app usa <Logo />, nunca esta constante.
 */
export const LOGO_SRC = logoUrl;

type LogoProps = {
  /** Lado del cuadro en px (el logo es cuadrado en todos los usos actuales). */
  size?: number;
  className?: string;
};

/**
 * Logo de la marca. `onError` cae al icono de lucide que se usaba antes para que
 * la UI nunca quede con una imagen rota (archivo corrupto, fallo de red al pedir
 * el asset). Con el import estático el caso "archivo inexistente" ya no llega a
 * runtime: revienta el build.
 */
export function Logo({ size = 36, className = "" }: LogoProps) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };

  if (failed) {
    return (
      <div
        style={box}
        className={`rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0 ${className}`}
      >
        <PiggyBank size={Math.round(size * 0.55)} />
      </div>
    );
  }

  return (
    <img
      src={LOGO_SRC}
      alt={APP_NAME}
      style={box}
      onError={() => setFailed(true)}
      className={`rounded-lg object-contain shrink-0 ${className}`}
    />
  );
}

/**
 * Nombre de la app como logotipo. Existe para que la tipografía de marca
 * (`font-brand` → Fraunces, ver --font-brand en index.css) se defina en un solo sitio:
 * antes cada pantalla repetía el mismo <span> y cambiar la fuente pedía tocar cuatro archivos.
 *
 * Peso Regular (400), no Bold: a diferencia de una sans display, en una serif con
 * el contraste de trazo de Fraunces el bold engrosa demasiado a este tamaño y pierde
 * elegancia; Regular ya se distingue del resto de la UI (que es --font-sans) sin ese efecto.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`font-brand font-normal text-lg ${className}`}>{APP_NAME}</span>;
}
