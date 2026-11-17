import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'

const router = vi.hoisted(() => ({push: vi.fn()}))

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}))

import {render, screen, userEvent, waitFor} from '@/__tests__/customRender'
import type {BoardInvoiceDTO} from '@/services/types/domain/member-invoice-types'

import {
  MemberInvoiceForm,
  type MemberInvoiceParcelOption,
} from './member-invoice-form'
import type {MemberInvoiceFormAction} from './member-invoice-form-validation'

const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const INVOICE_ID = '66666666-6666-4666-8666-666666666666'

const PARCELS: MemberInvoiceParcelOption[] = [
  {parcelId: 'p12', number: '12', startsOn: '1998-02-03', endsOn: null},
  {parcelId: 'p8', number: '8', startsOn: '2001-01-01', endsOn: '2026-01-01'},
]

const STATUSES = ['En attente', 'Payée']

beforeAll(() => {
  // Radix Select s'appuie sur des API de pointeur absentes de jsdom.
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  vi.clearAllMocks()
})

const renderForm = (
  action: MemberInvoiceFormAction,
  invoice?: BoardInvoiceDTO
) =>
  render(
    <MemberInvoiceForm
      memberProfile={{id: PROFILE_ID, name: 'Bernard Lefèvre'}}
      parcels={PARCELS}
      statuses={STATUSES}
      subjectTemplate="Cotisation et eau {année}"
      today="2026-03-15"
      invoice={invoice}
      action={action}
    />
  )

const parcelField = () =>
  screen.getByRole('combobox', {name: /Terrain facturé/})
const statusField = () => screen.getByRole('combobox', {name: /Statut/})
const amountField = () => screen.getByRole('textbox', {name: /Montant/})
const yearField = () => screen.getByRole('textbox', {name: /Année/})
const dueField = () => screen.getByRole('textbox', {name: /Échéance/})
const issuedField = () => screen.getByRole('textbox', {name: /Émise le/})
const submit = () =>
  screen.getByRole('button', {name: 'Enregistrer la facture'})

const fillValid = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(parcelField())
  await user.click(screen.getByRole('option', {name: 'Parcelle 12'}))
  await user.type(amountField(), '412,50')
  await user.type(dueField(), '15042026')
  await user.click(statusField())
  await user.click(screen.getByRole('option', {name: 'En attente'}))
}

describe('MemberInvoiceForm — saisir une facture (s19, écran 3)', () => {
  it('3a : l’objet n’est pas saisi, il est composé depuis le réglage et l’année', async () => {
    const user = userEvent.setup()
    renderForm(vi.fn())

    expect(screen.getByText(/Objet affiché au membre/)).toHaveTextContent(
      'Cotisation et eau 2026'
    )
    expect(issuedField()).toHaveValue('15/03/2026')
    await user.clear(yearField())
    await user.type(yearField(), '2025')
    expect(screen.getByText(/Objet affiché au membre/)).toHaveTextContent(
      'Cotisation et eau 2025'
    )
  })

  it('propose les parcelles possédées à la date d’émission, et les statuts des réglages', async () => {
    const user = userEvent.setup()
    renderForm(vi.fn())

    await user.click(parcelField())
    expect(
      screen.getAllByRole('option').map((option) => option.textContent)
    ).toEqual(['Parcelle 12'])
    await user.keyboard('{Escape}')

    await user.click(statusField())
    expect(
      screen.getAllByRole('option').map((option) => option.textContent)
    ).toEqual(STATUSES)
  })

  it('3b : montant nul et échéance antérieure refusés sous les champs, avec un résumé, sans envoi', async () => {
    const user = userEvent.setup()
    const action = vi.fn()
    renderForm(action)

    await user.type(amountField(), '0')
    await user.type(dueField(), '14032026')
    await user.click(submit())

    expect(
      await screen.findAllByText(
        'Saisissez un montant positif, par exemple 412,50.'
      )
    ).not.toHaveLength(0)
    expect(
      screen.getAllByText(
        'L’échéance ne peut pas précéder la date d’émission (15/03/2026).'
      )
    ).not.toHaveLength(0)
    expect(screen.getByText(/champs sont à corriger/)).toBeInTheDocument()
    expect(action).not.toHaveBeenCalled()
  })

  it('envoie les champs et la fiche, puis revient sur la fiche (3c)', async () => {
    const user = userEvent.setup()
    const action = vi.fn<MemberInvoiceFormAction>(async () => ({
      status: 'saved',
    }))
    renderForm(action)

    await fillValid(user)
    await user.click(submit())

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    const formData = action.mock.calls[0][1]
    expect(Object.fromEntries(formData.entries())).toEqual({
      memberProfileId: PROFILE_ID,
      parcelId: 'p12',
      year: '2026',
      amount: '412,50',
      issuedOn: '15/03/2026',
      dueOn: '15/04/2026',
      status: 'En attente',
    })
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(
        `/bureau/proprietaires/${PROFILE_ID}?facture=enregistree`
      )
    )
  })

  it('un refus du serveur s’écrit sous le champ concerné', async () => {
    const user = userEvent.setup()
    renderForm(async () => ({
      status: 'invalid',
      errors: [{field: 'parcelId', message: 'Pas à cette date.'}],
    }))

    await fillValid(user)
    await user.click(submit())

    expect(await screen.findAllByText('Pas à cette date.')).not.toHaveLength(0)
    expect(router.push).not.toHaveBeenCalled()
  })

  it('une panne : alerte destructive, les saisies conservées', async () => {
    const user = userEvent.setup()
    renderForm(async () => ({
      status: 'error',
      message:
        'La facture n’a pas été enregistrée. Rien n’est perdu : vos saisies sont conservées.',
    }))

    await fillValid(user)
    await user.click(submit())

    expect(
      await screen.findByText(/Rien n’est perdu : vos saisies sont conservées/)
    ).toBeInTheDocument()
    expect(amountField()).toHaveValue('412,50')
  })
})

describe('MemberInvoiceForm — corriger une facture du site', () => {
  const invoice: BoardInvoiceDTO = {
    id: INVOICE_ID,
    memberProfileId: PROFILE_ID,
    parcelId: 'p12',
    parcelNumber: '12',
    meterNumber: null,
    source: 'site',
    year: 2026,
    issuedOn: '2026-03-15',
    dueOn: '2026-04-15',
    amountCents: 41250,
    status: 'En attente',
    subject: 'Cotisation et eau 2026',
    statusClass: 'unpaid',
  }

  it('reprend les valeurs, et désigne la facture à l’envoi', async () => {
    const user = userEvent.setup()
    const action = vi.fn<MemberInvoiceFormAction>(async () => ({
      status: 'saved',
    }))
    renderForm(action, invoice)

    expect(amountField()).toHaveValue('412,50')
    expect(dueField()).toHaveValue('15/04/2026')
    await user.click(submit())

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    const formData = action.mock.calls[0][1]
    expect(formData.get('invoiceId')).toBe(INVOICE_ID)
    expect(formData.has('memberProfileId')).toBe(false)
  })

  it('3d : un refus « lecture seule » du serveur est dit en alerte destructive', async () => {
    const user = userEvent.setup()
    renderForm(async () => ({status: 'read_only'}), invoice)

    await user.click(submit())

    expect(
      await screen.findByText(
        'La facture n’a pas été modifiée. Elle vient de Pennylane et ne se corrige que là-bas. Rien n’est perdu.'
      )
    ).toBeInTheDocument()
  })
})
