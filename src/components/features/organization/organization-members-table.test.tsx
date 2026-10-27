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

import {render, screen} from '@/__tests__/customRender'

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
