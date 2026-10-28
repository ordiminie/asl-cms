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
}))

import {revalidatePath} from 'next/cache'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {updateMyContactService} from '@/services/facades/member-space-service-facade'

import {updateMyContactAction} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_PROFILE_ID = '44444444-4444-4444-8444-444444444444'

const CONTACT = {
  phone: '06 12 34 56 78',
  addressLine: '4 chemin des Oliviers',
  addressComplement: 'Bâtiment B',
  postalCode: '13100',
  city: 'Aix-en-Provence',
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
    contact: {email: 'lucie.moreau@exemple.fr', ...CONTACT},
  })
})

describe('updateMyContactAction — « Mes coordonnées » (s16)', () => {
  it('rend les erreurs par champ pour une saisie invalide, sans appeler le service', async () => {
    const result = await updateMyContactAction(
      undefined,
      formOf({...CONTACT, phone: '06 12 AB 56 78', postalCode: '1310'})
    )

    expect(result).toEqual({
      status: 'invalid',
      errors: [
        {
          field: 'phone',
          message: 'BureauMemberProfilesPage.validation.phoneInvalid',
        },
        {
          field: 'postalCode',
          message: 'BureauMemberProfilesPage.validation.postalCodeInvalid',
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
      })
    )

    expect(updateMyContactService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      ...CONTACT,
    })
    const input = vi.mocked(updateMyContactService).mock.calls[0][0]
    expect(input).not.toHaveProperty('memberProfileId')
    expect(input).not.toHaveProperty('email')
  })

  it('rend les coordonnées enregistrées et revalide l’espace membre', async () => {
    const result = await updateMyContactAction(undefined, formOf(CONTACT))

    expect(result).toEqual({
      status: 'saved',
      contact: {email: 'lucie.moreau@exemple.fr', ...CONTACT},
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
