import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({revalidatePath: vi.fn()}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`)
  }),
}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve((key: string) => `BureauMemberProfilesPage.${key}`)
  ),
}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/services/facades/member-profile-service-facade', () => ({
  createMemberProfileService: vi.fn(),
  getMemberProfilePageService: vi.fn(),
  getMemberProfileService: vi.fn(),
  updateMemberProfileContactService: vi.fn(),
}))
vi.mock('@/services/facades/member-role-service-facade', () => ({
  changeMemberRoleService: vi.fn(),
}))
vi.mock('@/services/facades/parcel-ownership-service-facade', () => ({
  attachParcelService: vi.fn(),
  recordSaleService: vi.fn(),
}))

import {revalidatePath} from 'next/cache'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {
  createMemberProfileService,
  getMemberProfilePageService,
  getMemberProfileService,
  updateMemberProfileContactService,
} from '@/services/facades/member-profile-service-facade'
import {changeMemberRoleService} from '@/services/facades/member-role-service-facade'
import {
  attachParcelService,
  recordSaleService,
} from '@/services/facades/parcel-ownership-service-facade'
import type {MemberProfileDTO} from '@/services/types/domain/member-profile-types'

import {
  attachParcelAction,
  changeMemberRoleAction,
  createMemberProfileAction,
  recordSaleAction,
  searchBuyersAction,
  updateMemberProfileContactAction,
} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_PROFILE_ID = '44444444-4444-4444-8444-444444444444'
const PARCEL_ID = '66666666-6666-4666-8666-666666666666'
const ROUTE = '/[locale]/(bureau)/bureau/proprietaires'

const formOf = (values: Record<string, string>) => {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) formData.set(key, value)
  return formData
}

const profile = (
  overrides: Partial<MemberProfileDTO> = {}
): MemberProfileDTO => ({
  id: PROFILE_ID,
  organizationId: TENANT_ID,
  name: 'Marcel Laurent',
  email: null,
  phone: null,
  addressLine: null,
  addressComplement: null,
  postalCode: null,
  city: null,
  mailOnly: true,
  incomplete: true,
  account: {status: 'mail_only'},
  roleCard: {
    reading: 'no_account',
    canEdit: false,
    notice: null,
    options: [],
    self: false,
  },
  ...overrides,
})

const blankContact = {
  email: '',
  phone: '',
  addressLine: '',
  addressComplement: '',
  postalCode: '',
  city: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(requireActionAuth).mockResolvedValue({id: 'u1'} as never)
  vi.mocked(createMemberProfileService).mockResolvedValue({
    status: 'saved',
    profile: profile(),
    accountChange: null,
  })
  vi.mocked(updateMemberProfileContactService).mockResolvedValue({
    status: 'saved',
    profile: profile(),
    accountChange: null,
  })
  vi.mocked(getMemberProfileService).mockResolvedValue(
    profile({id: OTHER_PROFILE_ID, name: 'Claire Meunier'})
  )
  vi.mocked(attachParcelService).mockResolvedValue({
    status: 'attached',
    parcelId: PARCEL_ID,
    parcelNumber: '52',
    parcelCreated: true,
  })
  vi.mocked(recordSaleService).mockResolvedValue({status: 'recorded'})
  vi.mocked(getMemberProfilePageService).mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 1,
    profileCount: 0,
    incompleteCount: 0,
  })
})

describe('createMemberProfileAction', () => {
  it('enregistre un propriétaire sans email ni adresse, puis revalide le segment (critères 7 et 8)', async () => {
    const result = await createMemberProfileAction(
      undefined,
      formOf({name: 'Marcel Laurent', ...blankContact})
    )

    expect(result).toEqual({
      status: 'saved',
      memberProfileId: PROFILE_ID,
      accountChange: null,
    })
    expect(createMemberProfileService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      name: 'Marcel Laurent',
      ...blankContact,
    })
    expect(revalidatePath).toHaveBeenCalledWith(ROUTE, 'layout')
  })

  it('rend les erreurs par champ sans appeler la façade ni revalider', async () => {
    const result = await createMemberProfileAction(
      undefined,
      formOf({
        ...blankContact,
        name: '  ',
        email: 'marcel.laurent@example',
        postalCode: '3368',
      })
    )

    expect(result).toEqual({
      status: 'invalid',
      errors: [
        {
          field: 'name',
          message: 'BureauMemberProfilesPage.validation.nameRequired',
        },
        {
          field: 'email',
          message: 'BureauMemberProfilesPage.validation.emailInvalid',
        },
        {
          field: 'postalCode',
          message: 'BureauMemberProfilesPage.validation.postalCodeInvalid',
        },
      ],
    })
    expect(createMemberProfileService).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('rend l’email déjà pris avec la fiche qui le porte, sans revalider (état 2e)', async () => {
    vi.mocked(createMemberProfileService).mockResolvedValue({
      status: 'email_taken',
      memberProfileId: OTHER_PROFILE_ID,
    })

    const result = await createMemberProfileAction(
      undefined,
      formOf({...blankContact, name: 'Claire M.', email: 'claire@example.fr'})
    )

    expect(result).toEqual({
      status: 'email_taken',
      memberProfileId: OTHER_PROFILE_ID,
      name: 'Claire Meunier',
    })
    expect(getMemberProfileService).toHaveBeenCalledWith(
      TENANT_ID,
      OTHER_PROFILE_ID
    )
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('refuse sans session, sans appeler la façade', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    const result = await createMemberProfileAction(
      undefined,
      formOf({name: 'Marcel Laurent', ...blankContact})
    )

    expect(result).toEqual({
      status: 'error',
      message: 'BureauMemberProfilesPage.errors.forbidden',
    })
    expect(createMemberProfileService).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('rend le refus du service à qui n’est pas au bureau, sans revalider', async () => {
    vi.mocked(createMemberProfileService).mockRejectedValue(
      new AuthorizationError()
    )

    const result = await createMemberProfileAction(
      undefined,
      formOf({name: 'Marcel Laurent', ...blankContact})
    )

    expect(result).toEqual({
      status: 'error',
      message: 'BureauMemberProfilesPage.errors.forbidden',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('rend une panne comme un échec, sans détail technique', async () => {
    vi.mocked(createMemberProfileService).mockRejectedValue(
      new Error('pg down')
    )

    const result = await createMemberProfileAction(
      undefined,
      formOf({name: 'Marcel Laurent', ...blankContact})
    )

    expect(result).toEqual({
      status: 'error',
      message: 'BureauMemberProfilesPage.errors.failed',
    })
  })
})

describe('updateMemberProfileContactAction', () => {
  const contactForm = (values: Partial<typeof blankContact> = {}) =>
    formOf({memberProfileId: PROFILE_ID, ...blankContact, ...values})

  it('met à jour les coordonnées de la fiche, puis revalide le segment (critère 6)', async () => {
    const result = await updateMemberProfileContactAction(
      undefined,
      contactForm({phone: '06 12 34 56 78', city: 'Lacanau'})
    )

    expect(result).toEqual({
      status: 'saved',
      memberProfileId: PROFILE_ID,
      accountChange: null,
    })
    expect(updateMemberProfileContactService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      memberProfileId: PROFILE_ID,
      ...blankContact,
      phone: '06 12 34 56 78',
      city: 'Lacanau',
    })
    expect(revalidatePath).toHaveBeenCalledWith(ROUTE, 'layout')
  })

  it.each(['opened', 'closed', 'replaced'] as const)(
    'porte le changement d’accès « %s » pour le message de l’écran (s12d)',
    async (accountChange) => {
      vi.mocked(updateMemberProfileContactService).mockResolvedValue({
        status: 'saved',
        profile: profile(),
        accountChange,
      })

      const result = await updateMemberProfileContactAction(
        undefined,
        contactForm({email: 'odile@example.test'})
      )

      expect(result).toEqual({
        status: 'saved',
        memberProfileId: PROFILE_ID,
        accountChange,
      })
    }
  )

  it('rend le refus du bureau sans revalider : rien n’a été écrit (s12d, A9)', async () => {
    vi.mocked(updateMemberProfileContactService).mockResolvedValue({
      status: 'board_email_required',
    })

    const result = await updateMemberProfileContactAction(
      undefined,
      contactForm()
    )

    expect(result).toEqual({status: 'board_email_required'})
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('rend les erreurs par champ sans appeler la façade', async () => {
    const result = await updateMemberProfileContactAction(
      undefined,
      contactForm({phone: 'appelez-moi'})
    )

    expect(result).toEqual({
      status: 'invalid',
      errors: [
        {
          field: 'phone',
          message: 'BureauMemberProfilesPage.validation.phoneInvalid',
        },
      ],
    })
    expect(updateMemberProfileContactService).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('rend une fiche introuvable comme un échec, sans revalider', async () => {
    vi.mocked(updateMemberProfileContactService).mockResolvedValue({
      status: 'not_found',
    })

    const result = await updateMemberProfileContactAction(
      undefined,
      contactForm()
    )

    expect(result).toEqual({
      status: 'error',
      message: 'BureauMemberProfilesPage.errors.notFound',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('refuse à qui n’est pas au bureau, sans revalider', async () => {
    vi.mocked(updateMemberProfileContactService).mockRejectedValue(
      new AuthorizationError()
    )

    const result = await updateMemberProfileContactAction(
      undefined,
      contactForm()
    )

    expect(result).toEqual({
      status: 'error',
      message: 'BureauMemberProfilesPage.errors.forbidden',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('attachParcelAction', () => {
  const attachForm = (values: Record<string, string> = {}) =>
    formOf({
      memberProfileId: PROFILE_ID,
      parcelNumber: '52',
      startsOn: '29/09/2026',
      ...values,
    })

  it('rattache la parcelle à partir de la date saisie, puis revalide le segment (critère 1)', async () => {
    const result = await attachParcelAction(undefined, attachForm())

    expect(result).toEqual({
      status: 'attached',
      parcelNumber: '52',
      parcelCreated: true,
      startsOn: '2026-09-29',
    })
    expect(attachParcelService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      memberProfileId: PROFILE_ID,
      parcelNumber: '52',
      startsOn: '2026-09-29',
    })
    expect(revalidatePath).toHaveBeenCalledWith(ROUTE, 'layout')
  })

  it('refuse un numéro vide et une date qui n’existe pas, sans appeler la façade (état 4b)', async () => {
    const result = await attachParcelAction(
      undefined,
      attachForm({parcelNumber: ' ', startsOn: '31/02/2026'})
    )

    expect(result).toEqual({
      status: 'invalid',
      errors: [
        {
          field: 'parcelNumber',
          message: 'BureauMemberProfilesPage.validation.parcelNumberRequired',
        },
        {
          field: 'startsOn',
          message: 'BureauMemberProfilesPage.validation.dateInvalid',
        },
      ],
    })
    expect(attachParcelService).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('rend le chevauchement avec le propriétaire en place, sans revalider (critère 4)', async () => {
    const conflict = {
      memberProfileId: OTHER_PROFILE_ID,
      name: 'Paul Ferrand',
      startsOn: '2026-06-15',
      endsOn: null,
    }
    vi.mocked(attachParcelService).mockResolvedValue({
      status: 'overlap',
      parcelNumber: '47',
      conflict,
    })

    const result = await attachParcelAction(
      undefined,
      attachForm({parcelNumber: '47'})
    )

    expect(result).toEqual({status: 'overlap', parcelNumber: '47', conflict})
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('rend le refus d’une date future tel quel, sans revalider', async () => {
    vi.mocked(attachParcelService).mockResolvedValue({status: 'future_date'})

    const result = await attachParcelAction(undefined, attachForm())

    expect(result).toEqual({status: 'future_date'})
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('refuse à qui n’est pas au bureau, sans revalider', async () => {
    vi.mocked(attachParcelService).mockRejectedValue(new AuthorizationError())

    const result = await attachParcelAction(undefined, attachForm())

    expect(result).toEqual({
      status: 'error',
      message: 'BureauMemberProfilesPage.errors.forbidden',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('refuse sans session, sans appeler la façade', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    const result = await attachParcelAction(undefined, attachForm())

    expect(result.status).toBe('error')
    expect(attachParcelService).not.toHaveBeenCalled()
  })
})

describe('recordSaleAction', () => {
  const saleForm = (values: Record<string, string> = {}) =>
    formOf({
      sellerId: PROFILE_ID,
      parcelId: PARCEL_ID,
      buyerId: OTHER_PROFILE_ID,
      date: '15/06/2026',
      ...values,
    })

  it('enregistre la vente à la date saisie, puis revalide le segment (critère 2)', async () => {
    const result = await recordSaleAction(undefined, saleForm())

    expect(result).toEqual({status: 'recorded'})
    expect(recordSaleService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      parcelId: PARCEL_ID,
      sellerId: PROFILE_ID,
      buyerId: OTHER_PROFILE_ID,
      date: '2026-06-15',
    })
    expect(revalidatePath).toHaveBeenCalledWith(ROUTE, 'layout')
  })

  it('refuse une date qui n’existe pas et un acquéreur absent, sans appeler la façade', async () => {
    const result = await recordSaleAction(
      undefined,
      saleForm({date: '31/02/2026', buyerId: ''})
    )

    expect(result).toEqual({
      status: 'invalid',
      errors: [
        {
          field: 'date',
          message: 'BureauMemberProfilesPage.validation.dateInvalid',
        },
        {
          field: 'buyerId',
          message: 'BureauMemberProfilesPage.validation.buyerRequired',
        },
      ],
    })
    expect(recordSaleService).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it.each([
    [{status: 'date_not_after_start', startsOn: '1998-02-03'} as const],
    [{status: 'buyer_is_seller'} as const],
    [{status: 'no_open_period'} as const],
    [{status: 'future_date'} as const],
    [
      {
        status: 'overlap',
        conflict: {
          memberProfileId: OTHER_PROFILE_ID,
          name: 'Paul Ferrand',
          startsOn: '2026-06-15',
          endsOn: null,
        },
      } as const,
    ],
  ])(
    'rend le refus $status tel quel : aucune écriture, aucune revalidation',
    async (refusal) => {
      vi.mocked(recordSaleService).mockResolvedValue(refusal)

      const result = await recordSaleAction(undefined, saleForm())

      expect(result).toEqual(refusal)
      expect(recordSaleService).toHaveBeenCalledTimes(1)
      expect(attachParcelService).not.toHaveBeenCalled()
      expect(revalidatePath).not.toHaveBeenCalled()
    }
  )

  it('rend une parcelle ou un acquéreur introuvable comme un échec', async () => {
    vi.mocked(recordSaleService).mockResolvedValue({status: 'not_found'})

    const result = await recordSaleAction(undefined, saleForm())

    expect(result).toEqual({
      status: 'error',
      message: 'BureauMemberProfilesPage.errors.notFound',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('refuse à qui n’est pas au bureau, sans revalider', async () => {
    vi.mocked(recordSaleService).mockRejectedValue(new AuthorizationError())

    const result = await recordSaleAction(undefined, saleForm())

    expect(result).toEqual({
      status: 'error',
      message: 'BureauMemberProfilesPage.errors.forbidden',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('refuse sans session, sans appeler la façade', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    const result = await recordSaleAction(undefined, saleForm())

    expect(result.status).toBe('error')
    expect(recordSaleService).not.toHaveBeenCalled()
  })
})

describe('searchBuyersAction', () => {
  it('rend les fiches qui répondent à la recherche, avec leurs parcelles actuelles', async () => {
    vi.mocked(getMemberProfilePageService).mockResolvedValue({
      items: [
        {
          ...profile({name: 'Paul Ferrand'}),
          currentParcelNumbers: [],
          boardRole: null,
        },
        {
          ...profile({id: OTHER_PROFILE_ID, name: 'Sophie Ferreira'}),
          currentParcelNumbers: ['8'],
          boardRole: null,
        },
      ],
      page: 1,
      pageSize: 25,
      total: 2,
      totalPages: 1,
      profileCount: 412,
      incompleteCount: 0,
    })

    const options = await searchBuyersAction(' Ferr ')

    expect(getMemberProfilePageService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      page: 1,
      search: 'Ferr',
    })
    expect(options).toEqual([
      {id: PROFILE_ID, name: 'Paul Ferrand', currentParcelNumbers: []},
      {
        id: OTHER_PROFILE_ID,
        name: 'Sophie Ferreira',
        currentParcelNumbers: ['8'],
      },
    ])
  })

  it('ne cherche rien pour une saisie vide', async () => {
    expect(await searchBuyersAction('   ')).toEqual([])
    expect(getMemberProfilePageService).not.toHaveBeenCalled()
  })

  it('ne rend rien sans session ni à qui n’est pas au bureau', async () => {
    vi.mocked(requireActionAuth).mockRejectedValueOnce(new AuthorizationError())
    expect(await searchBuyersAction('Ferr')).toEqual([])
    expect(getMemberProfilePageService).not.toHaveBeenCalled()

    vi.mocked(getMemberProfilePageService).mockRejectedValue(
      new AuthorizationError()
    )
    expect(await searchBuyersAction('Ferr')).toEqual([])
  })

  it('laisse remonter une panne : la recherche le dira, au lieu de se taire', async () => {
    vi.mocked(getMemberProfilePageService).mockRejectedValue(
      new Error('pg down')
    )

    await expect(searchBuyersAction('Ferr')).rejects.toThrow('pg down')
  })
})

/**
 * s14 : « Enregistrer le rôle ». Messages traduits ici ; une propre
 * rétrogradation renvoie vers l'espace personnel.
 */
describe('changeMemberRoleAction', () => {
  const roleForm = (role: string) => formOf({memberProfileId: PROFILE_ID, role})

  it('enregistre la promotion au Bureau et revalide le segment (critère 1)', async () => {
    vi.mocked(changeMemberRoleService).mockResolvedValue({
      status: 'saved',
      change: 'assigned',
      self: false,
      name: 'Lucie Moreau',
    })

    const result = await changeMemberRoleAction(undefined, roleForm('board'))

    expect(changeMemberRoleService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      memberProfileId: PROFILE_ID,
      role: 'board',
    })
    expect(result).toEqual({
      status: 'saved',
      change: 'assigned',
      message: 'BureauMemberProfilesPage.detail.role.saved.assigned',
    })
    expect(revalidatePath).toHaveBeenCalledWith(ROUTE, 'layout')
  })

  it.each(['demoted', 'presidency_transferred'] as const)(
    'rend la confirmation %s',
    async (change) => {
      vi.mocked(changeMemberRoleService).mockResolvedValue({
        status: 'saved',
        change,
        self: false,
        name: 'Paul Vidal',
      })

      expect(await changeMemberRoleAction(undefined, roleForm('x'))).toEqual({
        status: 'saved',
        change,
        message: `BureauMemberProfilesPage.detail.role.saved.${change}`,
      })
    }
  )

  it('n’écrit rien ni ne revalide quand le choix égale le rôle enregistré', async () => {
    vi.mocked(changeMemberRoleService).mockResolvedValue({
      status: 'saved',
      change: 'none',
      self: false,
      name: 'Paul Vidal',
    })

    expect(await changeMemberRoleAction(undefined, roleForm('board'))).toEqual({
      status: 'saved',
      change: 'none',
      message: null,
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('sa propre rétrogradation renvoie vers /dashboard?role=retire (A12)', async () => {
    vi.mocked(changeMemberRoleService).mockResolvedValue({
      status: 'saved',
      change: 'demoted',
      self: true,
      name: 'Paul Vidal',
    })

    await expect(
      changeMemberRoleAction(undefined, roleForm('member'))
    ).rejects.toThrow('NEXT_REDIRECT:/dashboard?role=retire')
    expect(revalidatePath).toHaveBeenCalledWith(ROUTE, 'layout')
  })

  it.each([
    [false, 'BureauMemberProfilesPage.detail.role.refusals.last_capable'],
    [true, 'BureauMemberProfilesPage.detail.role.refusals.last_capable_self'],
  ])(
    'refuse le dernier compte capable (self = %s), sans revalider (critère 3)',
    async (self, message) => {
      vi.mocked(changeMemberRoleService).mockResolvedValue({
        status: 'refused',
        reason: 'last_capable',
        self,
        name: 'Paul Vidal',
      })

      expect(
        await changeMemberRoleAction(undefined, roleForm('member'))
      ).toEqual({status: 'refused', message})
      expect(revalidatePath).not.toHaveBeenCalled()
    }
  )

  it.each(['presidency_reserved', 'own_presidency', 'invalid_role'] as const)(
    'rend le refus %s',
    async (reason) => {
      vi.mocked(changeMemberRoleService).mockResolvedValue({
        status: 'refused',
        reason,
        self: false,
        name: 'Paul Vidal',
      })

      expect(
        await changeMemberRoleAction(undefined, roleForm('super_admin'))
      ).toEqual({
        status: 'refused',
        message: `BureauMemberProfilesPage.detail.role.refusals.${reason}`,
      })
    }
  )

  it('rend la fiche sans compte et la fiche introuvable', async () => {
    vi.mocked(changeMemberRoleService).mockResolvedValue({status: 'no_account'})
    expect(await changeMemberRoleAction(undefined, roleForm('board'))).toEqual({
      status: 'refused',
      message: 'BureauMemberProfilesPage.detail.role.refusals.no_account',
    })

    vi.mocked(changeMemberRoleService).mockResolvedValue({status: 'not_found'})
    expect(await changeMemberRoleAction(undefined, roleForm('board'))).toEqual({
      status: 'error',
      message: 'BureauMemberProfilesPage.errors.notFound',
    })
  })

  it('refuse sans session, sans appeler la façade', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    expect(await changeMemberRoleAction(undefined, roleForm('board'))).toEqual({
      status: 'error',
      message: 'BureauMemberProfilesPage.errors.forbidden',
    })
    expect(changeMemberRoleService).not.toHaveBeenCalled()
  })

  it('rend le refus du service (compte rétrogradé, critère 2) comme interdit', async () => {
    vi.mocked(changeMemberRoleService).mockRejectedValue(
      new AuthorizationError()
    )

    expect(await changeMemberRoleAction(undefined, roleForm('board'))).toEqual({
      status: 'error',
      message: 'BureauMemberProfilesPage.errors.forbidden',
    })
  })
})
