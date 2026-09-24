import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
/**
 * `getTranslations` est double par le **vrai** formateur de next-intl
 * (`createTranslator`), pas par une substitution de `{cle}` : sans lui, un
 * pluriel ICU serait rendu tel quel et le test ne prouverait rien de la phrase
 * reellement lue.
 */
vi.mock('next-intl/server', async () => {
  const {createTranslator} = await import('next-intl')
  const messages = (await import('../../../../../messages/fr.json')).default

  // `createTranslator` type son espace de noms sur les messages du projet ;
  // ici il est recu en chaine, comme `getTranslations` le recoit de la page.
  const translatorFor = createTranslator as unknown as (options: {
    locale: string
    messages: typeof messages
    namespace: string
  }) => (key: string, values?: Record<string, unknown>) => string

  return {
    getTranslations: async (namespace: string) =>
      translatorFor({locale: 'fr', messages, namespace}),
    setRequestLocale: vi.fn(),
  }
})
vi.mock('@/app/dal/tenant-dal', () => ({
  requireCurrentTenantDal: vi.fn(async () => ({id: 'org-1'})),
}))
vi.mock('@/app/dal/board-member-dal', () => ({
  getPublicBoardMembersDal: vi.fn(),
  boardMemberPhotoUrl: (key: string) => `/api/files/${key}`,
}))
vi.mock('@/app/dal/association-settings-dal', () => ({
  getAssociationSettingsDal: vi.fn(),
}))

import {render, screen, within} from '@/__tests__/customRender'
import {getAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {getPublicBoardMembersDal} from '@/app/dal/board-member-dal'
import {ASSOCIATION_MEMBER_COUNT_SETTING_KEY} from '@/services/types/domain/association-settings-types'
import {BoardMemberDTO} from '@/services/types/domain/board-member-types'

import PublicBoardPage from './page'

const member = (overrides: Partial<BoardMemberDTO> = {}): BoardMemberDTO => ({
  id: 'm1',
  organizationId: 'org-1',
  name: 'Claire Besson',
  roleLabel: 'Présidente',
  photoKey: 'org-1/board/m1/photo-1.webp',
  biography: 'Présidente depuis 2022.',
  rank: 0,
  ...overrides,
})

const settingsWith = (value: number | null) => ({
  [ASSOCIATION_MEMBER_COUNT_SETTING_KEY]: {
    value,
    storedValue: value === null ? null : String(value),
    defaultFromKey: null,
  },
})

const renderPage = async () =>
  render(await PublicBoardPage({params: Promise.resolve({locale: 'fr'})}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAssociationSettingsDal).mockResolvedValue(
    settingsWith(412) as never
  )
  vi.mocked(getPublicBoardMembersDal).mockResolvedValue([member()])
})

describe('/le-bureau — page publique', () => {
  it('rend les fiches dans l’ordre reçu', async () => {
    vi.mocked(getPublicBoardMembersDal).mockResolvedValue([
      member({id: 'm1', name: 'Claire Besson', rank: 0}),
      member({id: 'm2', name: 'Michel Arnaud', rank: 1}),
      member({id: 'm3', name: 'Sylvie Renard', rank: 2}),
    ])

    const {container} = await renderPage()

    const names = [...container.querySelectorAll('h2')].map(
      (heading) => heading.textContent
    )
    expect(names).toEqual(['Claire Besson', 'Michel Arnaud', 'Sylvie Renard'])
  })

  it('porte le nom dans le texte alternatif de la photo', async () => {
    await renderPage()

    expect(
      screen.getByRole('img', {name: 'Portrait de Claire Besson'})
    ).toBeInTheDocument()
  })

  it('rend les initiales, et aucune image, pour une fiche sans photo', async () => {
    vi.mocked(getPublicBoardMembersDal).mockResolvedValue([
      member({id: 'm4', name: 'Jean-Pierre Vasseur', photoKey: null}),
    ])

    const {container} = await renderPage()

    expect(screen.getByText('JV')).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })

  it('s’arrête au rôle pour une fiche sans biographie', async () => {
    vi.mocked(getPublicBoardMembersDal).mockResolvedValue([
      member({id: 'm5', name: 'Hélène Dumas', biography: ''}),
    ])

    await renderPage()

    const entry = screen.getByRole('listitem')
    expect(within(entry).getByText('Présidente')).toBeInTheDocument()
    expect(entry.textContent).not.toContain('Présidente depuis')
  })

  it('écrit le nombre de membres quand le paramètre est renseigné', async () => {
    await renderPage()

    expect(screen.getByText(/412 membres propriétaires/)).toBeInTheDocument()
  })

  it('accorde la phrase au singulier — jamais « 1 membres »', async () => {
    vi.mocked(getAssociationSettingsDal).mockResolvedValue(
      settingsWith(1) as never
    )

    const {container} = await renderPage()

    expect(screen.getByText(/1 membre propriétaire\./)).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/membres propriétaires/)
  })

  it('omet la phrase quand le paramètre est absent — jamais « 0 membres »', async () => {
    vi.mocked(getAssociationSettingsDal).mockResolvedValue(
      settingsWith(null) as never
    )

    const {container} = await renderPage()

    expect(container.textContent).not.toMatch(/membres propriétaires/)
    expect(container.textContent).not.toMatch(/0 membre/)
  })

  it('arrondit le portrait à 8 px, comme le back-office (§3.9)', async () => {
    vi.mocked(getPublicBoardMembersDal).mockResolvedValue([
      member({id: 'm1'}),
      member({id: 'm4', name: 'Jean-Pierre Vasseur', photoKey: null}),
    ])

    const {container} = await renderPage()

    expect(container.querySelector('img')).toHaveClass('rounded-md')
    expect(screen.getByText('JV')).toHaveClass('rounded-md')
  })

  it('porte la mention RGPD une seule fois, en pied de page', async () => {
    vi.mocked(getPublicBoardMembersDal).mockResolvedValue([
      member({id: 'm1'}),
      member({id: 'm2', name: 'Michel Arnaud'}),
      member({id: 'm3', name: 'Sylvie Renard'}),
    ])

    await renderPage()

    expect(screen.getAllByText(/données personnelles/i)).toHaveLength(1)
  })

  it('rend un état vide rédigé, sans action', async () => {
    vi.mocked(getPublicBoardMembersDal).mockResolvedValue([])

    const {container} = await renderPage()

    expect(
      screen.getByText(/composition du bureau sera publiée prochainement/)
    ).toBeInTheDocument()
    expect(container.querySelector('a')).toBeNull()
    expect(container.querySelector('button')).toBeNull()
  })
})
