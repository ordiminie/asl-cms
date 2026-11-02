import {ReactElement} from 'react'
import {describe, expect, it, vi} from 'vitest'

import {render, screen} from '@/__tests__/customRender'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({notFound: vi.fn()}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}))
vi.mock('@/components/features/auth/with-auth', () => ({
  withAuthAdmin: (Page: unknown) => Page,
}))
vi.mock('@/app/dal/organization-dal', () => ({
  getOrganizationPermissions: vi.fn(async () => ({
    canReadMembers: false,
    canManageMembers: false,
  })),
  getOrganizationUsageDal: vi.fn(async () => ({
    plan: 'free',
    users: 1,
    limits: {users: 10},
  })),
}))
vi.mock('@/services/facades/organization-service-facade', () => ({
  getOrganizationByIdService: vi.fn(async () => ({
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Rives Vertes',
    domain: 'rives-vertes.fr',
    enabledModules: [],
  })),
}))
vi.mock(
  '@/components/features/admin/organizations/organization-modules-card',
  () => ({OrganizationModulesCard: () => null})
)
vi.mock(
  '@/components/features/organization/organization-members-table',
  () => ({
    default: () => null,
  })
)

import EditOrganizationPage from './page'

const renderPage = async (searchParams: {retour?: string} = {}) =>
  render(
    (await (
      EditOrganizationPage as unknown as (props: unknown) => Promise<unknown>
    )({
      params: Promise.resolve({id: '11111111-1111-4111-8111-111111111111'}),
      searchParams: Promise.resolve(searchParams),
    })) as ReactElement
  )

describe('/admin/organizations/[id]/edit — retour au compte SuperAdmin (s48, 4a)', () => {
  it('affiche l’alerte de retour après une sortie explicite', async () => {
    await renderPage({retour: '1'})

    expect(screen.getByRole('status')).toHaveTextContent(
      'Vous êtes revenu à votre compte SuperAdmin.'
    )
  })

  it('sans paramètre : pas d’alerte', async () => {
    await renderPage()

    expect(screen.queryByRole('status')).toBeNull()
  })
})
