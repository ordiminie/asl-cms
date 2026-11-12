import {describe, expect, it} from 'vitest'

import * as rules from './campaign-rules'
import {
  computeCampaignTarget,
  escapeHtml,
  finalSubject,
  findUnknownVariables,
  formatCampaignDate,
  joinParcelNumbers,
  subjectMaxLength,
  substituteVariables,
  toCampaignDto,
} from './campaign-rules'

describe('findUnknownVariables — sur l’écrit brut (critère 4)', () => {
  it('signale une variable mal orthographiée', () => {
    expect(findUnknownVariables('Parcelle {parcele}')).toEqual(['parcele'])
  })

  it('accepte les variables connues', () => {
    expect(findUnknownVariables('Bonjour {nom}, {parcelle} le {date}')).toEqual(
      []
    )
  })

  it('ignore les accolades sans mot', () => {
    expect(findUnknownVariables('Rien {} ni { } ici')).toEqual([])
  })

  it('rend chaque inconnue une fois, dans l’ordre d’apparition', () => {
    expect(findUnknownVariables('{prenom} {Nom} {prenom}')).toEqual([
      'prenom',
      'Nom',
    ])
  })
})

describe('substituteVariables', () => {
  const values = {
    nom: 'SCI <b>Les Pins</b> & fils',
    parcelle: '12',
    date: '10/11/2026',
  }

  it('remplace les variables et échappe les valeurs pour le HTML', () => {
    expect(
      substituteVariables('Bonjour {nom} ({parcelle})', values, escapeHtml)
    ).toBe('Bonjour SCI &lt;b&gt;Les Pins&lt;/b&gt; &amp; fils (12)')
  })

  it('laisse une valeur brute quand l’échappement est l’identité', () => {
    expect(substituteVariables('{nom}', values, (v) => v)).toBe(
      'SCI <b>Les Pins</b> & fils'
    )
  })

  it('ne touche pas une accolade qui n’est pas une variable', () => {
    expect(substituteVariables('{inconnue} {}', values, escapeHtml)).toBe(
      '{inconnue} {}'
    )
  })
})

describe('joinParcelNumbers', () => {
  it.each([
    [[], ''],
    [['12'], '12'],
    [['12', '14'], '12 et 14'],
    [['12', '14', '16'], '12, 14 et 16'],
  ])('%j → %s', (numbers, expected) => {
    expect(joinParcelNumbers(numbers)).toBe(expected)
  })
})

describe('computeCampaignTarget — point de passage unique (critères 2, 7)', () => {
  const rows = [
    {memberProfileId: 'a', name: 'A', email: 'a@x.fr', unsubscribed: false},
    {memberProfileId: 'b', name: 'B', email: null, unsubscribed: false},
    {memberProfileId: 'c', name: 'C', email: 'c@x.fr', unsubscribed: true},
    {memberProfileId: 'd', name: 'D', email: null, unsubscribed: true},
    {memberProfileId: 'e', name: 'E', email: 'e@x.fr', unsubscribed: false},
  ]

  it('partitionne : joignables, sans email, désinscrits ; la somme fait le total', () => {
    const target = computeCampaignTarget(rows)

    expect(target.recipients.map((r) => r.memberProfileId)).toEqual(['a', 'e'])
    expect(target.withoutEmail).toBe(2)
    expect(target.unsubscribed).toBe(1)
    expect(
      target.recipients.length + target.withoutEmail + target.unsubscribed
    ).toBe(rows.length)
  })

  it('ne compte jamais un membre sans email comme désinscrit ni destinataire', () => {
    const target = computeCampaignTarget([rows[3]])

    expect(target.recipients).toEqual([])
    expect(target.unsubscribed).toBe(0)
    expect(target.withoutEmail).toBe(1)
  })
})

describe('plafond et objet final', () => {
  it('déduit le plafond du champ du préfixe de l’association', () => {
    expect(subjectMaxLength('ASL Les Pins')).toBe(60 - 'ASL Les Pins — '.length)
    expect(subjectMaxLength('ASL')).toBeGreaterThan(
      subjectMaxLength('ASL Les Pins')
    )
  })

  it('préfixe l’objet du nom de l’association', () => {
    expect(finalSubject('ASL Les Pins', 'Assemblée générale')).toBe(
      'ASL Les Pins — Assemblée générale'
    )
  })
})

describe('statut affiché — plus de statut « effectif » (s26, ADR 052)', () => {
  it('une campagne en cours sans progrès depuis un jour n’est pas déclarée interrompue', () => {
    expect(rules).not.toHaveProperty('effectiveCampaignStatus')
  })
})

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  organizationId: 'org',
  submissionId: 'sub',
  subject: 'Objet',
  preheader: null,
  bodyMarkdown: 'Bonjour {nom}',
  templateId: 'free',
  targetKind: 'all_members',
  recipientCount: 296,
  withoutEmailCount: 1,
  unsubscribedCount: 0,
  sentCount: 200,
  status: 'sending' as const,
  sendDate: '2026-11-12',
  authorUserId: 'u1',
  authorName: 'Marie',
  onBehalfOfUserId: 'u2',
  onBehalfOfName: 'Jean',
  createdAt: new Date('2026-11-12T13:32:00.000Z'),
  updatedAt: new Date('2026-11-12T13:40:00.000Z'),
  finishedAt: null,
  ...overrides,
})

const parts = [
  {
    id: 'p1',
    campaignId: 'c1',
    number: 1,
    scheduledFor: '2026-11-12',
    recipientCount: 100,
    status: 'sent' as const,
  },
  {
    id: 'p2',
    campaignId: 'c1',
    number: 2,
    scheduledFor: '2026-11-13',
    recipientCount: 100,
    status: 'sent' as const,
  },
  {
    id: 'p3',
    campaignId: 'c1',
    number: 3,
    scheduledFor: '2026-11-14',
    recipientCount: 96,
    status: 'scheduled' as const,
  },
]

const counts = [
  {campaignId: 'c1', partId: 'p1', status: 'sent' as const, total: 100},
  {campaignId: 'c1', partId: 'p2', status: 'sent' as const, total: 98},
  {campaignId: 'c1', partId: 'p2', status: 'to_verify' as const, total: 2},
  {campaignId: 'c1', partId: 'p3', status: 'pending' as const, total: 95},
  {campaignId: 'c1', partId: 'p3', status: 'unsubscribed' as const, total: 1},
  {campaignId: 'other', partId: 'x', status: 'sent' as const, total: 50},
]

describe('toCampaignDto — liste blanche', () => {
  it('ne rend ni association, ni soumission, ni compte auteur, ni imitation, ni jeton', () => {
    const dto = toCampaignDto(row({status: 'sent'}), [], [])

    expect(Object.keys(dto).sort()).toEqual(
      [
        'id',
        'subject',
        'preheader',
        'bodyMarkdown',
        'templateId',
        'targetKind',
        'recipientCount',
        'withoutEmailCount',
        'unsubscribedCount',
        'sentCount',
        'status',
        'displayState',
        'recipientCounts',
        'parts',
        'sendDate',
        'authorName',
        'createdAt',
        'updatedAt',
        'finishedAt',
      ].sort()
    )
    expect(JSON.stringify(dto)).not.toMatch(/unsubscribeToken|token/i)
    expect(dto.bodyMarkdown).toBe('Bonjour {nom}')
  })

  it('les décomptes par statut sont ceux de la campagne, et leur somme fait les destinataires', () => {
    const dto = toCampaignDto(row(), parts, counts)

    expect(dto.recipientCounts).toEqual({
      received: 198,
      scheduled: 95,
      sending: 0,
      toVerify: 2,
      failed: 0,
      unsubscribed: 1,
    })
    expect(
      Object.values(dto.recipientCounts).reduce((sum, n) => sum + n, 0)
    ).toBe(296)
  })

  it('chaque part porte son jour, ses destinataires et son état', () => {
    const dto = toCampaignDto(row(), parts, counts)

    expect(dto.parts).toEqual([
      {
        number: 1,
        day: '2026-11-12',
        recipientCount: 100,
        receivedCount: 100,
        toVerifyCount: 0,
        displayState: 'sent',
      },
      {
        number: 2,
        day: '2026-11-13',
        recipientCount: 100,
        receivedCount: 98,
        toVerifyCount: 2,
        displayState: 'to_verify',
      },
      {
        number: 3,
        day: '2026-11-14',
        recipientCount: 96,
        receivedCount: 0,
        toVerifyCount: 0,
        displayState: 'scheduled',
      },
    ])
  })
})

describe('displayState — l’état de la campagne lu des statuts', () => {
  it('en cours tant qu’elle est sending, même avec une part programmée à demain', () => {
    expect(toCampaignDto(row(), parts, counts).displayState).toBe('sending')
  })

  it('envoyée quand elle est close sans ligne à vérifier', () => {
    expect(
      toCampaignDto(
        row({status: 'sent'}),
        [],
        [{campaignId: 'c1', partId: 'p1', status: 'sent', total: 296}]
      ).displayState
    ).toBe('sent')
  })

  it('à vérifier quand elle est close avec des lignes à vérifier', () => {
    expect(
      toCampaignDto(row({status: 'sent'}), parts, counts).displayState
    ).toBe('to_verify')
  })

  it('en échec quand elle est interrompue', () => {
    expect(
      toCampaignDto(row({status: 'interrupted'}), parts, counts).displayState
    ).toBe('failed')
  })
})

describe('formatCampaignDate — la valeur de {date}', () => {
  it('écrit le jour d’envoi en toutes lettres, en français', () => {
    expect(formatCampaignDate('2026-11-12')).toBe('12 novembre 2026')
    expect(formatCampaignDate('2026-01-01')).toBe('1 janvier 2026')
  })
})
