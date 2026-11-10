import {describe, expect, it} from 'vitest'

import {
  CAMPAIGN_BODY_MAX,
  CAMPAIGN_PREHEADER_MAX,
} from '../types/domain/campaign-types'
import {
  campaignByIdServiceSchema,
  campaignsPageServiceSchema,
  createCampaignFormSchema,
  createPreviewCampaignServiceSchema,
  createSendCampaignServiceSchema,
  unsubscribeTokenSchema,
} from './campaign-validation'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const SUBMISSION_ID = '22222222-2222-4222-8222-222222222222'

const content = {
  organizationId: ORG_ID,
  templateId: 'free',
  subject: 'Assemblée générale',
  preheader: '',
  bodyMarkdown: 'Bonjour {nom}',
}

describe('createSendCampaignServiceSchema', () => {
  const schema = createSendCampaignServiceSchema(45)
  const parse = (input: Record<string, unknown>) =>
    schema.safeParse({...content, submissionId: SUBMISSION_ID, ...input})

  it('accepte une campagne complète', () => {
    expect(parse({}).success).toBe(true)
  })

  it('refuse un objet vide ou blanc', () => {
    expect(parse({subject: ''}).success).toBe(false)
    expect(parse({subject: '   '}).success).toBe(false)
  })

  it('borne l’objet au plafond calculé, pas à un chiffre fixe', () => {
    expect(parse({subject: 'a'.repeat(45)}).success).toBe(true)
    expect(parse({subject: 'a'.repeat(46)}).success).toBe(false)
    expect(
      createSendCampaignServiceSchema(50).safeParse({
        ...content,
        submissionId: SUBMISSION_ID,
        subject: 'a'.repeat(46),
      }).success
    ).toBe(true)
  })

  it('refuse un objet sur plusieurs lignes', () => {
    expect(parse({subject: 'Objet\nBcc: x'}).success).toBe(false)
  })

  it('borne le texte d’aperçu et le corps', () => {
    expect(parse({preheader: 'a'.repeat(CAMPAIGN_PREHEADER_MAX)}).success).toBe(
      true
    )
    expect(
      parse({preheader: 'a'.repeat(CAMPAIGN_PREHEADER_MAX + 1)}).success
    ).toBe(false)
    expect(parse({bodyMarkdown: '  '}).success).toBe(false)
    expect(
      parse({bodyMarkdown: 'a'.repeat(CAMPAIGN_BODY_MAX + 1)}).success
    ).toBe(false)
  })

  it('exige un modèle de la liste et des identifiants uuid', () => {
    expect(parse({templateId: 'autre'}).success).toBe(false)
    expect(parse({submissionId: 'abc'}).success).toBe(false)
    expect(parse({organizationId: 'abc'}).success).toBe(false)
  })
})

describe('createPreviewCampaignServiceSchema', () => {
  const schema = createPreviewCampaignServiceSchema(45)

  it('accepte une fiche d’aperçu facultative, uuid si présente', () => {
    expect(schema.safeParse(content).success).toBe(true)
    expect(
      schema.safeParse({
        ...content,
        memberProfileId: '33333333-3333-4333-8333-333333333333',
      }).success
    ).toBe(true)
    expect(schema.safeParse({...content, memberProfileId: 'x'}).success).toBe(
      false
    )
  })
})

describe('lectures', () => {
  it('exige une page entière positive et une campagne uuid', () => {
    expect(
      campaignsPageServiceSchema.safeParse({organizationId: ORG_ID, page: 1})
        .success
    ).toBe(true)
    expect(
      campaignsPageServiceSchema.safeParse({organizationId: ORG_ID, page: 0})
        .success
    ).toBe(false)
    expect(
      campaignByIdServiceSchema.safeParse({
        organizationId: ORG_ID,
        campaignId: 'x',
      }).success
    ).toBe(false)
  })
})

describe('unsubscribeTokenSchema', () => {
  it('accepte un jeton de 32 octets en base64url, rien d’autre', () => {
    expect(unsubscribeTokenSchema.safeParse('a'.repeat(43)).success).toBe(true)
    expect(
      unsubscribeTokenSchema.safeParse(`${'A_-b'.repeat(10)}abc`).success
    ).toBe(true)
    expect(unsubscribeTokenSchema.safeParse('a'.repeat(42)).success).toBe(false)
    expect(unsubscribeTokenSchema.safeParse(`${'a'.repeat(42)}/`).success).toBe(
      false
    )
  })
})

describe('createCampaignFormSchema', () => {
  const t = (key: string, values?: Record<string, string | number>) =>
    values ? `${key}:${JSON.stringify(values)}` : key
  const schema = createCampaignFormSchema(t, 45)
  const form = {
    templateId: 'free',
    subject: 'Objet',
    preheader: '',
    bodyMarkdown: 'Corps',
  }

  it('accepte une saisie complète', () => {
    expect(schema.safeParse(form).success).toBe(true)
  })

  it('nomme le champ manquant et le dépassement', () => {
    const empty = schema.safeParse({...form, subject: '', bodyMarkdown: ''})
    expect(empty.success).toBe(false)
    const messages = empty.error?.issues.map((issue) => issue.message) ?? []
    expect(messages).toContain('composer.validation.subjectRequired')
    expect(messages).toContain('composer.validation.bodyRequired')

    const long = schema.safeParse({...form, subject: 'a'.repeat(47)})
    expect(long.error?.issues[0]?.message).toBe(
      'composer.validation.tooLong:{"count":2}'
    )
  })
})
