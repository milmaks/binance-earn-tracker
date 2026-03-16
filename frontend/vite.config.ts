import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// GITHUB_PAGES_BASE is set by the Makefile / CI at build time.
// For local dev it stays "/"; for GH Pages it becomes "/binance-earn-tracker/".
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES_BASE ?? '/',
})
