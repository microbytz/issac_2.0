import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
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
      dedupe: ['react', 'react-dom', 'react-dom/client'],
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'lucide-react',
        'motion/react',
        'd3',
        'recharts',
        'react-markdown',
        'remark-gfm',
        'jspdf',
        '@capacitor/core',
      ],
    },
    build: {
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
                return 'vendor-react';
              }
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
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
