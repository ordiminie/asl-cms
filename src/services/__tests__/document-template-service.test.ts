import {beforeEach, describe, expect, it, vi} from 'vitest'

const scope = vi.hoisted(() => ({current: undefined as string | undefined}))
/** Actions retirees au compte connecte : un role qui ne les porterait pas. */
const denied = vi.hoisted(() => ({actions: [] as string[]}))

vi.mock('../authorization/action-registry-authorization', async () => {
  const actual = await vi.importActual<
    typeof import('../authorization/action-registry-authorization')
  >('../authorization/action-registry-authorization')
  return {
    ...actual,
    canPerformAction: vi.fn(
      (...args: Parameters<typeof actual.canPerformAction>) =>
        !denied.actions.includes(args[2]) && actual.canPerformAction(...args)
    ),
  }
})

vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (organizationId: string, callback: () => unknown) => {
    scope.current = organizationId
    try {
      return await callback()
    } finally {
      scope.current = undefined
    }
  }),
}))
vi.mock('@/db/repositories/document-template-repository', () => ({
  listDocumentTemplatesDao: vi.fn(),
  getDocumentTemplateByIdDao: vi.fn(),
  createDocumentTemplateDao: vi.fn(),
  updateDocumentTemplateDao: vi.fn(),
  deleteDocumentTemplateDao: vi.fn(),
}))

vi.mock('@/db/repositories/member-profile-repository', () => ({
  getMemberProfileByIdDao: vi.fn(),
  getCurrentParcelNumbersByProfileDao: vi.fn(),
}))
vi.mock('../campaign-letter-service', () => ({
  readLetterAssociation: vi.fn(),
}))
vi.mock('@/lib/letters/render-letters-pdf', () => ({
  renderLettersPdf: vi.fn(),
}))
vi.mock('@/db/repositories/campaign-repository', () => ({
  getCampaignTargetRowsDao: vi.fn(),
}))
vi.mock('@/db/repositories/recipient-group-repository', () => ({
  getRecipientGroupByIdDao: vi.fn(),
  getRecipientGroupMemberIdsDao: vi.fn(),
  listRecipientGroupsDao: vi.fn(),
}))
vi.mock('../association-settings-service', () => ({
  getAssociationSettingsService: vi.fn(),
}))
vi.mock('../billing/resolve-member-billing-provider', () => ({
  resolveMemberBillingProvider: vi.fn(),
}))
vi.mock('../member-document-service', () => ({
  depositMemberDocumentService: vi.fn(),
}))

import {getTranslations} from 'next-intl/server'

import {getCampaignTargetRowsDao} from '@/db/repositories/campaign-repository'
import {
  createDocumentTemplateDao,
  deleteDocumentTemplateDao,
  getDocumentTemplateByIdDao,
  listDocumentTemplatesDao,
  updateDocumentTemplateDao,
} from '@/db/repositories/document-template-repository'
import {
  getCurrentParcelNumbersByProfileDao,
  getMemberProfileByIdDao,
} from '@/db/repositories/member-profile-repository'
import {
  getRecipientGroupByIdDao,
  getRecipientGroupMemberIdsDao,
  listRecipientGroupsDao,
} from '@/db/repositories/recipient-group-repository'
import {renderLettersPdf} from '@/lib/letters/render-letters-pdf'
import {logger} from '@/lib/logger'

import {getAssociationSettingsService} from '../association-settings-service'
import {resolveMemberBillingProvider} from '../billing/resolve-member-billing-provider'
import {readLetterAssociation} from '../campaign-letter-service'
import {
  canManageDocumentTemplatesService,
  createDocumentTemplateService,
  deleteDocumentTemplateService,
  depositTemplateDocumentService,
  getDocumentLotReachService,
  getDocumentTemplateService,
  getTemplateDocumentRecipientService,
  listDocumentLotGroupsService,
  listDocumentTemplatesService,
  renderTemplateDocumentService,
  updateDocumentTemplateService,
} from '../document-template-service'
import {AuthorizationError} from '../errors/authorization-error'
import {CampaignTargetUnavailableError} from '../errors/campaign-errors'
import {NotFoundError} from '../errors/not-found-error'
import {ValidationParsedZodError} from '../errors/validation-error'
import {depositMemberDocumentService} from '../member-document-service'
import {
  DOCUMENT_TEMPLATE_NAME_MAX_LENGTH,
  DOCUMENT_TEMPLATE_SUBJECT_MAX_LENGTH,
} from '../types/domain/document-template-types'
import {MemberDocumentIssueConst} from '../types/domain/member-document-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const TEMPLATE_ID = '33333333-3333-4333-8333-333333333333'
const UPDATED_AT = new Date('2026-11-20T10:00:00Z')

const withRole = (role: OrganizationRole, organizationId = ORG_ID): User => ({
  ...userTest,
  organizations: [
    {
      id: 'membership',
      organizationId,
      userId: userTest.id,
      role,
      createdAt: new Date(),
    },
  ],
})

const templateRow = (overrides: Record<string, unknown> = {}) => ({
  id: TEMPLATE_ID,
  organizationId: ORG_ID,
  name: 'Convocation AG',
  subject: 'Convocation — {association}',
  bodyMarkdown: 'Bonjour {nom}, le {date}.',
  createdAt: UPDATED_AT,
  updatedAt: UPDATED_AT,
  ...overrides,
})

const fields = (overrides: Record<string, unknown> = {}) => ({
  organizationId: ORG_ID,
  name: 'Convocation AG',
  subject: 'Convocation — {association}',
  bodyMarkdown: 'Bonjour {nom}, le {date}.',
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  scope.current = undefined
  denied.actions = []
  vi.mocked(createDocumentTemplateDao).mockImplementation(async () => {
    expect(scope.current).toBe(ORG_ID)
    return templateRow()
  })
  vi.mocked(updateDocumentTemplateDao).mockImplementation(async () => {
    expect(scope.current).toBe(ORG_ID)
    return templateRow({name: 'Courrier'})
  })
})

describe('createDocumentTemplateService — rôles (ADR 074 §6)', () => {
  it.each([
    ['la Présidente', withRole('owner')],
    ['le bureau', withRole('board')],
    ['le SuperAdmin', userTestSuperAdmin],
  ])('%s enregistre un modèle sous le tenant', async (_label, user) => {
    setupAuthUserMocked(user)

    const result = await createDocumentTemplateService(fields())

    expect(result).toEqual({
      status: 'saved',
      template: {
        id: TEMPLATE_ID,
        name: 'Convocation AG',
        subject: 'Convocation — {association}',
        bodyMarkdown: 'Bonjour {nom}, le {date}.',
        updatedAt: UPDATED_AT,
      },
    })
    expect(createDocumentTemplateDao).toHaveBeenCalledWith(fields())
  })

  it.each([
    ['un membre', withRole('member')],
    ['le bureau d’une autre association', withRole('board', OTHER_ORG_ID)],
    ['un invité', undefined],
  ])('%s est refusé, rien n’est écrit', async (_label, user) => {
    setupAuthUserMocked(user)

    await expect(createDocumentTemplateService(fields())).rejects.toThrow(
      AuthorizationError
    )
    expect(createDocumentTemplateDao).not.toHaveBeenCalled()
  })

  it('refuse un identifiant d’association invalide avant tout contrôle', async () => {
    setupAuthUserMocked(withRole('owner'))

    await expect(
      createDocumentTemplateService(fields({organizationId: 'x'}))
    ).rejects.toThrow(ValidationParsedZodError)
  })
})

describe('createDocumentTemplateService — champs refusés avant toute écriture', () => {
  beforeEach(() => setupAuthUserMocked(withRole('board')))

  it('critère 4 — {adresse} et {date_ag} dans le texte : refusé, nommées, rien d’écrit', async () => {
    const result = await createDocumentTemplateService(
      fields({bodyMarkdown: 'À {adresse}, le {date_ag}.'})
    )

    expect(result).toEqual({
      status: 'rejected',
      issues: {
        bodyMarkdown: {
          code: 'unknownVariables',
          variables: ['adresse', 'date_ag'],
        },
      },
    })
    expect(createDocumentTemplateDao).not.toHaveBeenCalled()
  })

  it('critère 4 — {adresse} dans l’objet : refusé, nommée, rien d’écrit', async () => {
    const result = await createDocumentTemplateService(
      fields({subject: 'Pour {adresse}'})
    )

    expect(result).toEqual({
      status: 'rejected',
      issues: {subject: {code: 'unknownVariables', variables: ['adresse']}},
    })
    expect(createDocumentTemplateDao).not.toHaveBeenCalled()
  })

  it('nom, objet et texte vides : chacun refusé', async () => {
    const result = await createDocumentTemplateService(
      fields({name: '   ', subject: '', bodyMarkdown: ' '})
    )

    expect(result).toEqual({
      status: 'rejected',
      issues: {
        name: {code: 'missing'},
        subject: {code: 'missing'},
        bodyMarkdown: {code: 'missing'},
      },
    })
    expect(createDocumentTemplateDao).not.toHaveBeenCalled()
  })

  it('nom et objet trop longs : refusés avec leur plafond', async () => {
    const result = await createDocumentTemplateService(
      fields({
        name: 'n'.repeat(DOCUMENT_TEMPLATE_NAME_MAX_LENGTH + 1),
        subject: 's'.repeat(DOCUMENT_TEMPLATE_SUBJECT_MAX_LENGTH + 1),
      })
    )

    expect(result).toEqual({
      status: 'rejected',
      issues: {
        name: {code: 'tooLong', max: DOCUMENT_TEMPLATE_NAME_MAX_LENGTH},
        subject: {code: 'tooLong', max: DOCUMENT_TEMPLATE_SUBJECT_MAX_LENGTH},
      },
    })
  })

  it('enregistre les champs débarrassés de leurs espaces', async () => {
    await createDocumentTemplateService(fields({name: '  Convocation AG  '}))

    expect(createDocumentTemplateDao).toHaveBeenCalledWith(fields())
  })
})

describe('updateDocumentTemplateService', () => {
  beforeEach(() => setupAuthUserMocked(withRole('board')))

  it('met à jour un modèle du tenant', async () => {
    const result = await updateDocumentTemplateService({
      ...fields({name: 'Courrier'}),
      templateId: TEMPLATE_ID,
    })

    expect(result.status).toBe('saved')
    expect(updateDocumentTemplateDao).toHaveBeenCalledWith(TEMPLATE_ID, {
      name: 'Courrier',
      subject: 'Convocation — {association}',
      bodyMarkdown: 'Bonjour {nom}, le {date}.',
    })
  })

  it('variable inconnue : refusé sans écriture', async () => {
    const result = await updateDocumentTemplateService({
      ...fields({bodyMarkdown: '{adresse}'}),
      templateId: TEMPLATE_ID,
    })

    expect(result.status).toBe('rejected')
    expect(updateDocumentTemplateDao).not.toHaveBeenCalled()
  })

  it('modèle d’une autre association : introuvable', async () => {
    vi.mocked(updateDocumentTemplateDao).mockResolvedValue(undefined)

    await expect(
      updateDocumentTemplateService({...fields(), templateId: TEMPLATE_ID})
    ).rejects.toThrow(NotFoundError)
  })

  it('un membre est refusé, rien n’est écrit', async () => {
    setupAuthUserMocked(withRole('member'))

    await expect(
      updateDocumentTemplateService({...fields(), templateId: TEMPLATE_ID})
    ).rejects.toThrow(AuthorizationError)
    expect(updateDocumentTemplateDao).not.toHaveBeenCalled()
  })
})

describe('deleteDocumentTemplateService', () => {
  beforeEach(() => setupAuthUserMocked(withRole('owner')))

  it('supprime un modèle du tenant et rend son nom', async () => {
    vi.mocked(deleteDocumentTemplateDao).mockResolvedValue(templateRow())

    expect(
      await deleteDocumentTemplateService({
        organizationId: ORG_ID,
        templateId: TEMPLATE_ID,
      })
    ).toEqual({name: 'Convocation AG'})
  })

  it('modèle absent : NotFoundError', async () => {
    vi.mocked(deleteDocumentTemplateDao).mockResolvedValue(undefined)

    await expect(
      deleteDocumentTemplateService({
        organizationId: ORG_ID,
        templateId: TEMPLATE_ID,
      })
    ).rejects.toThrow(NotFoundError)
  })

  it('un membre est refusé, rien n’est supprimé', async () => {
    setupAuthUserMocked(withRole('member'))

    await expect(
      deleteDocumentTemplateService({
        organizationId: ORG_ID,
        templateId: TEMPLATE_ID,
      })
    ).rejects.toThrow(AuthorizationError)
    expect(deleteDocumentTemplateDao).not.toHaveBeenCalled()
  })
})

describe('lectures des modèles', () => {
  it('liste les modèles du tenant avec leurs variables employées', async () => {
    setupAuthUserMocked(withRole('board'))
    vi.mocked(listDocumentTemplatesDao).mockImplementation(async () => {
      expect(scope.current).toBe(ORG_ID)
      return [templateRow()]
    })

    expect(await listDocumentTemplatesService(ORG_ID)).toEqual([
      {
        id: TEMPLATE_ID,
        name: 'Convocation AG',
        variables: ['nom', 'date', 'association'],
        updatedAt: UPDATED_AT,
      },
    ])
  })

  it('un membre ne lit pas la liste', async () => {
    setupAuthUserMocked(withRole('member'))

    await expect(listDocumentTemplatesService(ORG_ID)).rejects.toThrow(
      AuthorizationError
    )
    expect(listDocumentTemplatesDao).not.toHaveBeenCalled()
  })

  it('critère 5 — un modèle d’une autre association est introuvable', async () => {
    setupAuthUserMocked(withRole('board'))
    vi.mocked(getDocumentTemplateByIdDao).mockResolvedValue(undefined)

    expect(
      await getDocumentTemplateService({
        organizationId: ORG_ID,
        templateId: TEMPLATE_ID,
      })
    ).toBeUndefined()
  })

  it('canManageDocumentTemplatesService suit le registre', async () => {
    setupAuthUserMocked(withRole('board'))
    expect(await canManageDocumentTemplatesService(ORG_ID)).toBe(true)
    setupAuthUserMocked(withRole('member'))
    expect(await canManageDocumentTemplatesService(ORG_ID)).toBe(false)
    setupAuthUserMocked(undefined)
    expect(await canManageDocumentTemplatesService(ORG_ID)).toBe(false)
    expect(await canManageDocumentTemplatesService('x')).toBe(false)
  })
})

const PROFILE_ID = 'a1200000-0000-4000-8000-000000000001'
const CATEGORY_ID = '44444444-4444-4444-8444-444444444444'
const DOCUMENT_ID = '55555555-5555-4555-8555-555555555555'
const PDF = Buffer.from('%PDF-1.7 document')

const translatorMock = (
  key: string,
  values?: Record<string, string | number>
) => (values ? `${key} ${JSON.stringify(values)}` : key)

const profileRow = (overrides: Record<string, unknown> = {}) => ({
  id: PROFILE_ID,
  organizationId: ORG_ID,
  name: 'Bernard Lefèvre',
  companyName: null,
  homeAddressLine: '4 rue des Lilas',
  homeAddressComplement: null,
  homePostalCode: '69003',
  homeCity: 'Lyon',
  landAddressLine: null,
  landAddressComplement: null,
  landPostalCode: null,
  landCity: null,
  ...overrides,
})

const renderInput = (overrides: Record<string, unknown> = {}) => ({
  organizationId: ORG_ID,
  templateId: TEMPLATE_ID,
  memberProfileId: PROFILE_ID,
  documentDate: '2026-11-25',
  ...overrides,
})

const depositInput = (overrides: Record<string, unknown> = {}) => ({
  ...renderInput(),
  categoryId: CATEGORY_ID,
  title: 'Convocation AG 2026',
  ...overrides,
})

const engineInput = () => vi.mocked(renderLettersPdf).mock.calls[0][0]

const setupGeneration = () => {
  vi.mocked(getTranslations).mockResolvedValue(translatorMock as never)
  vi.mocked(getDocumentTemplateByIdDao).mockImplementation(async () => {
    expect(scope.current).toBe(ORG_ID)
    return templateRow()
  })
  vi.mocked(getMemberProfileByIdDao).mockImplementation(async () => {
    expect(scope.current).toBe(ORG_ID)
    return profileRow() as never
  })
  vi.mocked(getCurrentParcelNumbersByProfileDao).mockImplementation(
    async () => {
      expect(scope.current).toBe(ORG_ID)
      return {[PROFILE_ID]: ['13', '12']}
    }
  )
  vi.mocked(readLetterAssociation).mockResolvedValue({
    name: 'Clos-Fleuri',
    domain: null,
    legalMentions: 'ASL Clos-Fleuri · SIRET 123',
    settings: {
      'letter.address_offset_x_mm': {value: 3, isDefault: false},
      'letter.address_offset_y_mm': {value: -2, isDefault: false},
    },
  } as never)
  vi.mocked(renderLettersPdf).mockResolvedValue({pdf: PDF, pageCount: 1})
}

describe('renderTemplateDocumentService — critère 2, rien n’est stocké', () => {
  beforeEach(() => {
    setupAuthUserMocked(withRole('board'))
    setupGeneration()
  })

  it('la fiche, ses parcelles « 12 et 13 », la date choisie et l’association arrivent au moteur', async () => {
    const result = await renderTemplateDocumentService(renderInput())

    expect(result).toEqual({
      status: 'ready',
      pdf: PDF,
      fileName: 'document-25-11-2026.pdf',
    })
    expect(engineInput()).toMatchObject({
      association: {
        name: 'Clos-Fleuri',
        legalMentions: 'ASL Clos-Fleuri · SIRET 123',
      },
      subject: 'Convocation — {association}',
      bodyMarkdown: 'Bonjour {nom}, le {date}.',
      sendDate: '2026-11-25',
      offset: {xMm: 3, yMm: -2},
      extraValues: {association: 'Clos-Fleuri'},
      letters: [
        {
          memberProfileIds: [PROFILE_ID],
          name: 'Bernard Lefèvre',
          parcelle: '12 et 13',
          address: {
            source: 'home',
            lines: ['Bernard Lefèvre', '4 rue des Lilas', '69003 Lyon'],
          },
        },
      ],
      texts: {
        subjectLabel: 'subjectLabel',
        dateLine: 'dateLine {"date":"25 novembre 2026"}',
        footer: 'footer',
      },
    })
    expect(getTranslations).toHaveBeenCalledWith({
      locale: 'fr',
      namespace: 'DocumentTemplatesBureau.pdf',
    })
    expect(depositMemberDocumentService).not.toHaveBeenCalled()
  })

  it('le repère des pages de suite est traduit', async () => {
    await renderTemplateDocumentService(renderInput())

    expect(
      engineInput().texts.continuation({name: 'X', page: 2, pageCount: 3})
    ).toBe('continuation {"name":"X","page":2,"pageCount":3}')
  })

  it('fiche sans parcelle actuelle : {parcelle} vide, pas d’échec', async () => {
    vi.mocked(getCurrentParcelNumbersByProfileDao).mockResolvedValue({})

    const result = await renderTemplateDocumentService(renderInput())

    expect(result.status).toBe('ready')
    expect(engineInput().letters[0].parcelle).toBe('')
  })

  it('critère 5 — modèle d’une autre association : not_found, aucun rendu', async () => {
    vi.mocked(getDocumentTemplateByIdDao).mockResolvedValue(undefined)

    expect(await renderTemplateDocumentService(renderInput())).toEqual({
      status: 'not_found',
    })
    expect(renderLettersPdf).not.toHaveBeenCalled()
  })

  it('fiche d’une autre association : not_found, aucun rendu', async () => {
    vi.mocked(getMemberProfileByIdDao).mockResolvedValue(undefined)

    expect(await renderTemplateDocumentService(renderInput())).toEqual({
      status: 'not_found',
    })
    expect(renderLettersPdf).not.toHaveBeenCalled()
  })

  it('date invalide : invalid_date, aucun rendu', async () => {
    for (const documentDate of ['', '2026-02-30', '25/11/2026']) {
      expect(
        await renderTemplateDocumentService(renderInput({documentDate}))
      ).toEqual({status: 'invalid_date'})
    }
    expect(renderLettersPdf).not.toHaveBeenCalled()
  })

  it('critère 4 — un modèle qui contient une variable inconnue n’est pas rendu', async () => {
    vi.mocked(getDocumentTemplateByIdDao).mockResolvedValue(
      templateRow({bodyMarkdown: 'À {adresse}'})
    )

    expect(await renderTemplateDocumentService(renderInput())).toEqual({
      status: 'unknown_variables',
      variables: ['adresse'],
    })
    expect(renderLettersPdf).not.toHaveBeenCalled()
  })

  it('erreur du moteur : render_failed, journalisée sans donnée nominative', async () => {
    vi.mocked(renderLettersPdf).mockRejectedValue(new Error('pdfkit'))

    expect(await renderTemplateDocumentService(renderInput())).toEqual({
      status: 'render_failed',
    })
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(
      'Bernard'
    )
  })

  it.each([
    ['un membre', withRole('member')],
    ['un invité', undefined],
  ])('%s est refusé, aucun rendu', async (_label, user) => {
    setupAuthUserMocked(user)

    await expect(renderTemplateDocumentService(renderInput())).rejects.toThrow(
      AuthorizationError
    )
    expect(renderLettersPdf).not.toHaveBeenCalled()
  })

  it('le SuperAdmin peut générer', async () => {
    setupAuthUserMocked(userTestSuperAdmin)

    expect((await renderTemplateDocumentService(renderInput())).status).toBe(
      'ready'
    )
  })

  it('identifiant non uuid : erreur de validation', async () => {
    await expect(
      renderTemplateDocumentService(renderInput({templateId: 'x'}))
    ).rejects.toThrow(ValidationParsedZodError)
  })
})

describe('depositTemplateDocumentService — dépôt par s32 (ADR 074 §4)', () => {
  beforeEach(() => {
    setupAuthUserMocked(withRole('board'))
    setupGeneration()
    vi.mocked(depositMemberDocumentService).mockResolvedValue({
      status: 'deposited',
      document: {id: DOCUMENT_ID} as never,
    })
  })

  it('rend le PDF et le dépose par s32, fichier PDF au nom sans donnée nominative', async () => {
    const result = await depositTemplateDocumentService(depositInput())

    expect(result).toEqual({
      status: 'deposited',
      document: {id: DOCUMENT_ID},
    })
    const [call] = vi.mocked(depositMemberDocumentService).mock.calls[0]
    expect(call).toMatchObject({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      title: 'Convocation AG 2026',
      categoryId: CATEGORY_ID,
      documentDate: '2026-11-25',
    })
    const file = call.file as File
    expect(file).toBeInstanceOf(File)
    expect(file.name).toBe('document-25-11-2026.pdf')
    expect(file.type).toBe('application/pdf')
    expect(Buffer.from(await file.arrayBuffer())).toEqual(PDF)
  })

  it('sans member.document.manage : AuthorizationError sans rendu', async () => {
    denied.actions = ['member.document.manage']

    await expect(
      depositTemplateDocumentService(depositInput())
    ).rejects.toThrow(AuthorizationError)
    expect(renderLettersPdf).not.toHaveBeenCalled()
    expect(depositMemberDocumentService).not.toHaveBeenCalled()
  })

  it('un membre est refusé sans rendu', async () => {
    setupAuthUserMocked(withRole('member'))

    await expect(
      depositTemplateDocumentService(depositInput())
    ).rejects.toThrow(AuthorizationError)
    expect(renderLettersPdf).not.toHaveBeenCalled()
  })

  it('dépôt refusé par s32 (catégorie inactive) : rendu tel quel', async () => {
    vi.mocked(depositMemberDocumentService).mockResolvedValue({
      status: 'rejected',
      issues: [MemberDocumentIssueConst.CATEGORY_UNAVAILABLE],
    })

    expect(await depositTemplateDocumentService(depositInput())).toEqual({
      status: 'rejected',
      issues: [MemberDocumentIssueConst.CATEGORY_UNAVAILABLE],
    })
  })

  it('rendu impossible : rien n’est déposé', async () => {
    vi.mocked(getDocumentTemplateByIdDao).mockResolvedValue(undefined)

    expect(await depositTemplateDocumentService(depositInput())).toEqual({
      status: 'not_found',
    })
    expect(depositMemberDocumentService).not.toHaveBeenCalled()
  })
})

const GROUP_ID = '66666666-6666-4666-8666-666666666666'
const ROY = 'a1200000-0000-4000-8000-000000000002'
const AUBERT = 'a1200000-0000-4000-8000-000000000003'

const targetRow = (
  memberProfileId: string,
  name: string,
  overrides: Record<string, unknown> = {}
) => ({
  ...profileRow(),
  memberProfileId,
  name,
  email: null,
  unsubscribed: false,
  currentParcelNumbers: ['12'],
  accountName: null,
  ...overrides,
})

describe('getDocumentLotReachService — cible d’un lot (critère 3)', () => {
  beforeEach(() => {
    setupAuthUserMocked(withRole('board'))
    vi.mocked(getCampaignTargetRowsDao).mockImplementation(async () => {
      expect(scope.current).toBe(ORG_ID)
      return [
        targetRow(ROY, 'Hélène Roy', {email: 'h1@x.fr'}),
        targetRow(PROFILE_ID, 'Bernard Lefèvre', {email: 'b@x.fr'}),
        targetRow(ROY, 'Hélène Roy', {email: 'h2@x.fr'}),
        targetRow(AUBERT, 'Anne Aubert', {currentParcelNumbers: []}),
      ] as never
    })
  })

  it('tous les membres : une fiche par identifiant, triées par nom, sans parcelle comptée', async () => {
    const reach = await getDocumentLotReachService({
      organizationId: ORG_ID,
      target: {kind: 'all_members'},
    })

    expect(reach).toEqual({
      profiles: [
        {id: AUBERT, name: 'Anne Aubert', hasCurrentParcel: false},
        {id: PROFILE_ID, name: 'Bernard Lefèvre', hasCurrentParcel: true},
        {id: ROY, name: 'Hélène Roy', hasCurrentParcel: true},
      ],
      total: 3,
      withoutCurrentParcel: 1,
    })
  })

  it('un groupe : ses seules fiches', async () => {
    vi.mocked(getRecipientGroupByIdDao).mockResolvedValue({
      id: GROUP_ID,
      name: 'Riverains',
      profileCount: 2,
    })
    vi.mocked(getRecipientGroupMemberIdsDao).mockResolvedValue([ROY, AUBERT])

    const reach = await getDocumentLotReachService({
      organizationId: ORG_ID,
      target: {kind: 'group', groupId: GROUP_ID},
    })

    expect(reach.profiles.map((profile) => profile.id)).toEqual([AUBERT, ROY])
    expect(getRecipientGroupMemberIdsDao).toHaveBeenCalledWith(GROUP_ID)
  })

  it('groupe d’une autre association : NotFoundError, jamais « tous »', async () => {
    vi.mocked(getRecipientGroupByIdDao).mockResolvedValue(undefined)

    await expect(
      getDocumentLotReachService({
        organizationId: ORG_ID,
        target: {kind: 'group', groupId: GROUP_ID},
      })
    ).rejects.toThrow(NotFoundError)
  })

  it('les impayés : les fiches dont une facture est impayée', async () => {
    vi.mocked(getAssociationSettingsService).mockResolvedValue({
      'billing.unpaid_statuses': {value: 'late', isDefault: false},
    } as never)
    const listInvoicesOf = vi.fn().mockResolvedValue([
      {memberProfileId: ROY, status: 'late'},
      {memberProfileId: PROFILE_ID, status: 'paid'},
    ])
    vi.mocked(resolveMemberBillingProvider).mockReturnValue({
      listInvoicesOf,
    } as never)

    const reach = await getDocumentLotReachService({
      organizationId: ORG_ID,
      target: {kind: 'unpaid_members'},
    })

    expect(reach.profiles.map((profile) => profile.id)).toEqual([ROY])
    expect(listInvoicesOf).toHaveBeenCalledWith(ORG_ID, [
      ROY,
      PROFILE_ID,
      AUBERT,
    ])
  })

  it('fournisseur de factures en échec : erreur typée, ni « tous » ni « vide »', async () => {
    vi.mocked(getAssociationSettingsService).mockResolvedValue({} as never)
    vi.mocked(resolveMemberBillingProvider).mockReturnValue({
      listInvoicesOf: vi.fn().mockRejectedValue(new Error('pennylane')),
    } as never)

    await expect(
      getDocumentLotReachService({
        organizationId: ORG_ID,
        target: {kind: 'unpaid_members'},
      })
    ).rejects.toThrow(CampaignTargetUnavailableError)
  })

  it('sans member.document.manage : refusé, rien n’est lu', async () => {
    denied.actions = ['member.document.manage']

    await expect(
      getDocumentLotReachService({
        organizationId: ORG_ID,
        target: {kind: 'all_members'},
      })
    ).rejects.toThrow(AuthorizationError)
    expect(getCampaignTargetRowsDao).not.toHaveBeenCalled()
  })

  it('un membre est refusé', async () => {
    setupAuthUserMocked(withRole('member'))

    await expect(
      getDocumentLotReachService({
        organizationId: ORG_ID,
        target: {kind: 'all_members'},
      })
    ).rejects.toThrow(AuthorizationError)
  })
})

describe('listDocumentLotGroupsService — les groupes, sous l’action des modèles', () => {
  it('liste les groupes du tenant', async () => {
    setupAuthUserMocked(withRole('board'))
    vi.mocked(listRecipientGroupsDao).mockImplementation(async () => {
      expect(scope.current).toBe(ORG_ID)
      return [{id: GROUP_ID, name: 'Riverains', profileCount: 2}]
    })

    expect(await listDocumentLotGroupsService(ORG_ID)).toEqual([
      {id: GROUP_ID, name: 'Riverains', profileCount: 2},
    ])
  })

  it('un membre est refusé', async () => {
    setupAuthUserMocked(withRole('member'))

    await expect(listDocumentLotGroupsService(ORG_ID)).rejects.toThrow(
      AuthorizationError
    )
  })
})

describe('getTemplateDocumentRecipientService — l’adresse que la lettre imprimera (ADR 067)', () => {
  beforeEach(() => setupAuthUserMocked(withRole('board')))

  it('domicile d’abord, lu sous le tenant', async () => {
    vi.mocked(getMemberProfileByIdDao).mockImplementation(async () => {
      expect(scope.current).toBe(ORG_ID)
      return profileRow() as never
    })

    expect(
      await getTemplateDocumentRecipientService({
        organizationId: ORG_ID,
        memberProfileId: PROFILE_ID,
      })
    ).toEqual({
      addressLines: ['Bernard Lefèvre', '4 rue des Lilas', '69003 Lyon'],
    })
  })

  it('fiche d’une autre association : undefined', async () => {
    vi.mocked(getMemberProfileByIdDao).mockResolvedValue(undefined)

    expect(
      await getTemplateDocumentRecipientService({
        organizationId: ORG_ID,
        memberProfileId: PROFILE_ID,
      })
    ).toBeUndefined()
  })

  it('un membre est refusé', async () => {
    setupAuthUserMocked(withRole('member'))

    await expect(
      getTemplateDocumentRecipientService({
        organizationId: ORG_ID,
        memberProfileId: PROFILE_ID,
      })
    ).rejects.toThrow(AuthorizationError)
  })
})
