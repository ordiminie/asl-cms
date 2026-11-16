import {describe, expect, it} from 'vitest'

import {TENANT_EMAIL_NATURES} from '../types/domain/email-send-types'
import {parisTwoAm} from './campaign-schedule-rules'
import {
  budgetDayOf,
  deferredRunAfter,
  deferredSendOn,
  groupPendingSends,
  isDeferredByCaller,
  isNeverDeferred,
  remainingReportable,
  reportableAllowance,
} from './email-budget-rules'

describe('reportableAllowance — ce que les envois reportables consomment au plus (critère 3)', () => {
  it('la limite moins la réserve : 300 − 100 = 200', () => {
    expect(reportableAllowance(300, 100)).toBe(200)
  })

  it('limite égale à la réserve : aucun envoi reportable', () => {
    expect(reportableAllowance(100, 100)).toBe(0)
  })

  it('jamais négatif, même si la réserve dépasse la limite', () => {
    expect(reportableAllowance(50, 100)).toBe(0)
  })
})

describe('remainingReportable — autres envois encore possibles aujourd’hui', () => {
  it('la marge des reportables moins ce qui est déjà parti', () => {
    expect(remainingReportable(300, 100, 78)).toBe(122)
  })

  it('jamais négatif', () => {
    expect(remainingReportable(300, 100, 200)).toBe(0)
    expect(remainingReportable(300, 100, 250)).toBe(0)
  })
})

describe('isNeverDeferred — seuls les emails de connexion partent toujours', () => {
  it('le lien de connexion n’est jamais reporté', () => {
    expect(isNeverDeferred('login')).toBe(true)
  })

  it('une campagne et une notification au bureau sont reportables', () => {
    expect(isNeverDeferred('campaign')).toBe(false)
    expect(isNeverDeferred('board_notification')).toBe(false)
  })
})

describe('isDeferredByCaller — une campagne tient sa propre file (ADR 053 §5)', () => {
  it('seule la campagne n’est pas copiée pour rejeu', () => {
    expect(isDeferredByCaller('campaign')).toBe(true)
    expect(isDeferredByCaller('board_notification')).toBe(false)
    expect(isDeferredByCaller('login')).toBe(false)
  })
})

describe('budgetDayOf — jour de Paris, frontière 23:59 / 00:00 (critère 10)', () => {
  it('hiver : 23:59:59 à Paris compte la veille, 00:00:00 le lendemain', () => {
    expect(budgetDayOf(new Date('2026-11-14T22:59:59Z'))).toBe('2026-11-14')
    expect(budgetDayOf(new Date('2026-11-14T23:00:00Z'))).toBe('2026-11-15')
  })

  it('été : 23:59:59 à Paris compte la veille, 00:00:00 le lendemain', () => {
    expect(budgetDayOf(new Date('2026-07-14T21:59:59Z'))).toBe('2026-07-14')
    expect(budgetDayOf(new Date('2026-07-14T22:00:00Z'))).toBe('2026-07-15')
  })
})

describe('parisTwoAm — 02:00 heure de Paris d’un jour (ADR 053 §6)', () => {
  it('hiver : 02:00 à Paris = 01:00 UTC', () => {
    expect(parisTwoAm('2026-11-15').toISOString()).toBe(
      '2026-11-15T01:00:00.000Z'
    )
  })

  it('été : 02:00 à Paris = 00:00 UTC', () => {
    expect(parisTwoAm('2026-07-15').toISOString()).toBe(
      '2026-07-15T00:00:00.000Z'
    )
  })

  it('passage à l’heure d’été : 02:00 n’existe pas, la première heure qui suit (03:00)', () => {
    expect(parisTwoAm('2026-03-29').toISOString()).toBe(
      '2026-03-29T01:00:00.000Z'
    )
  })

  it('passage à l’heure d’hiver : la première fois que Paris lit 02:00', () => {
    expect(parisTwoAm('2026-10-25').toISOString()).toBe(
      '2026-10-25T00:00:00.000Z'
    )
  })

  it('jamais avant minuit UTC du même jour (remise à zéro de Brevo)', () => {
    for (const day of [
      '2026-01-10',
      '2026-03-29',
      '2026-07-01',
      '2026-10-25',
    ]) {
      expect(parisTwoAm(day).getTime()).toBeGreaterThanOrEqual(
        Date.parse(`${day}T00:00:00Z`)
      )
    }
  })
})

describe('deferredRunAfter — un report part le lendemain à 02:00 Paris', () => {
  it('reporté le 14/11 : rejoué au plus tôt le 15/11 à 02:00 Paris', () => {
    expect(deferredRunAfter('2026-11-14').toISOString()).toBe(
      '2026-11-15T01:00:00.000Z'
    )
    expect(deferredSendOn('2026-11-14')).toBe('2026-11-15')
  })

  it('01:59 à Paris est avant l’échéance, 02:00 l’atteint', () => {
    const runAfter = deferredRunAfter('2026-11-14').getTime()
    expect(Date.parse('2026-11-15T00:59:00Z')).toBeLessThan(runAfter)
    expect(Date.parse('2026-11-15T01:00:00Z')).toBe(runAfter)
  })

  it('un report du 31/12 part le 01/01', () => {
    expect(deferredSendOn('2026-12-31')).toBe('2027-01-01')
  })
})

describe('groupPendingSends — une part = une ligne, une notification = une ligne (s52, écran 1)', () => {
  const REPORT = '33333333-3333-4333-8333-333333333333'
  const MESSAGE = '44444444-4444-4444-8444-444444444444'

  it('regroupe les destinataires d’une même notification, garde les autres à part, et ajoute les parts reportées', () => {
    const groups = groupPendingSends(
      [
        {
          id: 'd1',
          nature: 'board_notification',
          referenceType: 'incident_report',
          referenceId: REPORT,
          sendOn: '2026-11-15',
          status: 'pending',
        },
        {
          id: 'd2',
          nature: 'board_notification',
          referenceType: 'incident_report',
          referenceId: REPORT,
          sendOn: '2026-11-15',
          status: 'pending',
        },
        {
          id: 'd3',
          nature: 'board_notification',
          referenceType: 'contact_message',
          referenceId: MESSAGE,
          sendOn: '2026-11-15',
          status: 'pending',
        },
        {
          id: 'd4',
          nature: 'board_notification',
          referenceType: null,
          referenceId: null,
          sendOn: '2026-11-16',
          status: 'pending',
        },
      ],
      [
        {
          campaignId: 'c1',
          campaignSubject: 'Convocation à l’assemblée générale',
          partNumber: 3,
          partCount: 3,
          recipientCount: 40,
          sendOn: '2026-11-15',
        },
      ]
    )

    expect(groups).toEqual([
      {
        key: 'campaign:c1:3',
        nature: 'campaign',
        reference: {type: 'campaign', id: 'c1'},
        campaignSubject: 'Convocation à l’assemblée générale',
        partNumber: 3,
        partCount: 3,
        recipientCount: 40,
        sendOn: '2026-11-15',
        state: 'scheduled',
      },
      {
        key: `incident_report:${REPORT}:2026-11-15`,
        nature: 'board_notification',
        reference: {type: 'incident_report', id: REPORT},
        campaignSubject: null,
        partNumber: null,
        partCount: null,
        recipientCount: 2,
        sendOn: '2026-11-15',
        state: 'scheduled',
      },
      {
        key: `contact_message:${MESSAGE}:2026-11-15`,
        nature: 'board_notification',
        reference: {type: 'contact_message', id: MESSAGE},
        campaignSubject: null,
        partNumber: null,
        partCount: null,
        recipientCount: 1,
        sendOn: '2026-11-15',
        state: 'scheduled',
      },
      {
        key: 'd4',
        nature: 'board_notification',
        reference: null,
        campaignSubject: null,
        partNumber: null,
        partCount: null,
        recipientCount: 1,
        sendOn: '2026-11-16',
        state: 'scheduled',
      },
    ])
  })

  it('un envoi en échec forme sa propre ligne, à l’état « en échec », à part des envois programmés (revue n° 2)', () => {
    const groups = groupPendingSends(
      [
        {
          id: 'd1',
          nature: 'board_notification',
          referenceType: 'contact_message',
          referenceId: MESSAGE,
          sendOn: '2026-11-15',
          status: 'failed',
        },
        {
          id: 'd2',
          nature: 'board_notification',
          referenceType: 'contact_message',
          referenceId: MESSAGE,
          sendOn: '2026-11-15',
          status: 'pending',
        },
      ],
      []
    )

    expect(
      groups.map(({state, recipientCount}) => ({state, recipientCount}))
    ).toEqual([
      {state: 'failed', recipientCount: 1},
      {state: 'scheduled', recipientCount: 1},
    ])
  })

  it('rien en attente : aucune ligne', () => {
    expect(groupPendingSends([], [])).toEqual([])
  })
})

describe('groupPendingSends — question d’un membre (s23)', () => {
  const QUESTION = '66666666-6666-4666-8666-666666666666'

  it('désigne la question reportée, pour mener le bureau vers elle', () => {
    const [group] = groupPendingSends(
      [
        {
          id: 'd1',
          nature: 'board_notification',
          referenceType: 'member_question',
          referenceId: QUESTION,
          sendOn: '2026-11-15',
          status: 'pending',
        },
      ],
      []
    )

    expect(group.key).toBe(`member_question:${QUESTION}:2026-11-15`)
    expect(group.reference).toEqual({type: 'member_question', id: QUESTION})
  })
})

describe('nature du lien de confirmation d’une adresse (s54, ADR 056 §6)', () => {
  it('est un envoi d’association, décompté et copié pour le lendemain si le budget est épuisé', () => {
    expect(TENANT_EMAIL_NATURES).toContain('member_email_confirmation')
    expect(isNeverDeferred('member_email_confirmation')).toBe(false)
    expect(isDeferredByCaller('member_email_confirmation')).toBe(false)
  })
})
