import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

// Ports of their own, so a dev server already running on 8000/5173 is never
// reused by accident (it could be on live OpenSky data).
const API_PORT = 8765
const WEB_PORT = 4173

// The backend's virtualenv Python when there is one (local), else `python`
// (CI installs the backend into the runner's Python).
const venvPython =
  process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python'
// Absolute and quoted, because Windows' shell can't run a relative path.
const venvPath = resolve('../backend', venvPython)
const python = existsSync(venvPath) ? `"${venvPath}"` : 'python'

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    // Planes hop between polls instead of gliding, so they hold still for a
    // click, and the mascot's line appears at once.
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Mock flights and weather, whatever the local .env says.
      command: `${python} -m uvicorn app.main:app --port ${API_PORT}`,
      cwd: '../backend',
      env: {
        FLIGHT_SOURCE: 'mock',
        WEATHER_SOURCE: 'mock',
        CORS_ORIGINS: `http://localhost:${WEB_PORT}`,
      },
      url: `http://127.0.0.1:${API_PORT}/health`,
      reuseExistingServer: false,
    },
    {
      // The production build, in its own folder: it points at the test
      // backend, so it must not replace dist/.
      command: `npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port ${WEB_PORT} --strictPort`,
      env: { VITE_API_URL: `http://localhost:${API_PORT}` },
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
