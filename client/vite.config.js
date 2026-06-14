import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

// Recreate the __dirname variable for modern ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // We use path.resolve to force Vite to look in the exact absolute project folder!
      '@mediapipe/hands': path.resolve(__dirname, 'src/mediapipe-mock.js')
    }
  }
})