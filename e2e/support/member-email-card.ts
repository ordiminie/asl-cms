import {expect, Page} from '@playwright/test'

/**
 * La carte « Adresses email » de la fiche du bureau (s54, écran 4), pilotée
 * comme un humain : « Gérer » sur la ligne, puis la fenêtre. Depuis s54,
 * l'adresse ne se saisit plus dans « Coordonnées ».
 */

export const ADDED = 'Adresse ajoutée : elle peut se connecter dès maintenant.'
export const REMOVED =
  'Adresse retirée : elle ne se connecte plus à cette fiche.'
export const BOARD_EMAIL_REFUSED =
  'L’adresse d’un membre du bureau ne se retire pas : modifiez-la.'

export const emailsCard = (page: Page) =>
  page.getByRole('region', {name: 'Adresses email'})

/** Le statut posé au-dessus du tableau après une écriture (4g). */
export const emailsNotice = (page: Page) => emailsCard(page).getByRole('status')

const manage = async (page: Page, email: string) => {
  await emailsCard(page)
    .getByRole('table')
    .getByRole('button', {name: `Gérer ${email}`})
    .click()
  return page.getByRole('dialog')
}

/**
 * « Ajouter une adresse » (4b). Une adresse déjà celle d'un autre compte
 * demande confirmation (4c) : `shared` la donne, avec le rôle choisi.
 */
export const addProfileEmail = async (
  page: Page,
  email: string,
  shared?: {role: 'additional' | 'holder'}
) => {
  await emailsCard(page)
    .getByRole('button', {name: 'Ajouter une adresse'})
    .click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Adresse email').fill(email)
  await dialog.getByRole('button', {name: 'Ajouter l’adresse'}).click()
  if (shared) {
    await expect(
      dialog.getByText(/Cette adresse est déjà celle du compte de/)
    ).toBeVisible({timeout: 15_000})
    if (shared.role === 'holder') {
      await dialog
        .getByRole('radio', {name: /Titulaire de cette fiche/})
        .click()
    }
    await dialog
      .getByRole('button', {name: 'Oui, ajouter à cette fiche'})
      .click()
  }
  await expect(dialog).toBeHidden({timeout: 15_000})
}

/** « Gérer » puis « Modifier l’adresse » : le rôle est gardé. */
export const replaceProfileEmail = async (
  page: Page,
  from: string,
  to: string
) => {
  const dialog = await manage(page, from)
  await dialog.getByLabel('Modifier l’adresse').fill(to)
  await dialog.getByRole('button', {name: 'Enregistrer l’adresse'}).click()
  await expect(dialog).toBeHidden({timeout: 15_000})
}

/**
 * « Gérer » puis « Retirer cette adresse » (4e, 4f). Une titulaire part avec
 * sa remplaçante, ou en courrier uniquement si c'est la dernière adresse
 * active. Rend la fenêtre de retrait, encore ouverte si le retrait est
 * refusé.
 */
export const removeProfileEmail = async (
  page: Page,
  email: string,
  replacement?: {existing: string} | {email: string}
) => {
  const dialog = await manage(page, email)
  await dialog.getByRole('button', {name: 'Retirer cette adresse'}).click()
  const confirm = page.getByRole('alertdialog')
  if (replacement && 'existing' in replacement) {
    await confirm.getByRole('radio', {name: replacement.existing}).click()
    await confirm.getByRole('button', {name: 'Retirer et remplacer'}).click()
  } else if (replacement) {
    await confirm.getByRole('radio', {name: 'Une nouvelle adresse'}).click()
    await confirm
      .getByLabel('Nouvelle adresse titulaire')
      .fill(replacement.email)
    await confirm.getByRole('button', {name: 'Retirer et remplacer'}).click()
  } else {
    const toMailOnly = confirm.getByRole('button', {
      name: 'Retirer, passer en courrier',
    })
    await (
      (await toMailOnly.count()) > 0
        ? toMailOnly
        : confirm.getByRole('button', {name: 'Retirer l’adresse'})
    ).click()
  }
  return confirm
}

/** « Gérer » puis « Désigner titulaire », confirmé (4d). */
export const designateHolder = async (page: Page, email: string) => {
  const dialog = await manage(page, email)
  await dialog.getByRole('button', {name: 'Désigner titulaire'}).click()
  await dialog.getByRole('button', {name: 'Désigner titulaire'}).click()
  await expect(dialog).toBeHidden({timeout: 15_000})
}
