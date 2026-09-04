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
        // Segunda entrada além da SPA autenticada (index.html/src/main.tsx): a página
        // pública do Link de Pedido (pedido.html/src/publicCatalog/main.tsx). Ver
        // firebase.json pro rewrite de Hosting que serve /pedido/** com este bundle.
        input: {
          main: path.resolve(__dirname, 'index.html'),
          pedido: path.resolve(__dirname, 'pedido.html'),
        },
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
            // Mesmo motivo: só é buscado via import() dinâmico dentro de localLlmService.ts
            // (provedor "IA local"), quando o usuário realmente carrega um modelo .gguf. Se
            // caísse no chunk 'vendor' genérico (compartilhado com libs usadas eager), o
            // Vite injetaria modulepreload dele no boot pra TODO usuário — ~300KB só de JS,
            // sem nenhum dos que nunca tocam nesse recurso precisar baixar.
            if (id.includes('@wllama/wllama')) return 'vendor-wllama';
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
