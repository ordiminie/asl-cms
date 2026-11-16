import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({revalidatePath: vi.fn()}))
vi.mock('next-intl/server', () => ({
  getLocale: vi.fn(() => Promise.resolve('fr')),
  getTranslations: vi.fn(() =>
    Promise.resolve((key: string) => `MemberSpacePage.emails.${key}`)
  ),
}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/services/facades/my-email-service-facade', () => ({
  addMyEmailService: vi.fn(),
  cancelMyPendingEmailService: vi.fn(),
  correctMyPendingEmailService: vi.fn(),
  updateMyEmailService: vi.fn(),
}))

import {revalidatePath} from 'next/cache'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {
  addMyEmailService,
  cancelMyPendingEmailService,
  correctMyPendingEmailService,
  updateMyEmailService,
} from '@/services/facades/my-email-service-facade'

import {
  addMyEmailAction,
  cancelMyPendingEmailAction,
  correctMyPendingEmailAction,
  updateMyEmailAction,
} from './email-actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const EMAIL_ID = '44444444-4444-4444-8444-444444444444'

const formOf = (values: Record<string, string>) => {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) formData.set(key, value)
  return formData
}

const SENT = {
  status: 'sent' as const,
  email: 'sophie@exemple.fr',
  expiresAt: '2026-11-23T10:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({
    id: TENANT_ID,
  } as never)
  vi.mocked(requireActionAuth).mockResolvedValue({} as never)
  vi.mocked(addMyEmailService).mockResolvedValue(SENT)
  vi.mocked(updateMyEmailService).mockResolvedValue(SENT)
  vi.mocked(correctMyPendingEmailService).mockResolvedValue(SENT)
  vi.mocked(cancelMyPendingEmailService).mockResolvedValue({
    status: 'cancelled',
  })
})

describe('addMyEmailAction (1b, 1c)', () => {
  it('ajoute au tenant du domaine appelé, sans identifiant de fiche ni d’auteur venus du formulaire, puis revalide', async () => {
    await expect(
      addMyEmailAction(
        undefined,
        formOf({
          email: ' sophie@exemple.fr ',
          memberProfileId: 'autre-fiche',
          addedByUserId: 'autre-compte',
          organizationId: 'autre-association',
        })
      )
    ).resolves.toEqual(SENT)
    expect(addMyEmailService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      email: 'sophie@exemple.fr',
      locale: 'fr',
    })
    expect(revalidatePath).toHaveBeenCalled()
  })

  it('refuse une adresse invalide sans appeler la façade', async () => {
    await expect(
      addMyEmailAction(undefined, formOf({email: 'pas-une-adresse'}))
    ).resolves.toEqual({
      status: 'invalid',
      message: 'MemberSpacePage.emails.validation.emailInvalid',
    })
    expect(addMyEmailService).not.toHaveBeenCalled()
  })

  it('rend le refus du critère 7 sans revalider', async () => {
    vi.mocked(addMyEmailService).mockResolvedValue({status: 'taken'})

    await expect(
      addMyEmailAction(undefined, formOf({email: 'voisin@exemple.fr'}))
    ).resolves.toEqual({status: 'taken'})
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('sans session, ne touche à rien', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    await expect(
      addMyEmailAction(undefined, formOf({email: 'sophie@exemple.fr'}))
    ).resolves.toEqual({
      status: 'error',
      message: 'MemberSpacePage.emails.errors.failed',
    })
    expect(addMyEmailService).not.toHaveBeenCalled()
  })
})

describe('updateMyEmailAction, correctMyPendingEmailAction, cancelMyPendingEmailAction', () => {
  it('transmet la ligne désignée, que le service revérifie', async () => {
    await updateMyEmailAction(
      undefined,
      formOf({emailId: EMAIL_ID, email: 'claire@exemple.fr'})
    )
    await correctMyPendingEmailAction(
      undefined,
      formOf({emailId: EMAIL_ID, email: 'marc@exemple.fr'})
    )
    await cancelMyPendingEmailAction(undefined, formOf({emailId: EMAIL_ID}))

    expect(updateMyEmailService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      emailId: EMAIL_ID,
      email: 'claire@exemple.fr',
      locale: 'fr',
    })
    expect(correctMyPendingEmailService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      emailId: EMAIL_ID,
      email: 'marc@exemple.fr',
      locale: 'fr',
    })
    expect(cancelMyPendingEmailService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      emailId: EMAIL_ID,
    })
  })

  it('un refus du service (adresse d’un autre) rend un échec sans revalider', async () => {
    vi.mocked(cancelMyPendingEmailService).mockRejectedValue(
      new AuthorizationError()
    )

    await expect(
      cancelMyPendingEmailAction(undefined, formOf({emailId: EMAIL_ID}))
    ).resolves.toEqual({
      status: 'error',
      message: 'MemberSpacePage.emails.errors.failed',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
