import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({updateTag: vi.fn()}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw Object.assign(new Error('NEXT_REDIRECT'), {digest: 'NEXT_REDIRECT'})
  }),
}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() => Promise.resolve((key: string) => key)),
}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/services/facades/water-analysis-service-facade', () => ({
  deleteWaterAnalysisService: vi.fn(),
  publishWaterAnalysisService: vi.fn(),
  updateWaterAnalysisService: vi.fn(),
}))

import {updateTag} from 'next/cache'
import {redirect} from 'next/navigation'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {
  deleteWaterAnalysisService,
  publishWaterAnalysisService,
  updateWaterAnalysisService,
} from '@/services/facades/water-analysis-service-facade'
import {WaterAnalysisDTO} from '@/services/types/domain/water-analysis-types'

import {
  deleteWaterAnalysisAction,
  publishWaterAnalysisAction,
  updateWaterAnalysisAction,
} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const ANALYSIS_ID = '33333333-3333-4333-8333-333333333333'
const LIST_TAG = `water-analysis:${TENANT_ID}`

const analysis: WaterAnalysisDTO = {
  id: ANALYSIS_ID,
  organizationId: TENANT_ID,
  sampledOn: '2026-09-01',
  posterKey: 'p',
  reportKey: 'r',
  reportBytes: 1,
  content: '',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const poster = new File([new Uint8Array([1])], 'affiche.png')
const report = new File([new Uint8Array([2])], 'resultat.pdf')

const formDataOf = (entries: Record<string, string | File>): FormData => {
  const formData = new FormData()
  for (const [key, value] of Object.entries(entries)) {
    formData.append(key, value)
  }
  return formData
}

const publishForm = () =>
  formDataOf({sampledOn: '2026-09-01', content: 'Texte', poster, report})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(requireActionAuth).mockResolvedValue({id: 'user'} as never)
  vi.mocked(publishWaterAnalysisService).mockResolvedValue({
    status: 'published',
    analysis,
  })
  vi.mocked(updateWaterAnalysisService).mockResolvedValue({
    status: 'saved',
    analysis,
  })
  vi.mocked(deleteWaterAnalysisService).mockResolvedValue({status: 'deleted'})
})

afterEach(() => {
  vi.useRealTimers()
})

describe('publishWaterAnalysisAction', () => {
  it('publie les champs et les deux fichiers du même envoi, invalide la liste, puis revient à la liste', async () => {
    await expect(
      publishWaterAnalysisAction({status: 'idle'}, publishForm())
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(requireActionAuth).toHaveBeenCalled()
    expect(publishWaterAnalysisService).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: TENANT_ID,
        sampledOn: '2026-09-01',
        content: 'Texte',
        poster,
        report,
      })
    )
    expect(updateTag).toHaveBeenCalledWith(LIST_TAG)
    expect(vi.mocked(updateTag).mock.invocationCallOrder[0]).toBeGreaterThan(
      vi.mocked(publishWaterAnalysisService).mock.invocationCallOrder[0]
    )
    expect(redirect).toHaveBeenCalledWith('/bureau/analyses-eau?statut=publiee')
  })

  it('passe au service le jour calendaire de Paris, lu par l’action', async () => {
    vi.useFakeTimers({toFake: ['Date']})
    vi.setSystemTime(new Date('2026-09-01T23:30:00Z'))

    await expect(
      publishWaterAnalysisAction({status: 'idle'}, publishForm())
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(publishWaterAnalysisService).toHaveBeenCalledWith(
      expect.objectContaining({today: '2026-09-02'})
    )
  })

  it("rend le refus sans rien invalider ni quitter l'écran", async () => {
    vi.mocked(publishWaterAnalysisService).mockResolvedValue({
      status: 'rejected',
      issues: ['future_date'],
    })

    const state = await publishWaterAnalysisAction(
      {status: 'idle'},
      publishForm()
    )

    expect(state).toEqual({status: 'rejected', issues: ['future_date']})
    expect(updateTag).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it("traduit un refus d'autorisation, sans rien invalider", async () => {
    vi.mocked(publishWaterAnalysisService).mockRejectedValue(
      new AuthorizationError()
    )

    const state = await publishWaterAnalysisAction(
      {status: 'idle'},
      publishForm()
    )

    expect(state).toEqual({status: 'error', message: 'forbidden'})
    expect(updateTag).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('ignore un fichier vide, comme un champ laissé sans fichier', async () => {
    await expect(
      publishWaterAnalysisAction(
        {status: 'idle'},
        formDataOf({
          sampledOn: '2026-09-01',
          content: '',
          poster: new File([], ''),
          report,
        })
      )
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(publishWaterAnalysisService).toHaveBeenCalledWith(
      expect.objectContaining({poster: undefined, report})
    )
  })
})

describe('updateWaterAnalysisAction', () => {
  it('corrige, invalide la liste, puis revient à la liste', async () => {
    await expect(
      updateWaterAnalysisAction(
        {status: 'idle'},
        formDataOf({
          analysisId: ANALYSIS_ID,
          sampledOn: '2026-08-30',
          content: '',
          report,
        })
      )
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(updateWaterAnalysisService).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: TENANT_ID,
        analysisId: ANALYSIS_ID,
        sampledOn: '2026-08-30',
        poster: undefined,
        report,
      })
    )
    expect(updateTag).toHaveBeenCalledWith(LIST_TAG)
    expect(redirect).toHaveBeenCalledWith(
      '/bureau/analyses-eau?statut=enregistree'
    )
  })

  it("n'invalide rien après un refus", async () => {
    vi.mocked(updateWaterAnalysisService).mockResolvedValue({
      status: 'rejected',
      issues: ['content_too_long'],
    })

    const state = await updateWaterAnalysisAction(
      {status: 'idle'},
      formDataOf({analysisId: ANALYSIS_ID, sampledOn: '2026-08-30'})
    )

    expect(state.status).toBe('rejected')
    expect(updateTag).not.toHaveBeenCalled()
  })
})

describe('deleteWaterAnalysisAction', () => {
  it('supprime, invalide la liste, puis revient à la liste', async () => {
    await expect(deleteWaterAnalysisAction(ANALYSIS_ID)).rejects.toThrow(
      'NEXT_REDIRECT'
    )

    expect(deleteWaterAnalysisService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      analysisId: ANALYSIS_ID,
    })
    expect(updateTag).toHaveBeenCalledWith(LIST_TAG)
    expect(redirect).toHaveBeenCalledWith(
      '/bureau/analyses-eau?statut=supprimee'
    )
  })

  it("n'invalide rien quand la suppression échoue", async () => {
    vi.mocked(deleteWaterAnalysisService).mockRejectedValue(new Error('panne'))

    const state = await deleteWaterAnalysisAction(ANALYSIS_ID)

    expect(state).toEqual({status: 'error', message: 'deleteFailed'})
    expect(updateTag).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })
})
