import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite";
import { APP_NAME } from './src/brand'


/**
 * Sustituye %APP_NAME% en index.html por el nombre definido en src/brand.ts, para
 * que el <title> no sea una copia manual que se olvida al renombrar la app.
 *
 * Se hace en build y no con document.title desde React a propósito: así el nombre
 * ya viene en el HTML servido, sin parpadeo de un título viejo mientras carga el JS
 * y visible para buscadores y previews de enlaces, que no ejecutan el bundle.
 */
function brandHtmlPlugin(): Plugin {
  return {
    name: "inject-brand-name",
    transformIndexHtml(html) {
      return html.replaceAll("%APP_NAME%", APP_NAME);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
	react(),
	tailwindcss(),
	brandHtmlPlugin(),
  ],
	server: {
	  host: true,
	  port: 3000,
	  allowedHosts: [
      	'validly-unglimpsed-dinah.ngrok-free.dev'
      ]
    },
})
