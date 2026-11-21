import {beforeEach, describe, expect, it, vi} from 'vitest'

const scope = vi.hoisted(() => ({current: undefined as string | undefined}))

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

vi.mock('@/db/repositories/campaign-repository', () => ({
  getCampaignByIdDao: vi.fn(),
  getCampaignLetterProfileIdsDao: vi.fn(),
  getCampaignTargetRowsDao: vi.fn(),
}))
vi.mock('@/db/repositories/organization-repository', () => ({
  getOrganizationByIdDao: vi.fn(),
}))
vi.mock('../association-settings-service', () => ({
  getAssociationSettingsService: vi.fn(),
}))
vi.mock('@/lib/letters/render-letters-pdf', () => ({
  renderLettersPdf: vi.fn(async () => ({
    pdf: Buffer.from('%PDF-lettres'),
    pageCount: 5,
  })),
}))
vi.mock('@/lib/letters/letter-address-measure.server', () => ({
  letterAddressFitsWindow: vi.fn(() => true),
}))
vi.mock('@/lib/letters/render-calibration-pdf', () => ({
  renderCalibrationPdf: vi.fn(async () => Buffer.from('%PDF-calage')),
}))

import {getTranslations} from 'next-intl/server'

import {
  getCampaignByIdDao,
  getCampaignLetterProfileIdsDao,
  getCampaignTargetRowsDao,
} from '@/db/repositories/campaign-repository'
import {getOrganizationByIdDao} from '@/db/repositories/organization-repository'
import {withTenant} from '@/db/tenant-scope'
import {letterAddressFitsWindow} from '@/lib/letters/letter-address-measure.server'
import {renderCalibrationPdf} from '@/lib/letters/render-calibration-pdf'
import {renderLettersPdf} from '@/lib/letters/render-letters-pdf'
import {logger} from '@/lib/logger'

import {getAssociationSettingsService} from '../association-settings-service'
import {
  generateCampaignLettersService,
  getCampaignLetterContextService,
  getLetterCalibrationPdfService,
} from '../campaign-letter-service'
import {AuthorizationError} from '../errors/authorization-error'
import {ValidationParsedZodError} from '../errors/validation-error'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const CAMPAIGN_ID = '33333333-3333-4333-8333-333333333333'
const P12 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const P27 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ROY = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const NOBODY = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const WITH_EMAIL = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

const withRole = (role: OrganizationRole, organizationId = ORG_ID): User => ({
  ...userTest,
  name: 'Marie Delorme',
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
const board = withRole(UserOrganizationRoleConst.ADMIN)
const plainMember = withRole(UserOrganizationRoleConst.MEMBER)
const otherBoard = withRole(UserOrganizationRoleConst.ADMIN, OTHER_ORG_ID)

const NO_ADDRESS = {
  homeAddressLine: null,
  homeAddressComplement: null,
  homePostalCode: null,
  homeCity: null,
  landAddressLine: null,
  landAddressComplement: null,
  landPostalCode: null,
  landCity: null,
  companyName: null,
}

const row = (
  memberProfileId: string,
  name: string,
  overrides: Record<string, unknown> = {}
) => ({
  memberProfileId,
  name,
  email: null,
  unsubscribed: false,
  currentParcelNumbers: [] as string[],
  accountName: null,
  ...NO_ADDRESS,
  ...overrides,
})

const HOME = {
  homeAddressLine: '4 rue des Lilas',
  homePostalCode: '69003',
  homeCity: 'Lyon',
}

const targetRows = () => [
  row(P12, 'Marcel Laurent', {...HOME, currentParcelNumbers: ['14']}),
  row(P27, 'Marcel Laurent', {...HOME, currentParcelNumbers: ['27']}),
  row(ROY, 'Hélène Roy', {
    landAddressLine: '12 chemin de la Fourche',
    landPostalCode: '07140',
    landCity: 'Les Vans',
    currentParcelNumbers: ['3'],
  }),
  row(NOBODY, 'Sans Adresse', {currentParcelNumbers: ['8']}),
  row(WITH_EMAIL, 'Avec Email', {email: 'a@x.fr', ...HOME}),
]

const campaignRow = (overrides: Record<string, unknown> = {}) => ({
  id: CAMPAIGN_ID,
  organizationId: ORG_ID,
  submissionId: 'sub',
  subject: 'Travaux de la parcelle {parcelle}',
  preheader: null,
  bodyMarkdown: 'Bonjour {nom}',
  templateId: 'free',
  nature: 'facultative' as const,
  targetKind: 'all_members',
  targetGroupId: null,
  targetGroupName: null,
  recipientCount: 1,
  withoutEmailCount: 4,
  unsubscribedCount: 0,
  sentCount: 0,
  status: 'sending' as const,
  sendDate: '2026-11-12',
  authorUserId: userTest.id,
  authorName: 'Marie Delorme',
  onBehalfOfUserId: null,
  onBehalfOfName: null,
  createdAt: new Date('2026-11-12T13:32:00Z'),
  updatedAt: new Date('2026-11-12T13:32:00Z'),
  finishedAt: null,
  ...overrides,
})

const readDaos = () => [
  getCampaignByIdDao,
  getCampaignLetterProfileIdsDao,
  getCampaignTargetRowsDao,
]

const translatorMock = (
  key: string,
  values?: Record<string, string | number>
) => (values ? `${key} ${JSON.stringify(values)}` : key)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(letterAddressFitsWindow).mockImplementation(() => true)
  vi.mocked(getTranslations).mockResolvedValue(translatorMock as never)
  vi.mocked(getOrganizationByIdDao).mockResolvedValue({
    id: ORG_ID,
    name: 'ASL Les Pins',
    domain: 'asl-les-pins.test',
  } as never)
  vi.mocked(getAssociationSettingsService).mockResolvedValue({
    'association.legal_mentions': {value: 'SIRET 123', isDefault: false},
    'letter.address_offset_x_mm': {value: 3, isDefault: false},
    'letter.address_offset_y_mm': {value: -2, isDefault: false},
  } as never)
  vi.mocked(getCampaignByIdDao).mockResolvedValue(campaignRow() as never)
  vi.mocked(getCampaignLetterProfileIdsDao).mockResolvedValue([
    P12,
    P27,
    ROY,
    NOBODY,
  ])
  vi.mocked(getCampaignTargetRowsDao).mockResolvedValue(targetRows())
})

const contextInput = [ORG_ID, CAMPAIGN_ID] as const

describe('[PUBLIC] courrier postal', () => {
  beforeEach(async () => {
    await setupAuthUserMocked(undefined)
  })

  it('refuse le contexte, le PDF et la page de calage sans rien lire', async () => {
    await expect(
      getCampaignLetterContextService(...contextInput)
    ).rejects.toBeInstanceOf(AuthorizationError)
    await expect(
      generateCampaignLettersService(...contextInput, 'per_person')
    ).rejects.toBeInstanceOf(AuthorizationError)
    await expect(getLetterCalibrationPdfService(ORG_ID)).rejects.toBeInstanceOf(
      AuthorizationError
    )
    for (const dao of readDaos()) expect(dao).not.toHaveBeenCalled()
    expect(withTenant).not.toHaveBeenCalled()
  })
})

describe('[MEMBRE] courrier postal', () => {
  beforeEach(async () => {
    await setupAuthUserMocked(plainMember)
  })

  it('un membre sans le droit campaign.manage est refusé', async () => {
    await expect(
      getCampaignLetterContextService(...contextInput)
    ).rejects.toBeInstanceOf(AuthorizationError)
    await expect(
      generateCampaignLettersService(...contextInput, 'per_land')
    ).rejects.toBeInstanceOf(AuthorizationError)
    await expect(getLetterCalibrationPdfService(ORG_ID)).rejects.toBeInstanceOf(
      AuthorizationError
    )
    expect(renderLettersPdf).not.toHaveBeenCalled()
  })

  it('le bureau d’une autre association est refusé', async () => {
    await setupAuthUserMocked(otherBoard)

    await expect(
      generateCampaignLettersService(...contextInput, 'per_land')
    ).rejects.toBeInstanceOf(AuthorizationError)
    for (const dao of readDaos()) expect(dao).not.toHaveBeenCalled()
  })
})

describe('[BUREAU] getCampaignLetterContextService', () => {
  beforeEach(async () => {
    await setupAuthUserMocked(board)
  })

  it('valide les identifiants avant tout', async () => {
    await expect(
      getCampaignLetterContextService(ORG_ID, 'x')
    ).rejects.toBeInstanceOf(ValidationParsedZodError)
    expect(withTenant).not.toHaveBeenCalled()
  })

  it('décomptes, homonymes, lettres au terrain et au nom seul, sous le tenant', async () => {
    const result = await getCampaignLetterContextService(...contextInput)

    expect(withTenant).toHaveBeenCalledWith(ORG_ID, expect.any(Function))
    expect(getCampaignLetterProfileIdsDao).toHaveBeenCalledWith(
      ORG_ID,
      CAMPAIGN_ID
    )
    expect(result).toEqual({
      status: 'ready',
      context: {
        sendDate: '2026-11-12',
        withoutEmailCount: 4,
        withoutHomeCount: 2,
        homonymGroups: [
          {
            name: 'Marcel Laurent',
            homeAddress: '4 rue des Lilas, 69003 Lyon',
            profileCount: 2,
            parcelNumbers: ['14', '27'],
          },
        ],
        landAddressed: [{id: ROY, name: 'Hélène Roy', parcelNumbers: ['3']}],
        nameOnly: [{id: NOBODY, name: 'Sans Adresse', parcelNumbers: ['8']}],
        addressTooWide: [],
      },
    })
  })

  it('une adresse qui ne tient pas dans le cadre est signalée, avec la fiche (M1)', async () => {
    vi.mocked(letterAddressFitsWindow).mockImplementation(
      (lines) => !lines.includes('12 chemin de la Fourche')
    )

    const result = await getCampaignLetterContextService(...contextInput)

    expect(letterAddressFitsWindow).toHaveBeenCalledWith([
      'Hélène Roy',
      '12 chemin de la Fourche',
      '07140 Les Vans',
    ])
    expect(result).toMatchObject({
      status: 'ready',
      context: {
        addressTooWide: [{id: ROY, name: 'Hélène Roy', parcelNumbers: ['3']}],
      },
    })
  })

  it('une campagne d’une autre association est introuvable, sans lecture des fiches', async () => {
    vi.mocked(getCampaignByIdDao).mockResolvedValue(undefined)

    await expect(
      getCampaignLetterContextService(...contextInput)
    ).resolves.toEqual({status: 'not_found'})
    expect(getCampaignLetterProfileIdsDao).not.toHaveBeenCalled()
    expect(getCampaignTargetRowsDao).not.toHaveBeenCalled()
  })

  it('une campagne antérieure au courrier (sans-email comptés, rien de figé) : legacy (ADR 065 §4)', async () => {
    vi.mocked(getCampaignLetterProfileIdsDao).mockResolvedValue([])

    await expect(
      getCampaignLetterContextService(...contextInput)
    ).resolves.toEqual({status: 'legacy'})
    expect(getCampaignTargetRowsDao).not.toHaveBeenCalled()
  })

  it('aucune fiche sans email dans la cible : none (critère 5)', async () => {
    vi.mocked(getCampaignByIdDao).mockResolvedValue(
      campaignRow({withoutEmailCount: 0}) as never
    )
    vi.mocked(getCampaignLetterProfileIdsDao).mockResolvedValue([])

    await expect(
      getCampaignLetterContextService(...contextInput)
    ).resolves.toEqual({status: 'none'})
  })
})

describe('[BUREAU] generateCampaignLettersService', () => {
  beforeEach(async () => {
    await setupAuthUserMocked(board)
  })

  const lettersInput = () => vi.mocked(renderLettersPdf).mock.calls[0][0]

  it('des homonymes sans choix : grouping_required, aucun PDF (critère 2)', async () => {
    await expect(
      generateCampaignLettersService(...contextInput, null)
    ).resolves.toEqual({status: 'grouping_required'})
    expect(renderLettersPdf).not.toHaveBeenCalled()
  })

  it('refuse un regroupement inconnu', async () => {
    await expect(
      generateCampaignLettersService(...contextInput, 'tous' as never)
    ).rejects.toBeInstanceOf(ValidationParsedZodError)
  })

  it('une seule lettre par personne : le groupe regroupé, toutes ses parcelles', async () => {
    const result = await generateCampaignLettersService(
      ...contextInput,
      'per_person'
    )

    expect(result).toMatchObject({
      status: 'ready',
      sendDate: '2026-11-12',
      letterCount: 3,
      pageCount: 5,
    })
    expect(
      result.status === 'ready' && Buffer.from(result.pdf).toString()
    ).toBe('%PDF-lettres')
    expect(lettersInput().letters.map((l) => l.memberProfileIds)).toEqual([
      [ROY],
      [P12, P27],
      [NOBODY],
    ])
    expect(lettersInput().letters[1].parcelle).toBe('14 et 27')
  })

  it('une lettre par terrain : une par fiche figée, jamais une fiche avec email', async () => {
    const result = await generateCampaignLettersService(
      ...contextInput,
      'per_land'
    )

    expect(result).toMatchObject({status: 'ready', letterCount: 4})
    const ids = lettersInput().letters.flatMap((l) => l.memberProfileIds)
    expect(ids.sort()).toEqual([NOBODY, P12, P27, ROY].sort())
    expect(ids).not.toContain(WITH_EMAIL)
  })

  it('le contenu figé de la campagne, sa date d’envoi, le décalage et les textes traduits', async () => {
    await generateCampaignLettersService(...contextInput, 'per_land')

    expect(lettersInput()).toMatchObject({
      association: {name: 'ASL Les Pins', legalMentions: 'SIRET 123'},
      subject: 'Travaux de la parcelle {parcelle}',
      bodyMarkdown: 'Bonjour {nom}',
      sendDate: '2026-11-12',
      offset: {xMm: 3, yMm: -2},
      texts: {
        subjectLabel: 'subjectLabel',
        dateLine: 'dateLine {"date":"12 novembre 2026"}',
        footer: 'footer',
      },
    })
    expect(getTranslations).toHaveBeenCalledWith({
      locale: 'fr',
      namespace: 'CampaignsBureau.letters.pdf',
    })
  })

  it('le repère des pages de suite est traduit, au nom du destinataire (§6.1)', async () => {
    await generateCampaignLettersService(...contextInput, 'per_land')

    expect(
      lettersInput().texts.continuation({
        name: 'Hélène Roy',
        page: 2,
        pageCount: 3,
      })
    ).toBe('continuation {"name":"Hélène Roy","page":2,"pageCount":3}')
  })

  it('sans homonymes, aucun choix n’est exigé', async () => {
    vi.mocked(getCampaignLetterProfileIdsDao).mockResolvedValue([P12, ROY])

    await expect(
      generateCampaignLettersService(...contextInput, null)
    ).resolves.toMatchObject({status: 'ready', letterCount: 2})
  })

  it('not_found, legacy et none ne produisent aucun PDF', async () => {
    vi.mocked(getCampaignByIdDao).mockResolvedValueOnce(undefined)
    await expect(
      generateCampaignLettersService(...contextInput, 'per_land')
    ).resolves.toEqual({status: 'not_found'})

    vi.mocked(getCampaignLetterProfileIdsDao).mockResolvedValueOnce([])
    await expect(
      generateCampaignLettersService(...contextInput, 'per_land')
    ).resolves.toEqual({status: 'legacy'})

    vi.mocked(getCampaignByIdDao).mockResolvedValueOnce(
      campaignRow({withoutEmailCount: 0}) as never
    )
    vi.mocked(getCampaignLetterProfileIdsDao).mockResolvedValueOnce([])
    await expect(
      generateCampaignLettersService(...contextInput, 'per_land')
    ).resolves.toEqual({status: 'none'})

    expect(renderLettersPdf).not.toHaveBeenCalled()
  })

  it('ne journalise ni nom, ni adresse, ni contenu', async () => {
    await generateCampaignLettersService(...contextInput, 'per_person')

    const logged = JSON.stringify(
      Object.values(logger).flatMap((fn) =>
        vi.isMockFunction(fn) ? fn.mock.calls : []
      )
    )
    expect(logged).not.toContain('Marcel')
    expect(logged).not.toContain('Lilas')
    expect(logged).not.toContain('Bonjour')
  })
})

describe('[BUREAU] getLetterCalibrationPdfService', () => {
  beforeEach(async () => {
    await setupAuthUserMocked(board)
  })

  it('la page de calage, au décalage de l’association, décalage écrit en clair', async () => {
    const pdf = await getLetterCalibrationPdfService(ORG_ID)

    expect(Buffer.from(pdf).toString()).toBe('%PDF-calage')
    expect(vi.mocked(renderCalibrationPdf).mock.calls[0][0]).toEqual({
      offset: {xMm: 3, yMm: -2},
      texts: {
        sampleLines: ['sampleName', 'sampleAddress', 'sampleLocality'],
        instruction: 'calibrationInstruction {"x":3,"y":-2}',
      },
    })
  })
})

describe('[SUPER_ADMIN] courrier postal', () => {
  beforeEach(async () => {
    await setupAuthUserMocked(userTestSuperAdmin)
  })

  it('le SuperAdmin peut produire le courrier de l’association', async () => {
    await expect(
      generateCampaignLettersService(...contextInput, 'per_land')
    ).resolves.toMatchObject({status: 'ready'})
    await expect(getLetterCalibrationPdfService(ORG_ID)).resolves.toBeTruthy()
  })
})
