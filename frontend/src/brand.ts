/**
 * Identidad de la app. Única fuente de verdad para el nombre: lo consumen tanto la
 * UI (<Wordmark /> en components/brand/Logo.tsx) como el <title> de index.html, que
 * se inyecta en build desde vite.config.ts.
 *
 * IMPORTANTE: este archivo lo importa vite.config.ts, que se ejecuta en Node fuera
 * del bundle de la app. Debe quedarse sin imports — nada de React, de assets (.png,
 * .css) ni de nada específico del navegador, o el config deja de poder cargarlo.
 * Por eso LOGO_SRC vive en Logo.tsx y no aquí: depende de un import de asset de Vite.
 */
export const APP_NAME = "FINSY";
