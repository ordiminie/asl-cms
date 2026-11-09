import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import {render, screen} from '@/__tests__/customRender'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  redirect: vi.fn(),
  forbidden: vi.fn(),
}))
vi.mock('next-intl/server', async () => {
  const messages = (await import('../../../../../../messages/fr.json')).default

  return {
    getTranslations: async (namespace: string) => (key: string) =>
      [...namespace.split('.'), ...key.split('.')].reduce<unknown>(
        (node, part) => (node as Record<string, unknown>)?.[part],
        messages
      ) as string,
  }
})
vi.mock('@/services/authentication/auth-service', () => ({
  getAuthUser: vi.fn(async () => ({
    id: '3f5a0a5e-0000-4000-8000-000000000001',
    name: 'Lucie Moreau',
    email: 'lucie.moreau@exemple.fr',
    role: 'user',
    visibility: 'private',
  })),
  getSessionAuth: vi.fn(),
}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/association-category-dal', () => ({
  getActiveReportCategoriesDal: vi.fn(),
}))
vi.mock('@/app/dal/member-space-dal', () => ({
  getMyReportIdentityDal: vi.fn(),
}))
vi.mock('./actions', () => ({submitMyReportAction: vi.fn()}))

import {getActiveReportCategoriesDal} from '@/app/dal/association-category-dal'
import {getMyReportIdentityDal} from '@/app/dal/member-space-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'

import MyReportPage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'

const renderPage = async () => {
  const outer = (await MyReportPage({})) as ReactElement
  const type = outer.type as (props: unknown) => Promise<ReactElement>
  render(await type(outer.props))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({
    id: TENANT_ID,
  } as Awaited<ReturnType<typeof requireCurrentTenantDal>>)
  vi.mocked(getActiveReportCategoriesDal).mockResolvedValue([
    {id: '44444444-4444-4444-8444-444444444444', name: "Fuite d'eau"},
  ])
  vi.mocked(getMyReportIdentityDal).mockResolvedValue({
    name: 'Lucie Moreau',
    email: 'lucie.moreau@exemple.fr',
    phone: '06 12 34 56 78',
  })
})

describe('/dashboard/signaler — écran B (s22)', () => {
  it('ramène à l’espace, titre la page et rappelle le 112 avant le formulaire', async () => {
    await renderPage()

    expect(
      screen.getByRole('link', {name: 'Revenir à mon espace'})
    ).toHaveAttribute('href', '/dashboard')
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Signaler une fuite ou un incident',
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/En cas de danger immédiat, appelez les secours \(112\)/)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('combobox', {name: 'De quoi s’agit-il ?'})
    ).toBeInTheDocument()
    expect(getActiveReportCategoriesDal).toHaveBeenCalledWith(TENANT_ID)
  })

  it('n’existe pas pour un compte sans fiche dans l’association', async () => {
    vi.mocked(getMyReportIdentityDal).mockResolvedValue(undefined)

    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
