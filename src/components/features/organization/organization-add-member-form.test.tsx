import {describe, expect, it, vi} from 'vitest'

vi.mock('./action', () => ({
  addUserToOrganizationAction: vi.fn(async () => ({success: true})),
  searchUsersForOrganizationAction: vi.fn(async () => []),
}))

import {render, screen, userEvent} from '@/__tests__/customRender'

import {OrganizationAddMemberForm} from './organization-add-member-form'

/**
 * s14, ADR 039 : l'ajout d'un membre ne propose aucun role du bureau. Un role
 * ne se pose que depuis la fiche du membre.
 */
describe('OrganizationAddMemberForm — ajout au rôle Membre seulement (s14)', () => {
  it('ne propose aucun choix de rôle', async () => {
    render(
      <OrganizationAddMemberForm
        organizationId="11111111-1111-4111-8111-111111111111"
        existingMemberIds={[]}
      />
    )

    await userEvent.click(screen.getByRole('button'))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })
})
