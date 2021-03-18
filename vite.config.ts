import { defineConfig } from 'vite';
import reactRefresh from '@vitejs/plugin-react-refresh';

// https://vitejs.dev/config/
export default defineConfig({
  esbuild: {
    jsxInject: `import * as React from 'react';`,
  },
  plugins: [reactRefresh()],
});
