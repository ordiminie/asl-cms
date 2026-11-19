import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({revalidatePath: vi.fn()}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve((key: string) => `BureauMemberProfilesPage.${key}`)
  ),
}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/services/facades/member-space-service-facade', () => ({
  updateMyContactService: vi.fn(),
  getMyInvoicePdfUrlService: vi.fn(),
}))

import {revalidatePath} from 'next/cache'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {
  getMyInvoicePdfUrlService,
  updateMyContactService,
} from '@/services/facades/member-space-service-facade'

import {openMyInvoicePdfAction, updateMyContactAction} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_PROFILE_ID = '44444444-4444-4444-8444-444444444444'

const CONTACT = {
  phone: '06 12 34 56 78',
  homeAddressLine: '4 chemin des Oliviers',
  homeAddressComplement: 'Bâtiment B',
  homePostalCode: '13100',
  homeCity: 'Aix-en-Provence',
}

const formOf = (values: Record<string, string>) => {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) formData.set(key, value)
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({
    id: TENANT_ID,
  } as Awaited<ReturnType<typeof requireCurrentTenantDal>>)
  vi.mocked(requireActionAuth).mockResolvedValue(
    {} as Awaited<ReturnType<typeof requireActionAuth>>
  )
  vi.mocked(updateMyContactService).mockResolvedValue({
    status: 'saved',
    contact: {
      ...CONTACT,
      landCount: 1,
      divergent: false,
      groups: [],
    },
  })
})

describe('updateMyContactAction — « Mes coordonnées » (s16)', () => {
  it('rend les erreurs par champ pour une saisie invalide, sans appeler le service', async () => {
    const result = await updateMyContactAction(
      undefined,
      formOf({...CONTACT, phone: '06 12 AB 56 78', homePostalCode: '1310'})
    )

    expect(result).toEqual({
      status: 'invalid',
      errors: [
        {
          field: 'phone',
          message: 'BureauMemberProfilesPage.validation.phoneInvalid',
        },
        {
          field: 'homePostalCode',
          message: 'BureauMemberProfilesPage.validation.home.postalCodeInvalid',
        },
      ],
    })
    expect(updateMyContactService).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('ne transmet ni identifiant de fiche ni email au service', async () => {
    await updateMyContactAction(
      undefined,
      formOf({
        ...CONTACT,
        memberProfileId: OTHER_PROFILE_ID,
        email: 'autre.membre@exemple.fr',
        landAddressLine: '3 rue du Lavoir',
        companyName: 'Épicerie du Clos',
      })
    )

    expect(updateMyContactService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      ...CONTACT,
    })
    const input = vi.mocked(updateMyContactService).mock.calls[0][0]
    expect(input).not.toHaveProperty('memberProfileId')
    expect(input).not.toHaveProperty('landAddressLine')
    expect(input).not.toHaveProperty('companyName')
    expect(input).not.toHaveProperty('email')
  })

  it('rend les coordonnées enregistrées et revalide l’espace membre', async () => {
    const result = await updateMyContactAction(undefined, formOf(CONTACT))

    expect(result).toEqual({
      status: 'saved',
      contact: {
        ...CONTACT,
        landCount: 1,
        divergent: false,
        groups: [],
      },
    })
    expect(revalidatePath).toHaveBeenCalledWith(
      '/[locale]/(app)/dashboard',
      'page'
    )
  })

  it('rend un échec sans détail technique quand le service lève', async () => {
    vi.mocked(updateMyContactService).mockRejectedValue(
      new Error('connect ECONNREFUSED 10.0.0.3:5432')
    )

    const result = await updateMyContactAction(undefined, formOf(CONTACT))

    expect(result).toEqual({
      status: 'error',
      message: 'BureauMemberProfilesPage.errors.failed',
    })
    expect(JSON.stringify(result)).not.toContain('ECONNREFUSED')
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('rend un échec sans session', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(
      new AuthorizationError('non connecté')
    )

    const result = await updateMyContactAction(undefined, formOf(CONTACT))

    expect(result.status).toBe('error')
    expect(updateMyContactService).not.toHaveBeenCalled()
  })

  it('rend un échec pour un compte sans fiche, sans revalider', async () => {
    vi.mocked(updateMyContactService).mockResolvedValue({status: 'not_found'})

    const result = await updateMyContactAction(undefined, formOf(CONTACT))

    expect(result).toEqual({
      status: 'error',
      message: 'BureauMemberProfilesPage.errors.failed',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('openMyInvoicePdfAction — le PDF relu au clic (s20, ADR 062 §6)', () => {
  const INVOICE_ID = '66666666-6666-4666-8666-666666666666'
  const URL_PDF = 'https://pennylane.test/public/invoice/pdf?token=expire'

  it('rend l’adresse relue pour la facture demandée, dans l’association du domaine', async () => {
    vi.mocked(getMyInvoicePdfUrlService).mockResolvedValue({
      status: 'ready',
      url: URL_PDF,
    })

    expect(await openMyInvoicePdfAction(INVOICE_ID)).toEqual({
      status: 'ready',
      url: URL_PDF,
    })
    expect(requireActionAuth).toHaveBeenCalled()
    expect(getMyInvoicePdfUrlService).toHaveBeenCalledWith(
      TENANT_ID,
      INVOICE_ID
    )
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it.each([{status: 'not_found'}, {status: 'unavailable'}] as const)(
    'facture introuvable ou PDF indisponible (%o) : un échec, jamais un lien mort',
    async (result) => {
      vi.mocked(getMyInvoicePdfUrlService).mockResolvedValue(result)

      expect(await openMyInvoicePdfAction(INVOICE_ID)).toEqual({
        status: 'unavailable',
      })
    }
  )

  it('sans session ou en panne : un échec rendu, jamais levé', async () => {
    vi.mocked(requireActionAuth).mockRejectedValueOnce(
      new AuthorizationError('x')
    )
    expect(await openMyInvoicePdfAction(INVOICE_ID)).toEqual({
      status: 'unavailable',
    })
    expect(getMyInvoicePdfUrlService).not.toHaveBeenCalled()

    vi.mocked(getMyInvoicePdfUrlService).mockRejectedValue(new Error('x'))
    expect(await openMyInvoicePdfAction(INVOICE_ID)).toEqual({
      status: 'unavailable',
    })
  })
})
