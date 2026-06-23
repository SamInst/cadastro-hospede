import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Host da API usado no connect-src do CSP. Mantenha em sincronia com VITE_API_BASE_URL.
const API_BASE = 'https://saas-hotel-istoepousada-dc98593a88fc.herokuapp.com'

// CSP aplicada apenas no build de produção (no dev quebraria o HMR/inline do Vite).
// Observação: X-Frame-Options, X-Content-Type-Options e HSTS não podem ser definidos
// por <meta> — configure-os como cabeçalhos HTTP no host/CDN.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "img-src 'self' data:",
  'font-src https://fonts.gstatic.com',
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self'",
  `connect-src 'self' ${API_BASE}`,
  "form-action 'self'",
].join('; ')

function cspPlugin() {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml(html) {
      const tag = `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`
      return html.replace('</head>', `    ${tag}\n  </head>`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cspPlugin()],
})
