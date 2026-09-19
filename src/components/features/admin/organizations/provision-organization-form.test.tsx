import {describe, expect, it, vi} from 'vitest'

vi.mock('@/app/[locale]/admin/organizations/actions', () => ({
  provisionOrganizationAction: vi.fn(async () => ({success: true})),
}))

import {render, screen, userEvent, waitFor} from '@/__tests__/customRender'
import {provisionOrganizationAction} from '@/app/[locale]/admin/organizations/actions'

import {ProvisionOrganizationForm} from './provision-organization-form'
import {createProvisionOrganizationFormSchema} from './provision-organization-form-validation'

const identity = (key: string) => key

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const validValues = {
  name: 'ASL Les Pins',
  slug: 'asl-les-pins',
  domain: 'asl-les-pins.test',
  adminEmail: 'presidence@asl-les-pins.test',
  contactEmail: 'contact@asl-les-pins.test',
}

describe('createProvisionOrganizationFormSchema — adresse de contact', () => {
  it('accepte une association avec son adresse de contact', () => {
    expect(
      createProvisionOrganizationFormSchema(identity).safeParse(validValues)
        .success
    ).toBe(true)
  })

  it('refuse une association sans adresse de contact', () => {
    const result = createProvisionOrganizationFormSchema(identity).safeParse({
      ...validValues,
      contactEmail: '',
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]).toMatchObject({
      path: ['contactEmail'],
      message: 'validation.contactEmailInvalid',
    })
  })
})

describe('ProvisionOrganizationForm — adresse de contact (planche D)', () => {
  it('porte le champ obligatoire dans la carte « L association », apres le domaine', () => {
    render(<ProvisionOrganizationForm />)

    const field = screen.getByLabelText("Adresse de contact de l'association")
    expect(field).toHaveAttribute('type', 'email')
    expect(
      screen.getByText(
        "Obligatoire. Reçoit les messages du site et sert d'adresse par défaut. Le bureau pourra la changer dans ses réglages."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('Domaine').compareDocumentPosition(field) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('refuse l envoi sans adresse de contact, sans appeler le serveur', async () => {
    render(<ProvisionOrganizationForm />)

    await userEvent.type(
      screen.getByLabelText("Nom de l'association"),
      validValues.name
    )
    await userEvent.type(screen.getByLabelText('Domaine'), validValues.domain)
    await userEvent.type(
      screen.getByLabelText('Adresse email'),
      validValues.adminEmail
    )
    await userEvent.click(
      screen.getByRole('button', {name: "Provisionner l'association"})
    )

    expect(
      await screen.findByText(
        "L'adresse de contact de l'association est obligatoire. Exemple : contact@domaine.fr"
      )
    ).toBeInTheDocument()
    expect(provisionOrganizationAction).not.toHaveBeenCalled()
  })

  it('transmet l adresse de contact a l action', async () => {
    render(<ProvisionOrganizationForm />)

    await userEvent.type(
      screen.getByLabelText("Nom de l'association"),
      validValues.name
    )
    await userEvent.type(screen.getByLabelText('Domaine'), validValues.domain)
    await userEvent.type(
      screen.getByLabelText("Adresse de contact de l'association"),
      validValues.contactEmail
    )
    await userEvent.type(
      screen.getByLabelText('Adresse email'),
      validValues.adminEmail
    )
    await userEvent.click(
      screen.getByRole('button', {name: "Provisionner l'association"})
    )

    await waitFor(() =>
      expect(provisionOrganizationAction).toHaveBeenCalledTimes(1)
    )
    const formData = vi.mocked(provisionOrganizationAction).mock
      .calls[0][1] as FormData
    expect(formData.get('contactEmail')).toBe(validValues.contactEmail)
  })
})
