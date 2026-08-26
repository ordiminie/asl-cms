import {expect, Page, test} from '@playwright/test'

/**
 * Programme d'affiliation, de bout en bout.
 *
 * Ce que les tests unitaires ne peuvent pas prouver : le cookie est bien posé
 * par le proxy sur une page prerendue, la règle first-touch tient au niveau
 * HTTP, et l'attribution remonte jusqu'au tableau de bord de l'affilié après
 * un vrai parcours d'inscription.
 */

const login = async (page: Page, email: string) => {
  await page.goto('/en/login')
  await expect(page.locator('form')).toBeVisible()
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', 'Azerty123')
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.toString().includes('/login'), {
    timeout: 15_000,
  })
}

const readReferralCookie = async (page: Page) => {
  const cookies = await page.context().cookies()
  return cookies.find((cookie) => cookie.name === 'ref')
}

test.describe('Capture du ref par le proxy', () => {
  test('un lien affilié pose un cookie HttpOnly', async ({page}) => {
    await page.goto('/en?ref=mike-e2e')

    const cookie = await readReferralCookie(page)
    expect(cookie?.value).toBe('mike-e2e')
    // HttpOnly : le cookie ne doit pas être lisible en JS. C'est ce qui le
    // soustrait au plafond de sept jours imposé aux cookies posés par script.
    expect(cookie?.httpOnly).toBe(true)
  })

  test('la casse est normalisée', async ({page}) => {
    await page.goto('/en?ref=MIKE-E2E')

    const cookie = await readReferralCookie(page)
    expect(cookie?.value).toBe('mike-e2e')
  })

  test('un ref invalide ne pose rien', async ({page}) => {
    await page.goto('/en?ref=pas%20un%20code!')

    expect(await readReferralCookie(page)).toBeUndefined()
  })

  test('first-touch : le second lien ne remplace pas le premier', async ({
    page,
  }) => {
    await page.goto('/en?ref=premier-ref')
    await page.goto('/en?ref=second-ref')

    const cookie = await readReferralCookie(page)
    expect(cookie?.value).toBe('premier-ref')
  })

  test('la page reste servie normalement avec un ref', async ({page}) => {
    const response = await page.goto('/en?ref=mike-e2e')

    expect(response?.status()).toBe(200)
  })
})

test.describe('Espace affilié', () => {
  test('un utilisateur choisit son ref et obtient son lien', async ({page}) => {
    await login(page, 'user-owner@gmail.com')
    await page.goto('/en/account/affiliate')

    const codeInput = page.locator('input[name="code"]')
    await expect(codeInput).toBeVisible({timeout: 15_000})

    const code = `e2e-${Date.now().toString().slice(-8)}`
    await codeInput.fill(code)
    await page.click('button[type="submit"]')

    // Le lien complet apparaît une fois le ref enregistré.
    await expect(page.getByText(`?ref=${code}`)).toBeVisible({timeout: 15_000})
  })

  test('un ref invalide est refusé côté client', async ({page}) => {
    await login(page, 'user-owner@gmail.com')
    await page.goto('/en/account/affiliate')

    const codeInput = page.locator('input[name="code"]')
    await expect(codeInput).toBeVisible({timeout: 15_000})

    await codeInput.fill('Mike Codeur!')
    await page.click('button[type="submit"]')

    await expect(page.locator('form')).toContainText(/minuscule|lowercase/i)
  })

  test("l'espace affilié est refusé sans session", async ({page}) => {
    await page.goto('/en/account/affiliate')

    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Attribution complète', () => {
  test("une inscription avec code de parrainage est attribuée à l'affilié", async ({
    page,
  }) => {
    const code = `e2e-${Date.now().toString().slice(-8)}`

    // 1. L'affilié pose son ref.
    await login(page, 'user-owner@gmail.com')
    await page.goto('/en/account/affiliate')
    const codeInput = page.locator('input[name="code"]')
    await expect(codeInput).toBeVisible({timeout: 15_000})
    await codeInput.fill(code)
    await page.click('button[type="submit"]')
    await expect(page.getByText(`?ref=${code}`)).toBeVisible({timeout: 15_000})

    // Compteur avant l'inscription du filleul.
    const before = await page
      .getByText(/Referred accounts|Comptes parrainés/)
      .locator('xpath=following-sibling::*[1]')
      .textContent()

    // 2. Un filleul s'inscrit en saisissant ce code, depuis une session vierge.
    const guest = await page.context().browser()?.newContext()
    if (!guest) throw new Error('Contexte navigateur indisponible')
    const guestPage = await guest.newPage()

    await guestPage.goto('/en/register')
    await guestPage.click('button:has-text("Create account with email")')
    await expect(guestPage.locator('form')).toBeVisible()

    const email = `filleul-${Date.now()}@gmail.com`
    await guestPage.fill('input[name="name"]', 'Filleul E2E')
    await guestPage.fill('input[name="email"]', email)
    await guestPage.fill('input[name="password"]', 'TestPassword123!')
    await guestPage.fill('input[name="confirmPassword"]', 'TestPassword123!')
    await guestPage.fill('input[name="referralCode"]', code)
    await guestPage.click('button[type="submit"]')
    await guestPage.waitForTimeout(6000)
    await guest.close()

    // 3. L'affilié voit son compteur augmenter.
    await page.goto('/en/account/affiliate')
    const after = await page
      .getByText(/Referred accounts|Comptes parrainés/)
      .locator('xpath=following-sibling::*[1]')
      .textContent()

    expect(Number(after)).toBe(Number(before) + 1)
  })
})
