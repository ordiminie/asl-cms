/* eslint-disable no-restricted-properties -- une spec e2e tourne hors de
   l'application : le fichier env.ts typé n'y est pas chargé. */
import {APIRequestContext, Browser, expect, Page, test} from '@playwright/test'

/**
 * Identité d'une association — s01b, critères 1 à 8.
 *
 * Ce que seuls un navigateur et deux domaines prouvent : l'affichage sur le
 * site public, l'isolation par domaine, le refus d'accès en interface **et**
 * sur l'appel direct de l'action serveur, l'erreur qui conserve l'ancien logo.
 *
 * Deux hôtes du loopback, deux associations du seed (voir
 * `tenant-isolation.spec.ts`) : `localhost` sert TechCorp Solutions,
 * `127.0.0.1` sert Marketing Pro. Une session est propre à un hôte.
 *
 * Aucun binaire commité : les fichiers sont fabriqués en mémoire. Seule leur
 * signature compte pour le serveur, qui juge le format sur le contenu.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'
const TENANT_A = `http://localhost:${PORT}`
const TENANT_A_NAME = 'TechCorp Solutions'
const TENANT_B = `http://127.0.0.1:${PORT}`

const PASSWORD = 'Azerty123'
const IDENTITY_PAGE = '/fr/bureau/identite'
const DENIED_TITLE = "Cette page est réservée au bureau de l'association"
const PAGE_TITLE = "Identité de l'association"

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const ICO_SIGNATURE = [0x00, 0x00, 0x01, 0x00]
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff, 0xe0]

/** Un fichier dont la signature est celle du format, suivie d'un marqueur unique. */
const fileWith = (signature: number[], marker: string) =>
  Buffer.concat([
    Buffer.from(signature),
    Buffer.from(`${marker}-${Date.now()}`),
  ])

const login = async (page: Page, base: string, email: string) => {
  await page.goto(`${base}/fr/login`)
  await expect(page.locator('form')).toBeVisible()
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.toString().includes('/login'), {
    timeout: 15_000,
  })
}

const newSession = async (browser: Browser, base: string, email: string) => {
  const page = await browser.newPage()
  await login(page, base, email)
  return page
}

type CapturedAction = {
  nextAction: string
  contentType: string
  body: string
}

/**
 * Chromium n'expose pas le corps d'une requête qui transporte un fichier :
 * `postDataBuffer()` y rend null, et le rejeu partirait sur un formulaire vide
 * que le serveur ne sait pas lire. Le corps est donc capté dans la page, en
 * enveloppant fetch avant le téléversement. À installer avant la navigation.
 */
const installActionCapture = async (page: Page) => {
  await page.addInitScript(() => {
    const store: {value: CapturedAction | null} = {value: null}
    ;(window as unknown as {__actionCapture: typeof store}).__actionCapture =
      store

    const toBase64 = (bytes: Uint8Array) => {
      let binary = ''
      for (let index = 0; index < bytes.length; index += 8192) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 8192))
      }
      return btoa(binary)
    }

    const original = window.fetch
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        // Une copie sert la capture ; la requête envoyée reste intacte.
        const copy =
          input instanceof Request && !init?.body
            ? input.clone()
            : init?.body instanceof FormData
              ? // Sans les en-têtes d'origine : la copie calcule sa propre
                // frontière multipart, cohérente avec son corps.
                new Request('http://capture.invalid', {
                  method: 'POST',
                  body: init.body,
                })
              : null
        const nextAction =
          copy &&
          (new Headers(init?.headers).get('next-action') ??
            copy.headers.get('next-action'))
        if (copy && nextAction) {
          store.value = {
            nextAction,
            contentType: copy.headers.get('content-type') ?? '',
            body: toBase64(new Uint8Array(await copy.arrayBuffer())),
          }
        }
      } catch {
        // Une capture ratée ne doit jamais empêcher l'envoi réel.
      }
      return original(input, init)
    }
  })
}

/** Rend le corps capté, décodé, une fois l'appel d'action parti. */
const readCapturedAction = async (page: Page) => {
  const handle = await page.waitForFunction(
    () =>
      (window as unknown as {__actionCapture?: {value: CapturedAction | null}})
        .__actionCapture?.value ?? null,
    undefined,
    {timeout: 15_000}
  )
  const captured = await handle.jsonValue()
  if (!captured) {
    throw new Error("Le corps de l'appel d'action n'a pas été capté")
  }
  return {
    nextAction: captured.nextAction,
    contentType: captured.contentType,
    body: Buffer.from(captured.body, 'base64'),
  }
}

const identityBytes = async (
  request: APIRequestContext,
  base: string,
  kind: 'logo' | 'favicon'
) => {
  const response = await request.get(`${base}/api/identity/${kind}`)
  return {
    status: response.status(),
    headers: response.headers(),
    body: await response.body(),
  }
}

const openIdentityPage = async (page: Page, base: string) => {
  await page.goto(`${base}${IDENTITY_PAGE}`, {waitUntil: 'load'})
  await expect(
    page.getByRole('heading', {level: 1, name: PAGE_TITLE})
  ).toBeVisible({timeout: 15_000})
}

/** Téléverse un fichier et attend le départ de l'appel d'action serveur. */
const uploadIdentityFile = async (
  page: Page,
  kind: 'logo' | 'favicon',
  name: string,
  mimeType: string,
  buffer: Buffer
) => {
  const actionRequest = page.waitForRequest(
    (request) =>
      request.method() === 'POST' && Boolean(request.headers()['next-action'])
  )
  await page
    .getByTestId(`identity-file-input-${kind}`)
    .setInputFiles({name, mimeType, buffer})
  await actionRequest
}

test.describe.serial('s01b — identité de l’association', () => {
  const logoA = fileWith(PNG_SIGNATURE, 'logo-techcorp')
  const firstLogoA = fileWith(PNG_SIGNATURE, 'premier-logo-techcorp')
  const logoB = fileWith(PNG_SIGNATURE, 'logo-marketing-pro')
  const faviconB = fileWith(ICO_SIGNATURE, 'favicon-marketing-pro')

  /** L'appel de l'action d'un vrai téléversement, rejoué par d'autres comptes. */
  let capturedAction: {
    nextAction: string
    contentType: string
    body: Buffer
  }

  test('critère 8 — sans session, l’espace bureau renvoie à la connexion', async ({
    page,
  }) => {
    await page.goto(`${TENANT_A}${IDENTITY_PAGE}`)

    await expect(page).toHaveURL(/\/login/)
  })

  test('critères 1 et 3 — la présidente téléverse un logo, visible sur le site public', async ({
    browser,
  }) => {
    const page = await newSession(browser, TENANT_A, 'user-owner@gmail.com')
    await installActionCapture(page)
    await openIdentityPage(page, TENANT_A)

    await uploadIdentityFile(page, 'logo', 'logo.png', 'image/png', firstLogoA)
    await expect(page.getByText(/Logo remplacé/)).toBeVisible({
      timeout: 15_000,
    })
    capturedAction = await readCapturedAction(page)
    expect(capturedAction.body.byteLength).toBeGreaterThan(
      firstLogoA.byteLength
    )
    expect(capturedAction.contentType).toContain('multipart/form-data')

    // Remplacer met à jour le site sans redéploiement.
    await openIdentityPage(page, TENANT_A)
    await uploadIdentityFile(page, 'logo', 'logo.png', 'image/png', logoA)
    await expect(page.getByText(/Logo remplacé/)).toBeVisible({
      timeout: 15_000,
    })

    await page.goto(`${TENANT_A}/fr/privacy`, {waitUntil: 'load'})
    const headerLogo = page
      .getByRole('banner')
      .getByRole('img', {name: `Logo de l'association ${TENANT_A_NAME}`})
    await expect(headerLogo).toBeVisible()
    const src = await headerLogo.getAttribute('src')
    expect(src).toMatch(/^\/api\/identity\/logo\?v=/)

    const served = await page.request.get(`${TENANT_A}${src}`)
    expect(served.status()).toBe(200)
    expect(Buffer.compare(await served.body(), logoA)).toBe(0)

    await page.close()
  })

  test('critère 2 — un JPEG est refusé, le logo actuel reste en place', async ({
    browser,
  }) => {
    const page = await newSession(browser, TENANT_A, 'user-owner@gmail.com')
    await openIdentityPage(page, TENANT_A)
    // La barre laterale porte le meme logo : l'apercu se cherche dans la carte.
    const logoPreview = page
      .locator('[data-slot="card"]')
      .filter({has: page.getByTestId('identity-file-input-logo')})
      .getByRole('img', {name: `Logo de l'association ${TENANT_A_NAME}`})
    const previewBefore = await logoPreview.getAttribute('src')

    await uploadIdentityFile(
      page,
      'logo',
      'photo.jpg',
      'image/jpeg',
      fileWith(JPEG_SIGNATURE, 'photo')
    )

    const alert = page.getByRole('alert').filter({hasText: 'JPEG'})
    await expect(alert).toBeVisible({timeout: 15_000})
    await expect(alert).toContainText("Ce fichier n'a pas été enregistré.")
    await expect(alert).toContainText('Le logo actuel est conservé.')
    await expect(logoPreview).toHaveAttribute('src', previewBefore ?? '')

    const served = await identityBytes(page.request, TENANT_A, 'logo')
    expect(Buffer.compare(served.body, logoA)).toBe(0)

    await page.close()
  })

  test('critères 5 et 6 — le bureau d’une autre association téléverse logo et favicon sur son domaine', async ({
    browser,
  }) => {
    const page = await newSession(browser, TENANT_B, 'user-admin@gmail.com')
    await openIdentityPage(page, TENANT_B)

    await uploadIdentityFile(page, 'logo', 'logo.png', 'image/png', logoB)
    await expect(page.getByText(/Logo remplacé/)).toBeVisible({
      timeout: 15_000,
    })
    await uploadIdentityFile(
      page,
      'favicon',
      'favicon.ico',
      'image/x-icon',
      faviconB
    )
    await expect(page.getByText(/Favicon remplacé/)).toBeVisible({
      timeout: 15_000,
    })

    await page.close()
  })

  test('critères 4, 5 et 6 — deux domaines, deux logos, deux favicons, jamais le fichier de l’autre', async ({
    request,
    page,
  }) => {
    const logoOnA = await identityBytes(request, TENANT_A, 'logo')
    const logoOnB = await identityBytes(request, TENANT_B, 'logo')
    expect(Buffer.compare(logoOnA.body, logoA)).toBe(0)
    expect(Buffer.compare(logoOnB.body, logoB)).toBe(0)
    expect(Buffer.compare(logoOnA.body, logoOnB.body)).not.toBe(0)

    const faviconOnA = await identityBytes(request, TENANT_A, 'favicon')
    const faviconOnB = await identityBytes(request, TENANT_B, 'favicon')
    expect(faviconOnA.status).toBe(200)
    expect(Buffer.compare(faviconOnB.body, faviconB)).toBe(0)
    expect(Buffer.compare(faviconOnA.body, faviconOnB.body)).not.toBe(0)
    expect(Buffer.compare(faviconOnA.body, logoOnA.body)).not.toBe(0)

    // La page déclare le favicon de la route, propre au domaine.
    for (const base of [TENANT_A, TENANT_B]) {
      await page.goto(`${base}/fr/privacy`, {waitUntil: 'load'})
      await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute(
        'href',
        /\/api\/identity\/favicon/
      )
    }

    // Un chemin forgé ne rend aucun fichier.
    for (const forged of [
      '/api/identity/logo%2F..%2F..%2Fetc%2Fpasswd',
      '/api/identity/..%2Flogo',
      '/api/identity/LOGO',
    ]) {
      const response = await request.get(`${TENANT_A}${forged}`)
      expect(response.status(), forged).toBe(404)
    }
  })

  test('critère 4 — le fichier servi porte nosniff et son vrai type', async ({
    request,
  }) => {
    const logo = await identityBytes(request, TENANT_A, 'logo')

    expect(logo.headers['x-content-type-options']).toBe('nosniff')
    expect(logo.headers['content-type']).toBe('image/png')
  })

  for (const email of ['user@gmail.com', 'admin@gmail.com']) {
    test(`critère 8 — ${email} voit l’écran de refus, et l’action serveur directe est refusée`, async ({
      browser,
    }) => {
      const page = await newSession(browser, TENANT_A, email)

      await page.goto(`${TENANT_A}${IDENTITY_PAGE}`, {waitUntil: 'load'})
      await expect(
        page.getByRole('heading', {level: 1, name: DENIED_TITLE})
      ).toBeVisible({timeout: 15_000})
      await expect(page.getByTestId('identity-file-input-logo')).toHaveCount(0)

      // Rejoue, sous cette session, l'appel d'action d'un vrai téléversement
      // de la présidente : le serveur doit refuser, le logo ne doit pas bouger.
      expect(capturedAction?.nextAction).toBeTruthy()
      const replay = await page.request.post(`${TENANT_A}${IDENTITY_PAGE}`, {
        headers: {
          'next-action': capturedAction.nextAction,
          'content-type': capturedAction.contentType,
          accept: 'text/x-component',
          origin: TENANT_A,
        },
        data: capturedAction.body,
      })
      expect(replay.status()).toBeLessThan(500)

      const served = await identityBytes(page.request, TENANT_A, 'logo')
      expect(Buffer.compare(served.body, logoA)).toBe(0)
      expect(Buffer.compare(served.body, firstLogoA)).not.toBe(0)

      await page.close()
    })
  }

  test('critère 8 — le SuperAdmin accède à la page de réglages', async ({
    browser,
  }) => {
    const page = await newSession(browser, TENANT_A, 'superadmin@gmail.com')

    await openIdentityPage(page, TENANT_A)
    await expect(page.getByTestId('identity-file-input-logo')).toHaveCount(1)

    await page.close()
  })
})
