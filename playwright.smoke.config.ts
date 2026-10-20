import {defineConfig, devices} from '@playwright/test'

/**
 * Test de fumee contre le serveur deploye (s12b). Ni `webServer` ni seed : il
 * vise les domaines reels, passes en variables (`smoke/smoke-targets.ts`).
 *
 *     SMOKE_DOMAIN_A=… SMOKE_NAME_A=… SMOKE_DOMAIN_B=… SMOKE_NAME_B=… \
 *       SMOKE_UNKNOWN_DOMAIN=… pnpm test:smoke
 *
 * La suite e2e normale (`playwright.config.ts`, `testDir: './e2e'`) ne le
 * ramasse pas.
 */
export default defineConfig({
  testDir: './smoke',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    // Un certificat invalide doit faire echouer le test, jamais etre ignore.
    ignoreHTTPSErrors: false,
    trace: 'retain-on-failure',
  },
  projects: [{name: 'chromium', use: {...devices['Desktop Chrome']}}],
})
