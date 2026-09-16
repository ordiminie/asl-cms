import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/db/tenant-scope', () => ({
  withRlsBypass: vi.fn(
    async (callback: () => Promise<unknown>) => await callback()
  ),
}))
vi.mock('@/services/authorization/organization-authorization', () => ({
  canInviteToOrganization: vi.fn(),
}))
vi.mock('@/services/facades/organization-service-facade', () => ({
  createOrganizationMemberService: vi.fn(),
  deleteInvitationByIdService: vi.fn(),
  deleteOrganizationService: vi.fn(),
  provisionOrganizationService: vi.fn(),
  updateOrganizationModulesService: vi.fn(),
  updateOrganizationService: vi.fn(),
}))

import {updateTag} from 'next/cache'

import {requireActionAuth} from '@/app/dal/user-dal'
import {withRlsBypass} from '@/db/tenant-scope'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {
  provisionOrganizationService,
  updateOrganizationModulesService,
} from '@/services/facades/organization-service-facade'
import {RoleConst} from '@/services/types/domain/auth-types'

import {
  provisionOrganizationAction,
  updateOrganizationModulesAction,
} from './actions'

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111'

const provisionForm = () => {
  const formData = new FormData()
  formData.set('name', 'ASL La Fourche')
  formData.set('slug', 'asl-la-fourche')
  formData.set('domain', 'asl-lafourche.fr')
  formData.set('adminEmail', 'presidence@asl-lafourche.fr')
  formData.append('modules', 'voirie')
  formData.append('modules', 'vote')
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireActionAuth).mockResolvedValue({id: 'super'} as never)
  vi.mocked(provisionOrganizationService).mockResolvedValue({
    organization: {
      id: ORGANIZATION_ID,
      name: 'ASL La Fourche',
      domain: 'asl-lafourche.fr',
    },
    adminUserId: '22222222-2222-4222-8222-222222222222',
    adminAccountCreated: true,
  } as never)
})

describe('provisionOrganizationAction', () => {
  it('est reservee au SuperAdmin Zourite Studio', async () => {
    await provisionOrganizationAction(undefined, provisionForm())

    expect(requireActionAuth).toHaveBeenCalledWith({
      roles: [RoleConst.SUPER_ADMIN],
    })
  })

  it('transmet les cinq champs du formulaire, modules cochés compris', async () => {
    const state = await provisionOrganizationAction(undefined, provisionForm())

    expect(state.success).toBe(true)
    expect(provisionOrganizationService).toHaveBeenCalledWith({
      name: 'ASL La Fourche',
      slug: 'asl-la-fourche',
      domain: 'asl-lafourche.fr',
      adminEmail: 'presidence@asl-lafourche.fr',
      enabledModules: ['voirie', 'vote'],
    })
  })

  it('provisionne sans aucun module quand aucune case n est cochee', async () => {
    const formData = provisionForm()
    formData.delete('modules')

    await provisionOrganizationAction(undefined, formData)

    expect(provisionOrganizationService).toHaveBeenCalledWith(
      expect.objectContaining({enabledModules: []})
    )
  })

  it("s'execute sous la porte SuperAdmin : le tenant n'existe pas encore", async () => {
    await provisionOrganizationAction(undefined, provisionForm())

    expect(withRlsBypass).toHaveBeenCalled()
  })

  it('invalide le cache de resolution de domaine, sans quoi le nouveau site reste introuvable', async () => {
    await provisionOrganizationAction(undefined, provisionForm())

    expect(updateTag).toHaveBeenCalledWith('tenant')
  })

  it('rend le nom, le domaine et le compte administrateur pour le message de succes', async () => {
    const state = await provisionOrganizationAction(undefined, provisionForm())

    expect(state.organizationId).toBe(ORGANIZATION_ID)
    expect(state.domain).toBe('asl-lafourche.fr')
    expect(state.adminEmail).toBe('presidence@asl-lafourche.fr')
  })

  it('rend l erreur metier telle quelle : le domaine deja pris se lit a l ecran', async () => {
    vi.mocked(provisionOrganizationService).mockRejectedValue(
      new Error("Ce domaine sert déjà l'association « ASL Les Sources ».")
    )

    const state = await provisionOrganizationAction(undefined, provisionForm())

    expect(state.success).toBe(false)
    expect(state.message).toContain('ASL Les Sources')
  })

  it('refuse sans formulaire', async () => {
    const state = await provisionOrganizationAction(undefined, undefined)

    expect(state.success).toBe(false)
    expect(provisionOrganizationService).not.toHaveBeenCalled()
  })

  it("laisse remonter le refus d'autorisation", async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    await expect(
      provisionOrganizationAction(undefined, provisionForm())
    ).rejects.toThrow(AuthorizationError)

    expect(provisionOrganizationService).not.toHaveBeenCalled()
  })
})

describe('updateOrganizationModulesAction', () => {
  it('est reservee au SuperAdmin et transmet la liste complete', async () => {
    const state = await updateOrganizationModulesAction(ORGANIZATION_ID, [
      'vote',
    ])

    expect(requireActionAuth).toHaveBeenCalledWith({
      roles: [RoleConst.SUPER_ADMIN],
    })
    expect(updateOrganizationModulesService).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      ['vote']
    )
    expect(state.success).toBe(true)
  })

  it('invalide le cache de tenant : les drapeaux voyagent avec la resolution', async () => {
    await updateOrganizationModulesAction(ORGANIZATION_ID, [])

    expect(updateTag).toHaveBeenCalledWith('tenant')
  })

  it('rend l echec sans rien pretendre avoir change', async () => {
    vi.mocked(updateOrganizationModulesService).mockRejectedValue(
      new Error('boom')
    )

    const state = await updateOrganizationModulesAction(ORGANIZATION_ID, [
      'vote',
    ])

    expect(state.success).toBe(false)
  })
})
