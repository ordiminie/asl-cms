import {ReactElement} from 'react'
import {describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({cacheLife: vi.fn()}))
vi.mock('next-intl/server', async () => {
  const messages = (await import('../../../../messages/fr.json')).default

  return {
    getTranslations: async (namespace: string) => (key: string) =>
      [...namespace.split('.'), ...key.split('.')].reduce<unknown>(
        (node, part) => (node as Record<string, unknown>)?.[part],
        messages
      ) as string,
  }
})
vi.mock('@/app/dal/tenant-dal', () => ({
  requireCurrentTenantDal: vi.fn(async () => ({
    id: '11111111-1111-4111-8111-111111111111',
  })),
}))
vi.mock('@/app/[locale]/admin/organizations/actions', () => ({
  openImpersonationAction: vi.fn(),
}))
vi.mock('@/app/dal/organization-dal', () => ({
  getMembersAndInvitationsDal: vi.fn(async () => [
    {
      memberId: 'member-1',
      userId: '33333333-3333-4333-8333-333333333333',
      invitationId: null,
      organizationId: '11111111-1111-4111-8111-111111111111',
      name: 'Paul Vidal',
      email: 'paul@example.test',
      image: null,
      role: 'board',
      joinedAt: null,
      status: 'member',
    },
  ]),
}))
vi.mock('../admin/organizations/organization-admin-add-member-form', () => ({
  OrganizationAdminAddMemberForm: () => null,
}))
vi.mock('./organization-add-member-form', () => ({
  OrganizationAddMemberForm: () => null,
}))
vi.mock('./remove-member-button', () => ({
  RemoveMemberButton: () => <button type="button">Retirer</button>,
}))

import {render, screen, userEvent} from '@/__tests__/customRender'
import {getMembersAndInvitationsDal} from '@/app/dal/organization-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'

import OrganizationMembersTable from './organization-members-table'

/**
 * s14, ADR 039 : l'ecran SuperAdmin des membres d'une association affiche le
 * role en lecture seule. Il ne le modifie plus : un role ne change que depuis
 * la fiche du membre, par le service trace.
 */
describe('OrganizationMembersTable — rôle en lecture seule (s14)', () => {
  it('affiche le rôle sans action de modification', async () => {
    render(
      (await OrganizationMembersTable({
        organizationId: '11111111-1111-4111-8111-111111111111',
        canManageMembers: true,
        adminView: true,
      })) as ReactElement
    )

    expect(screen.getAllByText('board').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button', {name: 'Retirer'})).toBeInTheDocument()
  })
})

const ORG_ID = '11111111-1111-4111-8111-111111111111'

const row = (overrides: Record<string, unknown>) => ({
  memberId: 'member-1',
  userId: '44444444-4444-4444-8444-444444444444',
  invitationId: null,
  organizationId: ORG_ID,
  name: 'Claire Montel',
  email: 'claire@example.test',
  image: null,
  role: 'owner',
  joinedAt: null,
  status: 'member',
  hasAccount: true,
  isSuperAdmin: false,
  ...overrides,
})

const renderAdminTable = async () =>
  render(
    (await OrganizationMembersTable({
      organizationId: ORG_ID,
      organizationName: 'Rives Vertes',
      organizationDomain: 'rives-vertes.fr',
      canManageMembers: true,
      adminView: true,
    })) as ReactElement
  )

/** s48, écran 1 : le point d'entrée « Agir à sa place ». */
describe('OrganizationMembersTable — agir à la place d’un compte (s48)', () => {
  it('offre « Agir à sa place » sur une ligne avec compte, à côté de « Retirer »', async () => {
    vi.mocked(getMembersAndInvitationsDal).mockResolvedValueOnce([
      row({}),
    ] as never)

    await renderAdminTable()

    expect(
      screen.getByRole('button', {name: 'Agir à sa place'})
    ).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Retirer'})).toBeInTheDocument()
  })

  it('ne l’offre ni à un SuperAdmin ni à une invitation, et le dit', async () => {
    vi.mocked(getMembersAndInvitationsDal).mockResolvedValueOnce([
      row({isSuperAdmin: true, name: 'Zoé Support'}),
      row({
        status: 'invited',
        hasAccount: false,
        memberId: null,
        invitationId: 'invitation-1',
        name: null,
      }),
    ] as never)

    await renderAdminTable()

    expect(
      screen.queryByRole('button', {name: 'Agir à sa place'})
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('Compte SuperAdmin : impossible')
    ).toBeInTheDocument()
    expect(screen.getByText('Pas encore de compte')).toBeInTheDocument()
  })

  it('sur l’hôte d’une autre association, la boîte renvoie vers le site de celle-ci', async () => {
    vi.mocked(requireCurrentTenantDal).mockResolvedValueOnce({
      id: '22222222-2222-4222-8222-222222222222',
    } as never)
    vi.mocked(getMembersAndInvitationsDal).mockResolvedValueOnce([
      row({}),
    ] as never)

    await renderAdminTable()
    await userEvent.click(screen.getByRole('button', {name: 'Agir à sa place'}))

    const link = screen.getByRole('link', {
      name: 'Ouvrir le site de Rives Vertes',
    })
    expect(new URL(link.getAttribute('href') ?? '').hostname).toBe(
      'rives-vertes.fr'
    )
    expect(new URL(link.getAttribute('href') ?? '').pathname).toBe(
      `/admin/organizations/${ORG_ID}/edit`
    )
  })

  it('hors de l’écran SuperAdmin, aucune entrée', async () => {
    vi.mocked(getMembersAndInvitationsDal).mockResolvedValueOnce([
      row({}),
    ] as never)

    render(
      (await OrganizationMembersTable({
        organizationId: ORG_ID,
        canManageMembers: true,
      })) as ReactElement
    )

    expect(
      screen.queryByRole('button', {name: 'Agir à sa place'})
    ).not.toBeInTheDocument()
  })
})
