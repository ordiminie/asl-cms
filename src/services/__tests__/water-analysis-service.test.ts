import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const scope = vi.hoisted(() => ({current: undefined as string | undefined}))
const storage = vi.hoisted(() => ({
  upload: vi.fn(),
  download: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
}))

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
vi.mock('@/db/repositories/water-analysis-repository', () => ({
  countWaterAnalysesDao: vi.fn(),
  createWaterAnalysisDao: vi.fn(),
  deleteWaterAnalysisDao: vi.fn(),
  getPublishedWaterAnalysisPageDao: vi.fn(),
  getWaterAnalysisByIdDao: vi.fn(),
  getWaterAnalysisPageByOrganizationDao: vi.fn(),
  updateWaterAnalysisDao: vi.fn(),
}))
vi.mock('@/lib/files/storage/storage-factory', () => ({
  createStorage: vi.fn(() => storage),
}))

import {
  countWaterAnalysesDao,
  createWaterAnalysisDao,
  deleteWaterAnalysisDao,
  getPublishedWaterAnalysisPageDao,
  getWaterAnalysisByIdDao,
  getWaterAnalysisPageByOrganizationDao,
  updateWaterAnalysisDao,
} from '@/db/repositories/water-analysis-repository'
import {withTenant} from '@/db/tenant-scope'

import {AuthorizationError} from '../errors/authorization-error'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {WaterAnalysisDTO} from '../types/domain/water-analysis-types'
import {
  canManageWaterAnalysisService,
  deleteWaterAnalysisService,
  getPublicWaterAnalysesPageService,
  getPublicWaterAnalysisPageCountService,
  getWaterAnalysesForBureauService,
  getWaterAnalysisForBureauService,
  publishWaterAnalysisService,
  updateWaterAnalysisService,
} from '../water-analysis-service'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const ANALYSIS_ID = '33333333-3333-4333-8333-333333333333'
const TODAY = '2026-09-02'

const OLD_POSTER_KEY = `${ORG_ID}/water-analysis/${ANALYSIS_ID}/poster-old.png`
const OLD_REPORT_KEY = `${ORG_ID}/water-analysis/${ANALYSIS_ID}/report-old.pdf`

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
])
const PDF_BYTES = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25,
])

const posterFile = (bytes: Uint8Array = PNG_BYTES) =>
  new File([bytes as BlobPart], 'affiche.png', {type: 'image/png'})
const reportFile = (bytes: Uint8Array = PDF_BYTES) =>
  new File([bytes as BlobPart], 'resultat.pdf', {type: 'application/pdf'})

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

const analysisRow = (overrides: Partial<WaterAnalysisDTO> = {}) => ({
  id: ANALYSIS_ID,
  organizationId: ORG_ID,
  sampledOn: '2026-09-02',
  posterKey: OLD_POSTER_KEY,
  reportKey: OLD_REPORT_KEY,
  reportBytes: 327_680,
  content: '',
  createdAt: new Date('2026-09-02'),
  updatedAt: new Date('2026-09-02'),
  ...overrides,
})

const publishInput = (overrides: Record<string, unknown> = {}) => ({
  organizationId: ORG_ID,
  sampledOn: '2026-09-01',
  content: 'Eau conforme.',
  poster: posterFile(),
  report: reportFile(),
  today: TODAY,
  ...overrides,
})

const updateInput = (overrides: Record<string, unknown> = {}) => ({
  organizationId: ORG_ID,
  analysisId: ANALYSIS_ID,
  sampledOn: '2026-08-30',
  content: '',
  today: TODAY,
  ...overrides,
})

const uploadedKeys = (): string[] =>
  storage.upload.mock.calls.map((call) => call[1] as string)

const resetMocks = () => {
  vi.clearAllMocks()
  storage.upload.mockResolvedValue({path: 'ok'})
  storage.delete.mockResolvedValue(undefined)
  vi.mocked(createWaterAnalysisDao).mockImplementation(async (input) =>
    analysisRow(input)
  )
  vi.mocked(getWaterAnalysisByIdDao).mockResolvedValue(analysisRow())
  vi.mocked(updateWaterAnalysisDao).mockImplementation(async (id, input) =>
    analysisRow({id, ...input})
  )
  vi.mocked(deleteWaterAnalysisDao).mockResolvedValue({
    posterKey: OLD_POSTER_KEY,
    reportKey: OLD_REPORT_KEY,
  })
  vi.mocked(getWaterAnalysisPageByOrganizationDao).mockResolvedValue({
    rows: [analysisRow()],
    total: 1,
  })
  vi.mocked(getPublishedWaterAnalysisPageDao).mockResolvedValue({
    rows: [analysisRow()],
    total: 1,
  })
  vi.mocked(countWaterAnalysesDao).mockResolvedValue(0)
}

const expectNothingWritten = () => {
  expect(storage.upload).not.toHaveBeenCalled()
  expect(createWaterAnalysisDao).not.toHaveBeenCalled()
  expect(updateWaterAnalysisDao).not.toHaveBeenCalled()
  expect(deleteWaterAnalysisDao).not.toHaveBeenCalled()
  expect(storage.delete).not.toHaveBeenCalled()
}

describe.each([
  ['[ORGANIZATION OWNER]', 'owner'],
  ['[ORGANIZATION ADMIN]', 'board'],
] as const)('%s CRUD : WaterAnalysisService', (_label, role) => {
  beforeEach(() => {
    setupAuthUserMocked(withRole(role))
    resetMocks()
  })

  it('publie en une seule opération : deux fichiers, puis la ligne', async () => {
    const result = await publishWaterAnalysisService(publishInput())

    expect(result.status).toBe('published')
    expect(storage.upload).toHaveBeenCalledTimes(2)

    const [posterKey, reportKey] = uploadedKeys()
    const insert = vi.mocked(createWaterAnalysisDao).mock.calls[0][0]

    expect(posterKey).toMatch(
      new RegExp(`^${ORG_ID}/water-analysis/${insert.id}/poster-.+\\.png$`)
    )
    expect(reportKey).toMatch(
      new RegExp(`^${ORG_ID}/water-analysis/${insert.id}/report-.+\\.pdf$`)
    )
    expect(insert).toEqual({
      id: insert.id,
      organizationId: ORG_ID,
      sampledOn: '2026-09-01',
      posterKey,
      reportKey,
      reportBytes: PDF_BYTES.length,
      content: 'Eau conforme.',
    })

    const insertOrder = vi.mocked(createWaterAnalysisDao).mock
      .invocationCallOrder[0]
    for (const order of storage.upload.mock.invocationCallOrder) {
      expect(order).toBeLessThan(insertOrder)
    }
  })

  it("l'insertion s'exécute sous le tenant de l'association", async () => {
    vi.mocked(createWaterAnalysisDao).mockImplementation(async (input) => {
      expect(scope.current).toBe(ORG_ID)
      return analysisRow(input)
    })

    await publishWaterAnalysisService(publishInput())

    expect(createWaterAnalysisDao).toHaveBeenCalledTimes(1)
  })

  it('corrige la date et le texte en gardant les fichiers en place', async () => {
    const result = await updateWaterAnalysisService(
      updateInput({content: 'Nouveau texte.'})
    )

    expect(result.status).toBe('saved')
    expect(storage.upload).not.toHaveBeenCalled()
    expect(updateWaterAnalysisDao).toHaveBeenCalledWith(ANALYSIS_ID, {
      sampledOn: '2026-08-30',
      posterKey: OLD_POSTER_KEY,
      reportKey: OLD_REPORT_KEY,
      reportBytes: 327_680,
      content: 'Nouveau texte.',
    })
    expect(storage.delete).not.toHaveBeenCalled()
  })

  it('remplace le PDF : nouveau fichier écrit, ligne mise à jour, puis ancien fichier supprimé', async () => {
    const result = await updateWaterAnalysisService(
      updateInput({report: reportFile()})
    )

    expect(result.status).toBe('saved')
    const [newReportKey] = uploadedKeys()
    expect(newReportKey).toMatch(
      new RegExp(`^${ORG_ID}/water-analysis/${ANALYSIS_ID}/report-.+\\.pdf$`)
    )
    expect(updateWaterAnalysisDao).toHaveBeenCalledWith(
      ANALYSIS_ID,
      expect.objectContaining({
        posterKey: OLD_POSTER_KEY,
        reportKey: newReportKey,
        reportBytes: PDF_BYTES.length,
      })
    )
    expect(storage.delete).toHaveBeenCalledTimes(1)
    expect(storage.delete).toHaveBeenCalledWith(OLD_REPORT_KEY)
    expect(storage.delete.mock.invocationCallOrder[0]).toBeGreaterThan(
      vi.mocked(updateWaterAnalysisDao).mock.invocationCallOrder[0]
    )
  })

  it("un échec de suppression de l'ancien fichier ne fait pas échouer l'enregistrement", async () => {
    storage.delete.mockRejectedValue(new Error('disque indisponible'))

    const result = await updateWaterAnalysisService(
      updateInput({poster: posterFile()})
    )

    expect(result.status).toBe('saved')
    expect(storage.delete).toHaveBeenCalledWith(OLD_POSTER_KEY)
  })

  it('supprime la ligne d’abord, les deux fichiers ensuite', async () => {
    const result = await deleteWaterAnalysisService({
      organizationId: ORG_ID,
      analysisId: ANALYSIS_ID,
    })

    expect(result).toEqual({status: 'deleted'})
    expect(deleteWaterAnalysisDao).toHaveBeenCalledWith(ANALYSIS_ID)
    expect(storage.delete).toHaveBeenCalledWith(OLD_POSTER_KEY)
    expect(storage.delete).toHaveBeenCalledWith(OLD_REPORT_KEY)
    const rowDeleted = vi.mocked(deleteWaterAnalysisDao).mock
      .invocationCallOrder[0]
    for (const order of storage.delete.mock.invocationCallOrder) {
      expect(order).toBeGreaterThan(rowDeleted)
    }
  })

  it('lit la liste du bureau sous le tenant de l’association', async () => {
    const list = await getWaterAnalysesForBureauService(ORG_ID, 1)

    expect(withTenant).toHaveBeenCalledWith(ORG_ID, expect.any(Function))
    expect(getWaterAnalysisPageByOrganizationDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      limit: 25,
      offset: 0,
    })
    expect(list.items).toHaveLength(1)
    expect(list.totalPages).toBe(1)
  })

  it('lit une analyse pour l’écran de correction', async () => {
    const analysis = await getWaterAnalysisForBureauService(ORG_ID, ANALYSIS_ID)

    expect(analysis.id).toBe(ANALYSIS_ID)
    expect(withTenant).toHaveBeenCalledWith(ORG_ID, expect.any(Function))
  })

  it('peut gérer les analyses de son association', async () => {
    expect(await canManageWaterAnalysisService(ORG_ID)).toBe(true)
  })
})

const unauthorizedUsers: [string, () => User | undefined][] = [
  ['[ORGANIZATION MEMBER]', () => withRole('member')],
  ['[USER NOT IN ORGANIZATION]', () => withRole('owner', OTHER_ORG_ID)],
  ['[PUBLIC]', () => undefined],
]

describe.each(unauthorizedUsers)(
  '%s : WaterAnalysisService',
  (_label, user) => {
    beforeEach(() => {
      setupAuthUserMocked(user())
      resetMocks()
    })

    it('ne publie pas, et n’écrit rien', async () => {
      await expect(publishWaterAnalysisService(publishInput())).rejects.toThrow(
        AuthorizationError
      )
      expectNothingWritten()
    })

    it('ne corrige pas, et n’écrit rien', async () => {
      await expect(
        updateWaterAnalysisService(updateInput({report: reportFile()}))
      ).rejects.toThrow(AuthorizationError)
      expectNothingWritten()
      expect(getWaterAnalysisByIdDao).not.toHaveBeenCalled()
    })

    it('ne supprime pas, et n’efface rien', async () => {
      await expect(
        deleteWaterAnalysisService({
          organizationId: ORG_ID,
          analysisId: ANALYSIS_ID,
        })
      ).rejects.toThrow(AuthorizationError)
      expectNothingWritten()
    })

    it('ne lit pas la liste du bureau', async () => {
      await expect(getWaterAnalysesForBureauService(ORG_ID, 1)).rejects.toThrow(
        AuthorizationError
      )
      expect(getWaterAnalysisPageByOrganizationDao).not.toHaveBeenCalled()
    })

    it('ne peut pas gérer les analyses', async () => {
      expect(await canManageWaterAnalysisService(ORG_ID)).toBe(false)
    })
  }
)

describe('publication — refus sans aucune écriture', () => {
  beforeEach(() => {
    setupAuthUserMocked(withRole('owner'))
    resetMocks()
  })

  it("une affiche au mauvais format n'écrit rien, pas même le PDF", async () => {
    const result = await publishWaterAnalysisService(
      publishInput({poster: posterFile(PDF_BYTES)})
    )

    expect(result).toEqual({status: 'rejected', issues: ['poster_format']})
    expectNothingWritten()
  })

  it("un PDF trop lourd n'écrit rien, pas même l'affiche", async () => {
    const heavy = new Uint8Array(10 * 1024 * 1024 + 1)
    heavy.set(PDF_BYTES)

    const result = await publishWaterAnalysisService(
      publishInput({report: reportFile(heavy)})
    )

    expect(result).toEqual({status: 'rejected', issues: ['report_size']})
    expectNothingWritten()
  })

  it('un PDF qui est une image est refusé', async () => {
    const result = await publishWaterAnalysisService(
      publishInput({report: reportFile(PNG_BYTES)})
    )

    expect(result).toEqual({status: 'rejected', issues: ['report_format']})
    expectNothingWritten()
  })

  it('une affiche trop lourde est refusée', async () => {
    const heavy = new Uint8Array(5 * 1024 * 1024 + 1)
    heavy.set(PNG_BYTES)

    const result = await publishWaterAnalysisService(
      publishInput({poster: posterFile(heavy)})
    )

    expect(result).toEqual({status: 'rejected', issues: ['poster_size']})
    expectNothingWritten()
  })

  it('les deux fichiers sont obligatoires', async () => {
    const result = await publishWaterAnalysisService(
      publishInput({poster: undefined, report: undefined})
    )

    expect(result).toEqual({
      status: 'rejected',
      issues: ['missing_poster', 'missing_report'],
    })
    expectNothingWritten()
  })

  it('rend toutes les erreurs cumulées', async () => {
    const result = await publishWaterAnalysisService(
      publishInput({sampledOn: '2026-09-12', report: reportFile(PNG_BYTES)})
    )

    expect(result).toEqual({
      status: 'rejected',
      issues: ['future_date', 'report_format'],
    })
    expectNothingWritten()
  })
})

describe('publication — compensation quand la ligne ne s’écrit pas', () => {
  beforeEach(() => {
    setupAuthUserMocked(withRole('owner'))
    resetMocks()
  })

  it("supprime les deux fichiers tout juste écrits, et propage l'erreur", async () => {
    vi.mocked(createWaterAnalysisDao).mockRejectedValue(
      new Error('insertion refusée')
    )

    await expect(publishWaterAnalysisService(publishInput())).rejects.toThrow(
      'insertion refusée'
    )

    const [posterKey, reportKey] = uploadedKeys()
    expect(storage.delete).toHaveBeenCalledWith(posterKey)
    expect(storage.delete).toHaveBeenCalledWith(reportKey)
  })

  it("supprime l'affiche si l'écriture du PDF échoue", async () => {
    storage.upload
      .mockResolvedValueOnce({path: 'ok'})
      .mockRejectedValueOnce(new Error('disque plein'))

    await expect(publishWaterAnalysisService(publishInput())).rejects.toThrow(
      'disque plein'
    )

    const [posterKey] = uploadedKeys()
    expect(storage.delete).toHaveBeenCalledWith(posterKey)
    expect(createWaterAnalysisDao).not.toHaveBeenCalled()
  })
})

describe('date du prélèvement — le jour courant vient de l’appelant', () => {
  beforeEach(() => {
    setupAuthUserMocked(withRole('owner'))
    resetMocks()
    // L'horloge est ailleurs : si le service la lisait, il accepterait le
    // lendemain de `today`.
    vi.useFakeTimers({toFake: ['Date']})
    vi.setSystemTime(new Date('2030-01-01T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('refuse une date future', async () => {
    const result = await publishWaterAnalysisService(
      publishInput({sampledOn: '2026-09-03'})
    )

    expect(result).toEqual({status: 'rejected', issues: ['future_date']})
    expectNothingWritten()
  })

  it('accepte la date du jour', async () => {
    const result = await publishWaterAnalysisService(
      publishInput({sampledOn: TODAY})
    )

    expect(result.status).toBe('published')
  })

  it('refuse aussi une date future à la correction', async () => {
    const result = await updateWaterAnalysisService(
      updateInput({sampledOn: '2026-09-03'})
    )

    expect(result).toEqual({status: 'rejected', issues: ['future_date']})
    expectNothingWritten()
  })
})

describe('texte facultatif — 500 caractères au plus', () => {
  beforeEach(() => {
    setupAuthUserMocked(withRole('owner'))
    resetMocks()
  })

  it('refuse 501 caractères', async () => {
    const result = await publishWaterAnalysisService(
      publishInput({content: 'a'.repeat(501)})
    )

    expect(result).toEqual({status: 'rejected', issues: ['content_too_long']})
    expectNothingWritten()
  })

  it('accepte 500 caractères', async () => {
    const result = await publishWaterAnalysisService(
      publishInput({content: 'a'.repeat(500)})
    )

    expect(result.status).toBe('published')
  })

  it('accepte un texte vide, et enlève les blancs autour', async () => {
    await publishWaterAnalysisService(publishInput({content: '   '}))

    expect(createWaterAnalysisDao).toHaveBeenCalledWith(
      expect.objectContaining({content: ''})
    )
  })
})

describe('[PUBLIC] lecture publique', () => {
  beforeEach(() => {
    setupAuthUserMocked(undefined)
    resetMocks()
  })

  it('lit la page demandée sans contrôle d’accès, sous le tenant', async () => {
    const list = await getPublicWaterAnalysesPageService(ORG_ID, 2)

    expect(withTenant).toHaveBeenCalledWith(ORG_ID, expect.any(Function))
    expect(getPublishedWaterAnalysisPageDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      limit: 10,
      offset: 10,
    })
    expect(list.page).toBe(2)
  })

  it('compte une page pour une liste vide', async () => {
    vi.mocked(countWaterAnalysesDao).mockResolvedValue(0)

    expect(await getPublicWaterAnalysisPageCountService(ORG_ID)).toBe(1)
    expect(withTenant).toHaveBeenCalledWith(ORG_ID, expect.any(Function))
  })

  it('compte les pages de 10', async () => {
    vi.mocked(countWaterAnalysesDao).mockResolvedValue(11)

    expect(await getPublicWaterAnalysisPageCountService(ORG_ID)).toBe(2)
  })
})
