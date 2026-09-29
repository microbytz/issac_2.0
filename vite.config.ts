import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      tailwindcss(),
      {
        name: 'strip-large-inline-sourcemaps',
        enforce: 'post',
        transform(code, id) {
          if (id.includes('/src/') && (id.endsWith('.tsx') || id.endsWith('.ts'))) {
            return { code, map: { mappings: '' } as any };
          }
        },
      },
    ],
    esbuild: {
      jsx: 'automatic',
      jsxDev: false,
      sourcemap: false,
      minifyWhitespace: true,
      minifySyntax: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('recharts') || id.includes('d3')) {
                return 'vendor-charts';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('motion') || id.includes('framer-motion')) {
                return 'vendor-motion';
              }
              if (id.includes('jspdf') || id.includes('html2canvas')) {
                return 'vendor-pdf';
              }
              if (id.includes('react-markdown') || id.includes('remark') || id.includes('unified') || id.includes('micromark')) {
                return 'vendor-markdown';
              }
              if (id.includes('react-dom') || id.includes('/react/')) {
                return 'vendor-react';
              }
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
