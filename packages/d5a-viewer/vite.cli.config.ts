import { defineConfig } from 'vite'

export default defineConfig({
  publicDir: false,
  build: {
    lib: {
      entry: 'src/cli/main.ts',
      formats: ['es'],
    },
    outDir: 'dist-cli',
    emptyOutDir: true,
    target: 'node22',
    sourcemap: true,
    minify: true,
    rolldownOptions: {
      platform: 'node',
      external: [/^node:/],
      output: {
        entryFileNames: 'd5-tool.mjs',
        format: 'es',
      },
    },
  },
})
