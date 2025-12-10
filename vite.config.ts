import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  // We explicitly cast process to any here for the config file context, 
  // as tsconfig doesn't fully apply to vite.config.ts in some setups without ts-node.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
    // Define global constants replacement
    define: {
      // This ensures process.env.API_KEY is replaced by the actual string value during build
      'process.env.API_KEY': JSON.stringify(env.API_KEY || '')
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        }
      }
    }
  };
});