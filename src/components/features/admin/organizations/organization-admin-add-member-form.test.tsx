import {describe, expect, it, vi} from 'vitest'

vi.mock('@/app/[locale]/admin/organizations/actions', () => ({
  addUserToOrganizationAction: vi.fn(async () => ({success: true})),
}))
vi.mock('../../organization/action', () => ({
  searchUsersForOrganizationAction: vi.fn(async () => []),
}))

import {render, screen, userEvent} from '@/__tests__/customRender'

import {OrganizationAdminAddMemberForm} from './organization-admin-add-member-form'

/**
 * s14, ADR 039 : l'ecran SuperAdmin ajoute un compte au role Membre
 * seulement. Aucun choix de role n'est propose.
 */
describe('OrganizationAdminAddMemberForm — ajout au rôle Membre seulement (s14)', () => {
  it('ne propose aucun choix de rôle', async () => {
    render(
      <OrganizationAdminAddMemberForm
        organizationId="11111111-1111-4111-8111-111111111111"
        existingMemberIds={[]}
      />
    )

    await userEvent.click(
      screen.getByRole('button', {name: 'Ajouter un membre'})
    )

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })
})
