import {describe, expect, it, vi} from 'vitest'

import {render, screen} from '@/__tests__/customRender'

vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(),
  setRequestLocale: vi.fn(),
}))
vi.mock('@/app/dal/tenant-dal', () => ({
  requireCurrentTenantDal: vi.fn(async () => ({
    id: 'org-1',
    name: 'ASL Les Pins',
    slug: 'asl-les-pins',
    domain: 'asl-les-pins.test',
    enabledModules: [],
    logoKey: null,
    faviconKey: null,
  })),
}))

import AuthLayout from './layout'

describe('AuthLayout — cadre des écrans de connexion', () => {
  it('porte l’identité de l’association du domaine appelé en en-tête', async () => {
    render(await AuthLayout({children: <p>contenu</p>}))

    const header = screen.getByRole('banner')
    expect(header).toHaveTextContent('ASL Les Pins')
    expect(
      screen.getByRole('img', {
        name: /Monogramme de l.association ASL Les Pins/,
      })
    ).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('contenu')
  })
})
