import { defineConfig } from 'vite'

export default defineConfig({
  // './' keeps asset URLs relative so dist/ works from any sub-path
  // (GitHub Pages project sites, S3 subfolders, Nginx aliases, etc.)
  base: './',
  publicDir: 'public',
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    cssMinify: true,
  },
  preview: {
    port: 4173,
    strictPort: false,
  },
})
