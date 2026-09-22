import {describe, expect, it} from 'vitest'

import {render, screen, userEvent} from '@/__tests__/customRender'
import {PublicMenuEntryDTO} from '@/services/types/domain/site-navigation-types'

import {PublicMobileMenu} from './public-mobile-menu'

const entry = (
  id: string,
  title: string,
  slug: string
): PublicMenuEntryDTO => ({id, title, slug})

const openMenu = async (entries: PublicMenuEntryDTO[]) => {
  render(<PublicMobileMenu entries={entries} />)
  await userEvent.click(screen.getByRole('button', {name: 'Ouvrir le menu'}))
}

describe('PublicMobileMenu — les entrees du bureau', () => {
  it('porte le menu du site, dans son ordre', async () => {
    await openMenu([
      entry('1', "Qualité de l'eau", 'qualite-de-leau'),
      entry('2', 'Adhérer', 'adherer'),
    ])

    const links = await screen.findAllByRole('menuitem')
    expect(links.map((link) => link.textContent)).toEqual([
      "Qualité de l'eau",
      'Adhérer',
      'Connexion',
    ])
    expect(
      screen.getByRole('menuitem', {name: "Qualité de l'eau"})
    ).toHaveAttribute('href', '/qualite-de-leau')
  })

  it('ne porte plus les liens de demonstration du socle', async () => {
    await openMenu([entry('1', "Qualité de l'eau", 'qualite-de-leau')])

    expect(screen.queryByRole('menuitem', {name: 'Confidentialité'})).toBeNull()
    expect(screen.queryByRole('menuitem', {name: 'Blog'})).toBeNull()
  })

  it('garde la connexion quand le menu est vide', async () => {
    await openMenu([])

    const links = await screen.findAllByRole('menuitem')
    expect(links.map((link) => link.textContent)).toEqual(['Connexion'])
  })
})
