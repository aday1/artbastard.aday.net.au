import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// WebSocket fallback ports to try if default fails
const WS_FALLBACK_PORTS = [3000, 3001, 8080, 8081]
const MAX_RETRIES = 3
const RETRY_DELAY = 2000

// Check if we're skipping type checking
const skipTypeChecking = !!process.env.SKIP_TYPECHECKING

// Cross-platform rollup configuration
// Only force JS fallback if native binaries are explicitly unavailable
if (process.env.FORCE_ROLLUP_JS_FALLBACK === 'true') {
  process.env.ROLLUP_NO_NATIVE = 'true'
  process.env.ROLLUP_NO_WASM = 'true'
}

// Suppress Sass deprecation warnings
process.env.SASS_SILENCE_DEPRECATIONS = 'legacy-js-api'

// Suppress NPM warnings
process.env.NPM_CONFIG_OPTIONAL = 'false'

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: []
      }
    })
  ],  // Add better error handling for development
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
    sourcemap: true, // Enable source maps in esbuild
    keepNames: true // Keep function and class names for better stack traces
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'framer-motion': resolve(__dirname, 'node_modules/framer-motion/dist/cjs/index.js'),
    },
  },  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern', // Use modern Sass API
        quietDeps: true, // Suppress warnings from Sass dependencies
        silenceDeprecations: ['legacy-js-api'], // Silence specific deprecation warnings
        logger: {
          warn: function(message: string) {
            // Suppress legacy JS API warnings
            if (message.includes('legacy-js-api') || 
                message.includes('legacy JS API') ||
                message.includes('deprecated and will be removed')) {
              return;
            }
            console.warn(message);
          }
        }
      },
    },
    modules: {
      localsConvention: 'camelCase'
    }
  },
  optimizeDeps: {
    include: ['framer-motion'],
    esbuildOptions: {
      // tsconfigRaw is correctly typed here, ensure your Vite version supports this structure
      // For older versions, this might need adjustment or removal if it causes type errors.
      tsconfigRaw: skipTypeChecking ? 
        { compilerOptions: { jsx: 'react-jsx' } } : // Simplified, ensure `skipLibCheck` and `strict` are not needed or handled elsewhere
        undefined
    },
    // Force Rollup to avoid native dependencies - fixes @rollup/rollup-win32-x64-msvc error
    exclude: ['@rollup/rollup-win32-x64-msvc']  },  build: {
    minify: false, // Disabled minification for better debugging
    // terserOptions removed since minification is disabled
    sourcemap: true, // Enable source maps for better debugging
    reportCompressedSize: !skipTypeChecking,
    rollupOptions: {
      // Force Rollup to use JavaScript fallback instead of native binaries
      external: (id) => {
        if (id === 'hls.js' || id.startsWith('hls.js/')) return true;
        if (id.includes('@rollup/rollup-win32-x64-msvc') || 
            id.includes('@rollup/rollup-linux-x64-gnu') ||
            id.includes('@rollup/rollup-darwin-x64') ||
            id.includes('@rollup/rollup-darwin-arm64')) {
          return false;
        }
        return false;
      },
      ...(skipTypeChecking ? {
        onwarn(warning, warn) {
          if (warning.code === 'THIS_IS_UNDEFINED' || 
              warning.code === 'MODULE_LEVEL_DIRECTIVE' ||
              warning.message.includes('Use of eval') ||
              warning.message.includes('@rollup/rollup-') ||
              warning.message.includes('referenced in') ||
              warning.message.includes("didn't resolve at build time")) {
            return;
          }
          warn(warning);
        }
      } : {})
    },
    // Suppress warnings about unresolved public assets
    assetsInlineLimit: 0, // Don't inline any assets
    copyPublicDir: true, // Ensure public directory is copied
  },  server: {
    port: 3001,
    host: '0.0.0.0', // Allow network access
    strictPort: false,
    // Add error handling for the dev server
    hmr: {
      overlay: true // Show errors as overlay
    },
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3030', // Changed from 3000 to 3030
        ws: true,
        secure: false,
        changeOrigin: true,
        rewrite: (path) => path,
        configure: (proxy, _options) => {
          proxy.on('error', (err, req, res) => {
            if (err.message.includes('ECONNREFUSED')) {
              // Log a less verbose message for connection refused errors
              console.warn(`[VITE PROXY WARN] Backend not reachable for ${req.url} (ECONNREFUSED). Ensure backend is running on port 3030.`); // Port reference updated
              // Avoid crashing the Vite server by not re-throwing or sending a 500 if res is available
              if (res && !res.headersSent && typeof res.writeHead === 'function') {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Proxy error: Service unavailable. Backend may be down.' }));
              }
            } else {
              console.error(`[VITE PROXY ERROR] ${req.url}:`, err);
            }
          });
        }
      },
      // Proxy for /health endpoint, with similar simplified error handling
      '/health': {
        target: 'http://localhost:3030', // Changed from 3000 to 3030
        secure: false,
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, req, res) => {
            if (err.message.includes('ECONNREFUSED')) {
              console.warn(`[VITE PROXY WARN] /health endpoint not reachable (ECONNREFUSED).`);
              if (res && !res.headersSent && typeof res.writeHead === 'function') {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Proxy error: /health service unavailable.' }));
              }
            } else {
              console.error(`[VITE PROXY ERROR] /health:`, err);
            }
          });
        }
      },
      // General API proxy, if your app uses other /api/... routes
      '/api': {
        target: 'http://localhost:3030', // Changed from 3000 to 3030
        secure: false,
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, req, res) => {
            if (err.message.includes('ECONNREFUSED')) {
              console.warn(`[VITE PROXY WARN] API endpoint ${req.url} not reachable (ECONNREFUSED).`);
              if (res && !res.headersSent && typeof res.writeHead === 'function') {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Proxy error: API service unavailable.' }));
              }
            } else {
              console.error(`[VITE PROXY ERROR] ${req.url}:`, err);
            }
          });
        }      }
    }
  }
});