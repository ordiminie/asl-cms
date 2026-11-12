import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({revalidatePath: vi.fn()}))
vi.mock('next/server', () => ({after: vi.fn()}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve(
      (key: string, values?: Record<string, unknown>) =>
        `CampaignsBureau.${key}${values ? JSON.stringify(values) : ''}`
    )
  ),
}))
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/services/facades/campaign-service-facade', () => ({
  previewCampaignService: vi.fn(),
  previewCampaignPlanService: vi.fn(),
  sendCampaignService: vi.fn(),
}))

import {revalidatePath} from 'next/cache'
import {after} from 'next/server'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {logger} from '@/lib/logger'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {
  previewCampaignPlanService,
  previewCampaignService,
  sendCampaignService,
} from '@/services/facades/campaign-service-facade'

import {previewCampaignAction, sendCampaignAction} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const CAMPAIGN_ID = '33333333-3333-4333-8333-333333333333'
const SUBMISSION_ID = '44444444-4444-4444-8444-444444444444'
const PROFILE_ID = '55555555-5555-4555-8555-555555555555'
const SECRET = 'Le portail sera repeint du 18 au 20 novembre.'

const formOf = (values: Record<string, string>) => {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) formData.set(key, value)
  return formData
}

const content = {
  templateId: 'free',
  subject: 'Peinture du portail',
  preheader: '',
  bodyMarkdown: SECRET,
}

const allLoggerCalls = () =>
  Object.values(vi.mocked(logger)).flatMap(
    (method) => (method as ReturnType<typeof vi.fn>).mock.calls
  )

const deliver = vi.fn(async () => undefined)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({
    id: TENANT_ID,
    name: 'ASL Les Pins',
  } as never)
  vi.mocked(requireActionAuth).mockResolvedValue({id: 'u1'} as never)
  vi.mocked(sendCampaignService).mockResolvedValue({
    status: 'created',
    campaignId: CAMPAIGN_ID,
    deliver,
  })
  vi.mocked(previewCampaignService).mockResolvedValue({status: 'no_recipient'})
})

describe('sendCampaignAction', () => {
  it('envoie par la façade dans le tenant du domaine, pose la livraison dans after() une fois, revalide', async () => {
    const result = await sendCampaignAction(
      undefined,
      formOf({...content, submissionId: SUBMISSION_ID})
    )

    expect(result).toEqual({status: 'created', campaignId: CAMPAIGN_ID})
    expect(sendCampaignService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      submissionId: SUBMISSION_ID,
      ...content,
    })
    expect(after).toHaveBeenCalledTimes(1)
    expect(after).toHaveBeenCalledWith(deliver)
    expect(revalidatePath).toHaveBeenCalledWith(
      '/[locale]/(bureau)/bureau/campagnes',
      'layout'
    )
  })

  it('soumission rejouée : la même campagne, aucune livraison posée', async () => {
    vi.mocked(sendCampaignService).mockResolvedValue({
      status: 'created',
      campaignId: CAMPAIGN_ID,
      deliver: null,
    })

    const result = await sendCampaignAction(
      undefined,
      formOf({...content, submissionId: SUBMISSION_ID})
    )

    expect(result).toEqual({status: 'created', campaignId: CAMPAIGN_ID})
    expect(after).not.toHaveBeenCalled()
  })

  it('sans session → refus, ni façade ni after()', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    const result = await sendCampaignAction(
      undefined,
      formOf({...content, submissionId: SUBMISSION_ID})
    )

    expect(result).toEqual({
      status: 'error',
      message: 'CampaignsBureau.errors.forbidden',
    })
    expect(sendCampaignService).not.toHaveBeenCalled()
    expect(after).not.toHaveBeenCalled()
  })

  it('saisie invalide → erreurs par champ, aucune écriture', async () => {
    const result = await sendCampaignAction(
      undefined,
      formOf({...content, subject: '  ', submissionId: SUBMISSION_ID})
    )

    expect(result).toMatchObject({
      status: 'invalid',
      errors: [
        {
          field: 'subject',
          message: 'CampaignsBureau.composer.validation.subjectRequired',
        },
      ],
    })
    expect(sendCampaignService).not.toHaveBeenCalled()
    expect(after).not.toHaveBeenCalled()
  })

  it('objet au-delà du plafond calculé depuis le nom de l’association → invalide', async () => {
    const result = await sendCampaignAction(
      undefined,
      formOf({
        ...content,
        subject: 'x'.repeat(46),
        submissionId: SUBMISSION_ID,
      })
    )

    expect(result.status).toBe('invalid')
    expect(sendCampaignService).not.toHaveBeenCalled()
  })

  it.each([
    [{status: 'unknown_variables', variables: ['parcele']}],
    [{status: 'no_recipient'}],
    [{status: 'delivery_disabled'}],
  ] as const)(
    'refus du service %j → rendu tel quel, pas d’after()',
    async (refusal) => {
      vi.mocked(sendCampaignService).mockResolvedValue(refusal as never)

      const result = await sendCampaignAction(
        undefined,
        formOf({...content, submissionId: SUBMISSION_ID})
      )

      expect(result).toEqual(refusal)
      expect(after).not.toHaveBeenCalled()
      expect(revalidatePath).not.toHaveBeenCalled()
    }
  )

  it('échec technique → message générique, sans contenu journalisé', async () => {
    vi.mocked(sendCampaignService).mockRejectedValue(new Error(SECRET))

    const result = await sendCampaignAction(
      undefined,
      formOf({...content, submissionId: SUBMISSION_ID})
    )

    expect(result).toEqual({
      status: 'error',
      message: 'CampaignsBureau.errors.failed',
    })
    expect(after).not.toHaveBeenCalled()
    expect(JSON.stringify(allLoggerCalls())).not.toContain(SECRET)
  })
})

describe('previewCampaignAction', () => {
  it('rend l’aperçu de la façade pour le membre choisi, sans rien écrire', async () => {
    const preview = {
      member: {id: PROFILE_ID, name: 'Claire Aubert'},
      subject: 'ASL Les Pins — Peinture du portail',
      preheader: null,
      html: '<html></html>',
      text: 'texte',
      counts: {recipients: 2, withoutEmail: 1, unsubscribed: 0, total: 3},
    }
    const plan = {
      today: '2026-11-12',
      dailySendCap: 100,
      allottedToday: 0,
      parts: [{day: '2026-11-12', count: 2}],
    }
    vi.mocked(previewCampaignService).mockResolvedValue({
      status: 'ok',
      preview,
    })
    vi.mocked(previewCampaignPlanService).mockResolvedValue(plan)

    const result = await previewCampaignAction(
      undefined,
      formOf({...content, memberProfileId: PROFILE_ID})
    )

    expect(result).toEqual({status: 'ok', preview, plan})
    expect(previewCampaignPlanService).toHaveBeenCalledWith(TENANT_ID)
    expect(previewCampaignService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      ...content,
      memberProfileId: PROFILE_ID,
    })
    expect(sendCampaignService).not.toHaveBeenCalled()
    expect(after).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('sans membre choisi, la façade choisit le premier joignable', async () => {
    await previewCampaignAction(undefined, formOf(content))

    expect(
      vi.mocked(previewCampaignService).mock.calls[0][0]
    ).not.toHaveProperty('memberProfileId')
  })

  it('variable inconnue → signalée, pas d’aperçu', async () => {
    vi.mocked(previewCampaignService).mockResolvedValue({
      status: 'unknown_variables',
      variables: ['parcele'],
    })

    await expect(
      previewCampaignAction(undefined, formOf(content))
    ).resolves.toEqual({status: 'unknown_variables', variables: ['parcele']})
    expect(previewCampaignPlanService).not.toHaveBeenCalled()
  })

  it('sans session → refus, aucune façade', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    await expect(
      previewCampaignAction(undefined, formOf(content))
    ).resolves.toEqual({
      status: 'error',
      message: 'CampaignsBureau.errors.forbidden',
    })
    expect(previewCampaignService).not.toHaveBeenCalled()
  })
})
