import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          // Separa bibliotecas grandes de terceiros em chunks próprios — cacheáveis
          // pelo navegador entre deploys (raramente mudam) e fora do bundle principal.
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react';
            // leaflet/react-leaflet chamam React.createContext() assim que o módulo carrega
            // (fora de qualquer componente) — se caírem no chunk genérico 'vendor' junto com
            // dezenas de libs usadas fora da tela de Entregas, esse chunk vira parte do
            // caminho eager e o createContext roda antes do React estar disponível (tela
            // branca no boot, "Cannot read properties of undefined (reading 'createContext')"
            // — reproduzido no Android em 24/07/2026). Chunk próprio garante que só carrega
            // quando a tela de Entregas (lazy) realmente precisar dele.
            if (id.includes('/leaflet/') || id.includes('react-leaflet')) return 'vendor-leaflet';
            // Mesmo motivo do leaflet acima: maplibre-gl só é usado pelo modo 3D do mapa de
            // Entregas (import lazy) — misturado no chunk 'vendor' genérico, vira ~1MB extra
            // carregado eager por QUALQUER tela, mesmo quem nunca abre o modo 3D.
            if (id.includes('maplibre-gl')) return 'vendor-maplibre';
            if (id.includes('/firebase/') || id.includes('@firebase/')) return 'vendor-firebase';
            if (id.includes('/motion/') || id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('html-to-image')) return 'vendor-pdf';
            if (id.includes('date-fns')) return 'vendor-date';
            return 'vendor';
          },
        },
      },
    },
  };
});
