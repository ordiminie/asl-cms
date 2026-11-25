import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({revalidatePath: vi.fn()}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), {
      digest: `NEXT_REDIRECT;replace;${url}`,
    })
  }),
}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve(
      (key: string, values?: Record<string, unknown>) =>
        `DocumentTemplatesBureau.${key}${values ? JSON.stringify(values) : ''}`
    )
  ),
}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/services/facades/document-template-service-facade', () => ({
  createDocumentTemplateService: vi.fn(),
  updateDocumentTemplateService: vi.fn(),
  deleteDocumentTemplateService: vi.fn(),
  depositTemplateDocumentService: vi.fn(),
  getDocumentLotReachService: vi.fn(),
}))

import {revalidatePath} from 'next/cache'
import {redirect} from 'next/navigation'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {CampaignTargetUnavailableError} from '@/services/errors/campaign-errors'
import {NotFoundError} from '@/services/errors/not-found-error'
import {UnauthenticatedError} from '@/services/errors/unauthenticated-error'
import {
  createDocumentTemplateService,
  deleteDocumentTemplateService,
  depositTemplateDocumentService,
  getDocumentLotReachService,
  updateDocumentTemplateService,
} from '@/services/facades/document-template-service-facade'

import {
  createDocumentTemplateAction,
  deleteDocumentTemplateAction,
  depositTemplateDocumentAction,
  getDocumentLotReachAction,
  updateDocumentTemplateAction,
} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const TEMPLATE_ID = '33333333-3333-4333-8333-333333333333'
const ROUTE = '/[locale]/(bureau)/bureau/modeles-documents'
const template = {
  id: TEMPLATE_ID,
  name: 'Convocation AG',
  subject: 'Convocation',
  bodyMarkdown: 'Bonjour {nom}',
  updatedAt: new Date(),
}

const formOf = (values: Record<string, string>) => {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) formData.set(key, value)
  return formData
}

const fields = {
  name: 'Convocation AG',
  subject: 'Convocation',
  bodyMarkdown: 'Bonjour {nom}',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(requireActionAuth).mockResolvedValue({id: 'u1'} as never)
  vi.mocked(createDocumentTemplateService).mockResolvedValue({
    status: 'saved',
    template,
  })
  vi.mocked(updateDocumentTemplateService).mockResolvedValue({
    status: 'saved',
    template,
  })
  vi.mocked(deleteDocumentTemplateService).mockResolvedValue({
    name: 'Convocation AG',
  })
})

describe('createDocumentTemplateAction', () => {
  it('crée le modèle dans le tenant du domaine, revalide, puis renvoie à l’éditeur', async () => {
    await expect(
      createDocumentTemplateAction({status: 'idle'}, formOf(fields))
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(createDocumentTemplateService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      ...fields,
    })
    expect(revalidatePath).toHaveBeenCalledWith(ROUTE, 'layout')
    expect(redirect).toHaveBeenCalledWith(
      `/bureau/modeles-documents/${TEMPLATE_ID}?enregistre=1`
    )
  })

  it('critère 4 — un refus du service est rendu, sans redirection ni revalidation', async () => {
    vi.mocked(createDocumentTemplateService).mockResolvedValue({
      status: 'rejected',
      issues: {
        bodyMarkdown: {code: 'unknownVariables', variables: ['adresse']},
      },
    })

    await expect(
      createDocumentTemplateAction({status: 'idle'}, formOf(fields))
    ).resolves.toEqual({
      status: 'rejected',
      issues: {
        bodyMarkdown: {code: 'unknownVariables', variables: ['adresse']},
      },
    })
    expect(redirect).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('sans session : refus, rien n’est écrit', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new UnauthenticatedError())

    const result = await createDocumentTemplateAction(
      {status: 'idle'},
      formOf(fields)
    )

    expect(result.status).toBe('error')
    expect(createDocumentTemplateService).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('sans l’action des modèles : message de refus traduit', async () => {
    vi.mocked(createDocumentTemplateService).mockRejectedValue(
      new AuthorizationError('refus')
    )

    await expect(
      createDocumentTemplateAction({status: 'idle'}, formOf(fields))
    ).resolves.toEqual({
      status: 'error',
      message: 'DocumentTemplatesBureau.errors.forbidden',
    })
  })
})

describe('updateDocumentTemplateAction', () => {
  it('modifie le modèle désigné, puis renvoie à l’éditeur', async () => {
    await expect(
      updateDocumentTemplateAction(
        {status: 'idle'},
        formOf({...fields, templateId: TEMPLATE_ID})
      )
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(updateDocumentTemplateService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      templateId: TEMPLATE_ID,
      ...fields,
    })
    expect(redirect).toHaveBeenCalledWith(
      `/bureau/modeles-documents/${TEMPLATE_ID}?enregistre=1`
    )
  })

  it('modèle disparu : message « introuvable »', async () => {
    vi.mocked(updateDocumentTemplateService).mockRejectedValue(
      new NotFoundError('absent')
    )

    await expect(
      updateDocumentTemplateAction(
        {status: 'idle'},
        formOf({...fields, templateId: TEMPLATE_ID})
      )
    ).resolves.toEqual({
      status: 'error',
      message: 'DocumentTemplatesBureau.errors.notFound',
    })
  })
})

describe('deleteDocumentTemplateAction', () => {
  it('supprime le modèle, revalide, puis renvoie à la liste avec le drapeau', async () => {
    await expect(deleteDocumentTemplateAction(TEMPLATE_ID)).rejects.toThrow(
      'NEXT_REDIRECT'
    )

    expect(deleteDocumentTemplateService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      templateId: TEMPLATE_ID,
    })
    expect(revalidatePath).toHaveBeenCalledWith(ROUTE, 'layout')
    expect(redirect).toHaveBeenCalledWith(
      '/bureau/modeles-documents?supprime=1'
    )
  })

  it('sans session : refus, rien n’est supprimé', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new UnauthenticatedError())

    const result = await deleteDocumentTemplateAction(TEMPLATE_ID)

    expect(result).toEqual({
      status: 'error',
      message: 'DocumentTemplatesBureau.editor.delete.failed',
    })
    expect(deleteDocumentTemplateService).not.toHaveBeenCalled()
  })
})

describe('depositTemplateDocumentAction — une fiche, un appel (écran 3 et lot)', () => {
  const PROFILE_ID = 'a1200000-0000-4000-8000-000000000001'
  const CATEGORY_ID = '44444444-4444-4444-8444-444444444444'
  const DOCUMENT_ID = '55555555-5555-4555-8555-555555555555'
  const deposit = () =>
    depositTemplateDocumentAction(
      formOf({
        templateId: TEMPLATE_ID,
        memberProfileId: PROFILE_ID,
        documentDate: '2026-11-25',
        categoryId: CATEGORY_ID,
        title: 'Convocation AG',
      })
    )

  beforeEach(() => {
    vi.mocked(depositTemplateDocumentService).mockResolvedValue({
      status: 'deposited',
      document: {id: DOCUMENT_ID} as never,
    })
  })

  it('dépose par la façade dans le tenant du domaine, puis revalide la fiche', async () => {
    await expect(deposit()).resolves.toEqual({
      status: 'deposited',
      documentId: DOCUMENT_ID,
    })
    expect(depositTemplateDocumentService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      templateId: TEMPLATE_ID,
      memberProfileId: PROFILE_ID,
      documentDate: '2026-11-25',
      categoryId: CATEGORY_ID,
      title: 'Convocation AG',
    })
    expect(revalidatePath).toHaveBeenCalledWith(
      '/[locale]/(bureau)/bureau/proprietaires/[id]',
      'layout'
    )
  })

  it('refus de s32 : raison traduite côté serveur, codes rendus', async () => {
    vi.mocked(depositTemplateDocumentService).mockResolvedValue({
      status: 'rejected',
      issues: ['category_unavailable'],
    })

    await expect(deposit()).resolves.toEqual({
      status: 'failed',
      reason:
        'DocumentTemplatesBureau.depositFailures.rejected{"details":"DocumentTemplatesBureau.depositFailures.issues.category_unavailable"}',
      issues: ['category_unavailable'],
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it.each([
    ['not_found', {status: 'not_found'}],
    ['invalid_date', {status: 'invalid_date'}],
    ['render_failed', {status: 'render_failed'}],
  ] as const)('%s : raison traduite, rien de revalidé', async (key, result) => {
    vi.mocked(depositTemplateDocumentService).mockResolvedValue(result)

    await expect(deposit()).resolves.toEqual({
      status: 'failed',
      reason: `DocumentTemplatesBureau.depositFailures.${key}`,
    })
  })

  it('variable inconnue : nommée dans la raison', async () => {
    vi.mocked(depositTemplateDocumentService).mockResolvedValue({
      status: 'unknown_variables',
      variables: ['adresse'],
    })

    await expect(deposit()).resolves.toEqual({
      status: 'failed',
      reason:
        'DocumentTemplatesBureau.depositFailures.unknown_variables{"variables":"{adresse}"}',
    })
  })

  it('sans member.document.manage : refus traduit, rien n’est déposé', async () => {
    vi.mocked(depositTemplateDocumentService).mockRejectedValue(
      new AuthorizationError('refus')
    )

    await expect(deposit()).resolves.toEqual({
      status: 'failed',
      reason: 'DocumentTemplatesBureau.depositFailures.forbidden',
    })
  })

  it('sans session : refus, la façade n’est pas appelée', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new UnauthenticatedError())

    const result = await deposit()

    expect(result.status).toBe('failed')
    expect(depositTemplateDocumentService).not.toHaveBeenCalled()
  })
})

describe('getDocumentLotReachAction — le décompte du lot (écran 4)', () => {
  const reach = {profiles: [], total: 0, withoutCurrentParcel: 0}

  it('lit la portée de la cible dans le tenant du domaine', async () => {
    vi.mocked(getDocumentLotReachService).mockResolvedValue(reach)

    await expect(
      getDocumentLotReachAction({kind: 'all_members'})
    ).resolves.toEqual({status: 'ready', reach})
    expect(getDocumentLotReachService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      target: {kind: 'all_members'},
    })
  })

  it.each([
    [new CampaignTargetUnavailableError(), 'lot.reachErrors.unpaidUnavailable'],
    [new NotFoundError('groupe'), 'lot.reachErrors.groupNotFound'],
    [new AuthorizationError('refus'), 'errors.forbidden'],
    [new Error('panne'), 'lot.reachErrors.failed'],
  ])('%s : message traduit, jamais de repli', async (error, key) => {
    vi.mocked(getDocumentLotReachService).mockRejectedValue(error)

    await expect(
      getDocumentLotReachAction({kind: 'unpaid_members'})
    ).resolves.toEqual({
      status: 'error',
      message: `DocumentTemplatesBureau.${key}`,
    })
  })

  it('sans session : refus, rien n’est lu', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new UnauthenticatedError())

    const result = await getDocumentLotReachAction({kind: 'all_members'})

    expect(result.status).toBe('error')
    expect(getDocumentLotReachService).not.toHaveBeenCalled()
  })
})
