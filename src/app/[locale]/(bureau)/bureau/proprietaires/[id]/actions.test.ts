import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({revalidatePath: vi.fn()}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn((namespace = 'BureauMemberProfilesPage') =>
    Promise.resolve((key: string) => `${namespace}.${key}`)
  ),
}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/services/facades/member-invoice-service-facade', () => ({
  createMemberInvoiceService: vi.fn(),
  updateMemberInvoiceService: vi.fn(),
}))
vi.mock('@/services/facades/member-profile-email-service-facade', () => ({
  addMemberProfileEmailService: vi.fn(),
  designateMemberProfileHolderService: vi.fn(),
  removeMemberProfileEmailService: vi.fn(),
  updateMemberProfileEmailService: vi.fn(),
}))

import {revalidatePath} from 'next/cache'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {ReadOnlyInvoiceError} from '@/services/errors/member-invoice-errors'
import {
  createMemberInvoiceService,
  updateMemberInvoiceService,
} from '@/services/facades/member-invoice-service-facade'
import {
  addMemberProfileEmailService,
  designateMemberProfileHolderService,
  removeMemberProfileEmailService,
  updateMemberProfileEmailService,
} from '@/services/facades/member-profile-email-service-facade'
import type {MemberProfileDTO} from '@/services/types/domain/member-profile-types'

import {
  addMemberProfileEmailAction,
  createMemberInvoiceAction,
  designateMemberProfileHolderAction,
  removeMemberProfileEmailAction,
  updateMemberInvoiceAction,
  updateMemberProfileEmailAction,
} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const EMAIL_ID = '44444444-4444-4444-8444-444444444444'
const OTHER_EMAIL_ID = '55555555-5555-4555-8555-555555555555'
const HOLDER_ID = '77777777-7777-4777-8777-777777777777'

const formOf = (values: Record<string, string>) => {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) formData.set(key, value)
  return formData
}

const saved = (change: 'added' | 'updated' | 'removed' | 'designated') => ({
  status: 'saved' as const,
  profile: {id: PROFILE_ID} as MemberProfileDTO,
  change,
  email: 'claire@exemple.fr',
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({
    id: TENANT_ID,
  } as never)
  vi.mocked(requireActionAuth).mockResolvedValue({} as never)
})

describe('addMemberProfileEmailAction (4b, 4c)', () => {
  it('ajoute l’adresse au tenant du domaine appelé, avec le rôle et la confirmation, puis revalide', async () => {
    vi.mocked(addMemberProfileEmailService).mockResolvedValue(saved('added'))

    const result = await addMemberProfileEmailAction(
      undefined,
      formOf({
        memberProfileId: PROFILE_ID,
        email: ' claire@exemple.fr ',
        role: 'holder',
        confirmedAccountUserId: HOLDER_ID,
        origin: 'file',
        organizationId: 'autre-association',
      })
    )

    expect(addMemberProfileEmailService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      memberProfileId: PROFILE_ID,
      email: 'claire@exemple.fr',
      role: 'holder',
      confirmedAccountUserId: HOLDER_ID,
    })
    expect(result).toEqual({
      status: 'saved',
      change: 'added',
      email: 'claire@exemple.fr',
    })
    expect(revalidatePath).toHaveBeenCalled()
  })

  it('refuse une adresse invalide sans appeler la façade', async () => {
    const result = await addMemberProfileEmailAction(
      undefined,
      formOf({memberProfileId: PROFILE_ID, email: 'pas-une-adresse'})
    )

    expect(result).toEqual({
      status: 'invalid',
      message: 'BureauMemberProfilesPage.validation.emailInvalid',
    })
    expect(addMemberProfileEmailService).not.toHaveBeenCalled()
  })

  it('rend le compte qui porte déjà l’adresse sans revalider : rien n’est écrit', async () => {
    const holder = {userId: HOLDER_ID, name: 'Bernard Lefèvre', profiles: []}
    vi.mocked(addMemberProfileEmailService).mockResolvedValue({
      status: 'email_shared',
      holder,
    })

    expect(
      await addMemberProfileEmailAction(
        undefined,
        formOf({memberProfileId: PROFILE_ID, email: 'bernard@exemple.fr'})
      )
    ).toEqual({status: 'email_shared', holder})
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('rend le refus du service sans revalider', async () => {
    vi.mocked(addMemberProfileEmailService).mockRejectedValue(
      new AuthorizationError('non')
    )

    expect(
      await addMemberProfileEmailAction(
        undefined,
        formOf({memberProfileId: PROFILE_ID, email: 'claire@exemple.fr'})
      )
    ).toEqual({
      status: 'error',
      message: 'BureauMemberProfilesPage.errors.forbidden',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('refuse sans session, sans appeler la façade', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    await addMemberProfileEmailAction(
      undefined,
      formOf({memberProfileId: PROFILE_ID, email: 'claire@exemple.fr'})
    )

    expect(addMemberProfileEmailService).not.toHaveBeenCalled()
  })
})

describe('updateMemberProfileEmailAction', () => {
  it('modifie l’adresse désignée, puis revalide', async () => {
    vi.mocked(updateMemberProfileEmailService).mockResolvedValue(
      saved('updated')
    )

    await updateMemberProfileEmailAction(
      undefined,
      formOf({
        memberProfileId: PROFILE_ID,
        emailId: EMAIL_ID,
        email: 'claire@exemple.fr',
      })
    )

    expect(updateMemberProfileEmailService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      memberProfileId: PROFILE_ID,
      emailId: EMAIL_ID,
      email: 'claire@exemple.fr',
      confirmedAccountUserId: undefined,
    })
    expect(revalidatePath).toHaveBeenCalled()
  })

  it('rend une adresse déjà sur la fiche, sans revalider', async () => {
    vi.mocked(updateMemberProfileEmailService).mockResolvedValue({
      status: 'already_listed',
    })

    expect(
      await updateMemberProfileEmailAction(
        undefined,
        formOf({
          memberProfileId: PROFILE_ID,
          emailId: EMAIL_ID,
          email: 'claire@exemple.fr',
        })
      )
    ).toEqual({status: 'already_listed'})
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('removeMemberProfileEmailAction (4e, 4f)', () => {
  it('retire l’adresse avec la remplaçante choisie, puis revalide', async () => {
    vi.mocked(removeMemberProfileEmailService).mockResolvedValue(
      saved('removed')
    )

    await removeMemberProfileEmailAction(
      undefined,
      formOf({
        memberProfileId: PROFILE_ID,
        emailId: EMAIL_ID,
        replacementEmailId: OTHER_EMAIL_ID,
        replacementEmail: '',
      })
    )

    expect(removeMemberProfileEmailService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      memberProfileId: PROFILE_ID,
      emailId: EMAIL_ID,
      replacementEmailId: OTHER_EMAIL_ID,
      replacementEmail: undefined,
    })
    expect(revalidatePath).toHaveBeenCalled()
  })

  it('rend le refus faute de remplaçante, sans revalider', async () => {
    vi.mocked(removeMemberProfileEmailService).mockResolvedValue({
      status: 'replacement_required',
    })

    expect(
      await removeMemberProfileEmailAction(
        undefined,
        formOf({memberProfileId: PROFILE_ID, emailId: EMAIL_ID})
      )
    ).toEqual({status: 'replacement_required'})
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('designateMemberProfileHolderAction (4d)', () => {
  it('désigne l’adresse titulaire, puis revalide', async () => {
    vi.mocked(designateMemberProfileHolderService).mockResolvedValue(
      saved('designated')
    )

    expect(
      await designateMemberProfileHolderAction(
        undefined,
        formOf({memberProfileId: PROFILE_ID, emailId: EMAIL_ID})
      )
    ).toEqual({
      status: 'saved',
      change: 'designated',
      email: 'claire@exemple.fr',
    })
    expect(designateMemberProfileHolderService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      memberProfileId: PROFILE_ID,
      emailId: EMAIL_ID,
    })
  })

  it('rend une fiche introuvable comme un échec', async () => {
    vi.mocked(designateMemberProfileHolderService).mockResolvedValue({
      status: 'not_found',
    })

    expect(
      await designateMemberProfileHolderAction(
        undefined,
        formOf({memberProfileId: PROFILE_ID, emailId: EMAIL_ID})
      )
    ).toEqual({
      status: 'error',
      message: 'BureauMemberProfilesPage.errors.notFound',
    })
  })
})

describe('createMemberInvoiceAction — saisir une facture (s19, écran 3)', () => {
  const PARCEL_ID = '88888888-8888-4888-8888-888888888888'
  const invoiceForm = (overrides: Record<string, string> = {}) =>
    formOf({
      memberProfileId: PROFILE_ID,
      parcelId: PARCEL_ID,
      year: '2026',
      amount: '412,50',
      issuedOn: '15/03/2026',
      dueOn: '15/04/2026',
      status: 'En attente',
      organizationId: 'autre-association',
      source: 'pennylane',
      ...overrides,
    })

  it('enregistre au tenant du domaine appelé, montant en centimes, dates ISO, puis revalide', async () => {
    vi.mocked(createMemberInvoiceService).mockResolvedValue({
      status: 'saved',
      invoiceId: 'inv-1',
    })

    expect(await createMemberInvoiceAction(undefined, invoiceForm())).toEqual({
      status: 'saved',
    })
    expect(requireActionAuth).toHaveBeenCalled()
    expect(createMemberInvoiceService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      memberProfileId: PROFILE_ID,
      parcelId: PARCEL_ID,
      year: 2026,
      amountCents: 41250,
      issuedOn: '2026-03-15',
      dueOn: '2026-04-15',
      status: 'En attente',
    })
    expect(revalidatePath).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['amount', {amount: '0'}, 'validation.amount'],
    ['amount', {amount: '12,345'}, 'validation.amount'],
    ['dueOn', {dueOn: '14/03/2026'}, 'validation.dueBeforeIssue'],
    ['issuedOn', {issuedOn: '31/02/2026'}, 'validation.date'],
    ['year', {year: '26'}, 'validation.year'],
    ['parcelId', {parcelId: ''}, 'validation.parcelRequired'],
    ['status', {status: ''}, 'validation.statusRequired'],
  ])(
    'refuse un champ %s invalide, message traduit, sans appel au service',
    async (field, overrides, message) => {
      const result = await createMemberInvoiceAction(
        undefined,
        invoiceForm(overrides)
      )

      expect(result).toMatchObject({
        status: 'invalid',
        errors: expect.arrayContaining([
          {field, message: expect.stringContaining(message)},
        ]),
      })
      expect(createMemberInvoiceService).not.toHaveBeenCalled()
    }
  )

  it('une parcelle d’autrui à la date d’émission : refus sous le champ, rien n’est revalidé', async () => {
    vi.mocked(createMemberInvoiceService).mockResolvedValue({
      status: 'parcel_not_owned',
    })

    expect(await createMemberInvoiceAction(undefined, invoiceForm())).toEqual({
      status: 'invalid',
      errors: [
        {
          field: 'parcelId',
          message: 'BureauMemberInvoices.refusals.parcelNotOwned',
        },
      ],
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('un statut hors configuration : refus sous le champ', async () => {
    vi.mocked(createMemberInvoiceService).mockResolvedValue({
      status: 'unknown_status',
    })

    expect(await createMemberInvoiceAction(undefined, invoiceForm())).toEqual({
      status: 'invalid',
      errors: [
        {
          field: 'status',
          message: 'BureauMemberInvoices.refusals.unknownStatus',
        },
      ],
    })
  })

  it('un refus d’accès est rendu, jamais levé', async () => {
    vi.mocked(createMemberInvoiceService).mockRejectedValue(
      new AuthorizationError()
    )

    expect(await createMemberInvoiceAction(undefined, invoiceForm())).toEqual({
      status: 'error',
      message: 'BureauMemberInvoices.errors.forbidden',
    })
  })
})

describe('updateMemberInvoiceAction — corriger une facture (s19, écran 3)', () => {
  const INVOICE_ID = '99999999-9999-4999-8999-999999999999'
  const PARCEL_ID = '88888888-8888-4888-8888-888888888888'
  const updateForm = () =>
    formOf({
      invoiceId: INVOICE_ID,
      parcelId: PARCEL_ID,
      year: '2026',
      amount: '390',
      issuedOn: '15/03/2026',
      dueOn: '15/04/2026',
      status: 'Payée',
    })

  it('corrige la facture désignée, au tenant du domaine appelé', async () => {
    vi.mocked(updateMemberInvoiceService).mockResolvedValue({status: 'saved'})

    expect(await updateMemberInvoiceAction(undefined, updateForm())).toEqual({
      status: 'saved',
    })
    expect(updateMemberInvoiceService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      invoiceId: INVOICE_ID,
      parcelId: PARCEL_ID,
      year: 2026,
      amountCents: 39000,
      issuedOn: '2026-03-15',
      dueOn: '2026-04-15',
      status: 'Payée',
    })
  })

  it('critère 9 : une facture Pennylane envoyée en direct est refusée côté serveur, rien n’est revalidé', async () => {
    vi.mocked(updateMemberInvoiceService).mockRejectedValue(
      new ReadOnlyInvoiceError()
    )

    expect(await updateMemberInvoiceAction(undefined, updateForm())).toEqual({
      status: 'read_only',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('une facture introuvable', async () => {
    vi.mocked(updateMemberInvoiceService).mockResolvedValue({
      status: 'not_found',
    })

    expect(await updateMemberInvoiceAction(undefined, updateForm())).toEqual({
      status: 'error',
      message: 'BureauMemberInvoices.errors.notFound',
    })
  })
})
