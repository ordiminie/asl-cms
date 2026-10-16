import {beforeEach, describe, expect, it, vi} from 'vitest'

/*
 * s47, critère 1 : la vraie garde `requireActionAuth` → `hasRequiredRoles`
 * s'exécute. Seule la session (`getAuthUser`) est doublée. Hors rendu serveur,
 * `cache()` de React ne mémorise pas : chaque cas pose son propre compte.
 */
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}))
vi.mock('@/services/authentication/auth-service', () => ({
  getAuthUser: vi.fn(),
  getSessionActiveOrganizationId: vi.fn(),
}))
vi.mock('@/app/dal/tenant-dal', () => ({
  getCurrentTenantDal: vi.fn(),
  TENANT_CACHE_TAG: 'tenant',
}))
vi.mock('@/services/facades/user-service-facade', () => ({}))
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

import {withRlsBypass} from '@/db/tenant-scope'
import {getAuthUser} from '@/services/authentication/auth-service'
import {canInviteToOrganization} from '@/services/authorization/organization-authorization'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {
  createOrganizationMemberService,
  deleteInvitationByIdService,
  deleteOrganizationService,
  provisionOrganizationService,
  updateOrganizationModulesService,
  updateOrganizationService,
} from '@/services/facades/organization-service-facade'

import {
  addUserToOrganizationAction,
  deleteAdminMemberInvitationAction,
  deleteOrganizationAction,
  provisionOrganizationAction,
  updateOrganizationAction,
  updateOrganizationModulesAction,
} from './actions'

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '33333333-3333-4333-8333-333333333333'

const account = (role: string) => ({id: `${role}-1`, role}) as never

const provisionForm = () => {
  const formData = new FormData()
  formData.set('name', 'ASL La Fourche')
  formData.set('slug', 'asl-la-fourche')
  formData.set('domain', 'asl-lafourche.fr')
  formData.set('adminEmail', 'presidence@asl-lafourche.fr')
  formData.set('contactEmail', 'contact@asl-provisionnee.test')
  formData.append('modules', 'voirie')
  formData.append('modules', 'vote')
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(account('super_admin'))
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
    vi.mocked(getAuthUser).mockResolvedValue(account('user'))

    await expect(
      provisionOrganizationAction(undefined, provisionForm())
    ).rejects.toThrow(AuthorizationError)
    expect(provisionOrganizationService).not.toHaveBeenCalled()
  })

  it('transmet les six champs du formulaire, modules cochés compris', async () => {
    const state = await provisionOrganizationAction(undefined, provisionForm())

    expect(state.success).toBe(true)
    expect(provisionOrganizationService).toHaveBeenCalledWith({
      name: 'ASL La Fourche',
      slug: 'asl-la-fourche',
      domain: 'asl-lafourche.fr',
      adminEmail: 'presidence@asl-lafourche.fr',
      contactEmail: 'contact@asl-provisionnee.test',
      enabledModules: ['voirie', 'vote'],
    })
  })

  it('sans adresse de contact, la transmet vide : le service refuse la creation', async () => {
    const formData = provisionForm()
    formData.delete('contactEmail')
    vi.mocked(provisionOrganizationService).mockRejectedValue(
      new Error(
        "L'adresse de contact de l'association est obligatoire et doit être valide."
      )
    )

    const state = await provisionOrganizationAction(undefined, formData)

    expect(provisionOrganizationService).toHaveBeenCalledWith(
      expect.objectContaining({contactEmail: ''})
    )
    expect(state.success).toBe(false)
    expect(state.message).toContain('adresse de contact')
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
    vi.mocked(getAuthUser).mockResolvedValue(undefined)

    await expect(
      provisionOrganizationAction(undefined, provisionForm())
    ).rejects.toThrow(AuthorizationError)

    expect(provisionOrganizationService).not.toHaveBeenCalled()
  })
})

describe('updateOrganizationModulesAction', () => {
  it('est reservee au SuperAdmin', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(account('user'))

    await expect(
      updateOrganizationModulesAction(ORGANIZATION_ID, ['vote'])
    ).rejects.toThrow(AuthorizationError)
    expect(updateOrganizationModulesService).not.toHaveBeenCalled()
  })

  it('transmet la liste complete', async () => {
    const state = await updateOrganizationModulesAction(ORGANIZATION_ID, [
      'vote',
    ])

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

const organizationForm = () => {
  const formData = new FormData()
  formData.set('name', 'ASL La Fourche')
  formData.set('slug', 'asl-la-fourche')
  return formData
}

describe('actions de /admin/organizations — réservées au SuperAdmin (s47)', () => {
  const cases = [
    {
      name: 'updateOrganizationAction',
      call: () =>
        updateOrganizationAction(
          ORGANIZATION_ID,
          undefined,
          organizationForm()
        ),
      service: updateOrganizationService,
    },
    {
      name: 'deleteOrganizationAction',
      call: () => deleteOrganizationAction(ORGANIZATION_ID),
      service: deleteOrganizationService,
    },
    {
      name: 'addUserToOrganizationAction',
      call: () =>
        addUserToOrganizationAction(ORGANIZATION_ID, USER_ID, 'm@asl.test'),
      service: createOrganizationMemberService,
    },
    {
      name: 'deleteAdminMemberInvitationAction',
      call: () =>
        deleteAdminMemberInvitationAction(ORGANIZATION_ID, 'invitation-1'),
      service: deleteInvitationByIdService,
    },
  ]

  beforeEach(() => {
    vi.mocked(canInviteToOrganization).mockResolvedValue(true)
  })

  it.each(cases)(
    '[USER] $name refuse un compte user sans appeler le service',
    async ({call, service}) => {
      vi.mocked(getAuthUser).mockResolvedValue(account('user'))

      await expect(call()).rejects.toThrow(AuthorizationError)
      expect(service).not.toHaveBeenCalled()
    }
  )

  it.each(cases)(
    '[SUPER_ADMIN] $name atteint son service',
    async ({call, service}) => {
      vi.mocked(getAuthUser).mockResolvedValue(account('super_admin'))

      await call()

      expect(service).toHaveBeenCalledTimes(1)
    }
  )
})
