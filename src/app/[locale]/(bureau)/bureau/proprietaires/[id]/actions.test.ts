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
import {
  addMemberProfileEmailService,
  designateMemberProfileHolderService,
  removeMemberProfileEmailService,
  updateMemberProfileEmailService,
} from '@/services/facades/member-profile-email-service-facade'
import type {MemberProfileDTO} from '@/services/types/domain/member-profile-types'

import {
  addMemberProfileEmailAction,
  designateMemberProfileHolderAction,
  removeMemberProfileEmailAction,
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
