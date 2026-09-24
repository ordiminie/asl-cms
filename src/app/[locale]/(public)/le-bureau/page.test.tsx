import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', async () => {
  const messages = (await import('../../../../../messages/fr.json')).default

  return {
    getTranslations:
      async (namespace: string) =>
      (key: string, values?: Record<string, string | number>) => {
        const message = [
          ...namespace.split('.'),
          ...key.split('.'),
        ].reduce<unknown>(
          (node, part) => (node as Record<string, unknown>)?.[part],
          messages
        )

        return Object.entries(values ?? {}).reduce<string>(
          (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
          message as string
        )
      },
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

  it('omet la phrase quand le paramètre est absent — jamais « 0 membres »', async () => {
    vi.mocked(getAssociationSettingsDal).mockResolvedValue(
      settingsWith(null) as never
    )

    const {container} = await renderPage()

    expect(container.textContent).not.toMatch(/membres propriétaires/)
    expect(container.textContent).not.toMatch(/0 membre/)
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
