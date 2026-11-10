import {describe, expect, it} from 'vitest'

import {CAMPAIGN_STALE_AFTER_MS} from '../types/domain/campaign-types'
import {
  computeCampaignTarget,
  effectiveCampaignStatus,
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

describe('effectiveCampaignStatus', () => {
  const now = new Date('2026-11-10T12:00:00.000Z')

  it('montre interrompue une campagne en cours sans progrès depuis longtemps', () => {
    const updatedAt = new Date(now.getTime() - CAMPAIGN_STALE_AFTER_MS - 1)
    expect(
      effectiveCampaignStatus(
        {status: 'sending', updatedAt: updatedAt.toISOString()},
        now
      )
    ).toBe('interrupted')
  })

  it('laisse en cours une campagne qui progresse', () => {
    const updatedAt = new Date(now.getTime() - 1000)
    expect(
      effectiveCampaignStatus(
        {status: 'sending', updatedAt: updatedAt.toISOString()},
        now
      )
    ).toBe('sending')
  })

  it('ne change pas une campagne terminée', () => {
    expect(
      effectiveCampaignStatus(
        {status: 'sent', updatedAt: '2020-01-01T00:00:00.000Z'},
        now
      )
    ).toBe('sent')
  })
})

describe('toCampaignDto — liste blanche', () => {
  it('ne rend ni association, ni soumission, ni compte auteur, ni imitation', () => {
    const dto = toCampaignDto({
      id: 'c1',
      organizationId: 'org',
      submissionId: 'sub',
      subject: 'Objet',
      preheader: null,
      bodyMarkdown: 'Bonjour {nom}',
      templateId: 'free',
      targetKind: 'all_members',
      recipientCount: 2,
      withoutEmailCount: 1,
      unsubscribedCount: 0,
      sentCount: 2,
      status: 'sent',
      sendDate: '2026-11-10',
      authorUserId: 'u1',
      authorName: 'Marie',
      onBehalfOfUserId: 'u2',
      onBehalfOfName: 'Jean',
      createdAt: new Date('2026-11-10T10:00:00.000Z'),
      updatedAt: new Date('2026-11-10T10:01:00.000Z'),
      finishedAt: new Date('2026-11-10T10:01:00.000Z'),
    })

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
        'sendDate',
        'authorName',
        'createdAt',
        'updatedAt',
        'finishedAt',
      ].sort()
    )
    expect(dto.bodyMarkdown).toBe('Bonjour {nom}')
    expect(dto.finishedAt).toBe('2026-11-10T10:01:00.000Z')
  })
})

describe('formatCampaignDate — la valeur de {date}', () => {
  it('écrit le jour d’envoi en toutes lettres, en français', () => {
    expect(formatCampaignDate('2026-11-12')).toBe('12 novembre 2026')
    expect(formatCampaignDate('2026-01-01')).toBe('1 janvier 2026')
  })
})
