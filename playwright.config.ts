/* eslint-disable no-restricted-properties */
import fs from 'node:fs'
import path from 'node:path'

import {defineConfig, devices} from '@playwright/test'
import dotenv from 'dotenv'

// Port configurable : permet de lancer la suite quand 3000 est déjà pris
const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
const BASE_URL = `http://localhost:${PORT}`

// `pnpm start` charge .env.production. Or deux specs créent un compte et une
// autre lit le seed : lancées en local, elles écriraient dans la base de
// production. On impose donc la DATABASE_URL de .env.test au serveur sous test.
// En CI, DATABASE_URL est déjà celle du Postgres éphémère du job et gagne.
const testEnvPath = path.resolve(process.cwd(), '.env.test')
const testDatabaseUrl = fs.existsSync(testEnvPath)
  ? dotenv.parse(fs.readFileSync(testEnvPath)).DATABASE_URL
  : undefined

const webServerEnv = process.env.DATABASE_URL
  ? undefined
  : testDatabaseUrl && {DATABASE_URL: testDatabaseUrl}

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: BASE_URL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']},
    },

    {
      name: 'firefox',
      use: {...devices['Desktop Firefox']},
    },

    {
      name: 'webkit',
      use: {...devices['Desktop Safari']},
    },
  ],

  /*
   * En CI on teste le build de production : le shell statique et le streaming
   * ne se comportent pas comme en dev, et c'est précisément ce que ces tests
   * doivent protéger pendant la migration Cache Components.
   */
  webServer: {
    command: process.env.CI
      ? `pnpm build && pnpm start --port ${PORT}`
      : `pnpm dev --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    ...(webServerEnv ? {env: webServerEnv} : {}),
  },
})
