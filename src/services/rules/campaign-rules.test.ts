import {describe, expect, it} from 'vitest'

import * as rules from './campaign-rules'
import {
  addressValuesOf,
  campaignTargetCountsOf,
  computeCampaignTarget,
  deferredDayOf,
  escapeHtml,
  finalSubject,
  findUnknownVariables,
  formatCampaignDate,
  joinParcelNumbers,
  sameAddressRowsOf,
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
  const row = (
    memberProfileId: string,
    email: string | null,
    unsubscribed = false,
    currentParcelNumbers: string[] = []
  ) => ({
    memberProfileId,
    name: memberProfileId.toUpperCase(),
    email,
    unsubscribed,
    currentParcelNumbers,
    accountName: null,
  })
  const rows = [
    row('a', 'a@x.fr'),
    row('b', null),
    row('c', 'c@x.fr', true),
    row('d', null, true),
    row('e', 'e@x.fr'),
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

  it('une adresse portée par trois fiches donne un seul destinataire, la première de l’ordre ADR 054 (s53, ADR 055)', () => {
    const target = computeCampaignTarget([
      row('sci', 'Bernard@x.fr', false, ['31']),
      row('p27', 'bernard@x.fr', false, ['27']),
      row('p12', ' bernard@X.fr ', false, ['12']),
      row('e', 'e@x.fr'),
    ])

    expect(target.recipients.map((r) => r.memberProfileId)).toEqual([
      'p12',
      'e',
    ])
    expect(target.unsubscribed).toBe(0)
    expect(target.withoutEmail).toBe(0)
  })

  it('une adresse dont une fiche est désinscrite est désinscrite en entier, comptée une fois', () => {
    const target = computeCampaignTarget([
      row('p12', 'bernard@x.fr', false, ['12']),
      row('p27', 'bernard@x.fr', true, ['27']),
      row('sci', 'bernard@x.fr', false, ['31']),
      row('b', null),
      row('n', null),
    ])

    expect(target.recipients).toEqual([])
    expect(target.unsubscribed).toBe(1)
    expect(target.withoutEmail).toBe(2)
  })
})

describe('addressValuesOf — {nom} et {parcelle} d’une adresse partagée (s53, ADR 055)', () => {
  it('une adresse à plusieurs fiches : le nom du compte et toutes les parcelles, en ordre numérique', () => {
    expect(
      addressValuesOf({
        name: 'Bernard Lefèvre',
        accountName: 'Bernard L.',
        addressProfileCount: 3,
        parcelNumbers: ['31', '12', '27'],
      })
    ).toEqual({name: 'Bernard L.', parcelNumbers: ['12', '27', '31']})
  })

  it('une adresse à une fiche : inchangé, le nom de la fiche', () => {
    expect(
      addressValuesOf({
        name: 'Lucie Moreau',
        accountName: 'Lucie M.',
        addressProfileCount: 1,
        parcelNumbers: ['21'],
      })
    ).toEqual({name: 'Lucie Moreau', parcelNumbers: ['21']})
  })

  it('sans compte relié, garde le nom de la fiche', () => {
    expect(
      addressValuesOf({
        name: 'SCI Les Pins',
        accountName: null,
        addressProfileCount: 2,
        parcelNumbers: [],
      }).name
    ).toBe('SCI Les Pins')
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
  nature: 'facultative' as const,
  targetKind: 'all_members',
  targetGroupId: null,
  targetGroupName: null,
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
        'nature',
        'targetKind',
        'targetGroupName',
        'targetGroupDeleted',
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

  it('rend la nature figée à l’envoi (s27b, ADR 064)', () => {
    expect(toCampaignDto(row(), [], []).nature).toBe('facultative')
    expect(
      toCampaignDto(row({nature: 'statutaire' as const}), [], []).nature
    ).toBe('statutaire')
  })

  it('rend le nom copié du groupe visé, et dit s’il a été supprimé depuis (s27, ADR 060 §5)', () => {
    const sent = row({
      targetKind: 'group',
      targetGroupId: '33333333-3333-4333-8333-333333333333',
      targetGroupName: 'Riverains',
    })

    expect(toCampaignDto(sent, [], [])).toMatchObject({
      targetGroupName: 'Riverains',
      targetGroupDeleted: false,
    })
    expect(toCampaignDto({...sent, targetGroupId: null}, [], [])).toMatchObject(
      {targetGroupName: 'Riverains', targetGroupDeleted: true}
    )
    expect(toCampaignDto(row(), [], [])).toMatchObject({
      targetGroupDeleted: false,
    })
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
        deferredUntil: null,
        deferredCount: 0,
      },
      {
        number: 2,
        day: '2026-11-13',
        recipientCount: 100,
        receivedCount: 98,
        toVerifyCount: 2,
        displayState: 'to_verify',
        deferredUntil: null,
        deferredCount: 0,
      },
      {
        number: 3,
        day: '2026-11-14',
        recipientCount: 96,
        receivedCount: 0,
        toVerifyCount: 0,
        displayState: 'scheduled',
        deferredUntil: null,
        deferredCount: 0,
      },
    ])
  })

  it('une part entamée dont le budget a reporté le reste : programmée pour le jour du reste, ses reportés comptés (s52, écran 3)', () => {
    const deferredParts = [
      {
        id: 'p2',
        campaignId: 'c1',
        number: 2,
        scheduledFor: '2026-11-14',
        recipientCount: 100,
        status: 'sending' as const,
        deferredTo: '2026-11-15',
      },
      {
        id: 'p3',
        campaignId: 'c1',
        number: 3,
        scheduledFor: '2026-11-16',
        recipientCount: 96,
        status: 'scheduled' as const,
        deferredTo: null,
      },
    ]
    const deferredCounts = [
      {campaignId: 'c1', partId: 'p2', status: 'sent' as const, total: 60},
      {campaignId: 'c1', partId: 'p2', status: 'pending' as const, total: 40},
      {campaignId: 'c1', partId: 'p3', status: 'pending' as const, total: 96},
    ]

    const [entamee, suivante] = toCampaignDto(
      row(),
      deferredParts,
      deferredCounts
    ).parts

    expect(entamee).toMatchObject({
      day: '2026-11-14',
      receivedCount: 60,
      displayState: 'scheduled',
      deferredUntil: '2026-11-15',
      deferredCount: 40,
    })
    expect(suivante).toMatchObject({
      displayState: 'scheduled',
      deferredUntil: null,
      deferredCount: 0,
    })
  })
})

describe('deferredDayOf — seul un report faute de budget est un report (revue s52, n° 3)', () => {
  const part = {
    status: 'sending' as const,
    scheduledFor: '2026-11-14',
    deferredTo: null,
  }

  it('une nouvelle tentative à +30 min qui passe minuit n’est pas un report', () => {
    expect(
      deferredDayOf({
        ...part,
        nextRunAfter: new Date('2026-11-14T23:20:00.000Z'),
      } as Parameters<typeof deferredDayOf>[0])
    ).toBeNull()
  })

  it('un reste reporté par le budget part le jour posé au report', () => {
    expect(deferredDayOf({...part, deferredTo: '2026-11-15'})).toBe(
      '2026-11-15'
    )
  })

  it('une part close n’a plus de report à montrer', () => {
    expect(
      deferredDayOf({...part, status: 'sent', deferredTo: '2026-11-15'})
    ).toBeNull()
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

/**
 * s54 (ADR 057) : la cible lit une ligne par (fiche, adresse active). Le
 * groupement par adresse est inchange ; chaque adresse est un destinataire,
 * et le refus est celui de l'adresse.
 */
describe('computeCampaignTarget — plusieurs adresses par fiche (s54, ADR 057)', () => {
  const row = (
    memberProfileId: string,
    email: string | null,
    unsubscribed = false
  ) => ({
    memberProfileId,
    name: `Fiche ${memberProfileId}`,
    email,
    unsubscribed,
    currentParcelNumbers: [],
    accountName: null,
  })

  it('une fiche à deux adresses actives donne deux destinataires, chacun avec son adresse (critère 3)', () => {
    const target = computeCampaignTarget([
      row('dubois', 'jean@exemple.fr'),
      row('dubois', 'claire@exemple.fr'),
    ])

    expect(target.recipients.map((recipient) => recipient.email)).toEqual([
      'jean@exemple.fr',
      'claire@exemple.fr',
    ])
    expect(target.withoutEmail).toBe(0)
  })

  it('une adresse portée par deux fiches reste un seul destinataire (s53)', () => {
    const target = computeCampaignTarget([
      row('lot-12', 'bernard@exemple.fr'),
      row('lot-27', 'Bernard@Exemple.fr'),
      row('lot-27', 'fille@exemple.fr'),
    ])

    expect(target.recipients).toHaveLength(2)
    expect(
      target.recipients.filter(
        (recipient) => recipient.email?.toLowerCase() === 'bernard@exemple.fr'
      )
    ).toHaveLength(1)
  })

  it('le proche désinscrit ne coupe pas la titulaire : elle reste servie', () => {
    const target = computeCampaignTarget([
      row('dubois', 'jean@exemple.fr'),
      row('dubois', 'claire@exemple.fr', true),
    ])

    expect(target.recipients.map((recipient) => recipient.email)).toEqual([
      'jean@exemple.fr',
    ])
    expect(target.unsubscribed).toBe(1)
  })

  it('compte en fiches celles sans adresse active, en adresses les refus', () => {
    const target = computeCampaignTarget([
      row('courrier', null),
      row('dubois', 'claire@exemple.fr', true),
      row('martin', 'claire@exemple.fr'),
    ])

    expect(target).toMatchObject({
      recipients: [],
      withoutEmail: 1,
      unsubscribed: 1,
    })
  })
})

/**
 * s27 (ADR 060 §2) : la cible se calcule sur les lignes de **toutes** les
 * fiches, groupees par adresse, puis filtree. Une adresse est retenue si une
 * de ses fiches est ciblee ; la desinscription vaut par adresse quelle que
 * soit la fiche ; la porteuse et les valeurs ne viennent que des fiches
 * ciblees.
 */
describe('computeCampaignTarget — filtre après regroupement (s27, ADR 060 §2)', () => {
  const row = (
    memberProfileId: string,
    email: string | null,
    unsubscribed = false,
    currentParcelNumbers: string[] = []
  ) => ({
    memberProfileId,
    name: `Fiche ${memberProfileId}`,
    email,
    unsubscribed,
    currentParcelNumbers,
    accountName: null,
  })
  const only =
    (...ids: string[]) =>
    (candidate: {memberProfileId: string}) =>
      ids.includes(candidate.memberProfileId)

  it('une adresse partagée dont une seule fiche est ciblée est portée par la fiche ciblée', () => {
    const target = computeCampaignTarget(
      [
        row('p12', 'bernard@x.fr', false, ['12']),
        row('p27', 'Bernard@x.fr', false, ['27']),
      ],
      only('p27')
    )

    expect(target.recipients.map((r) => r.memberProfileId)).toEqual(['p27'])
    expect(target.unsubscribed).toBe(0)
  })

  it('une adresse dont aucune fiche n’est ciblée n’est ni destinataire ni comptée', () => {
    const target = computeCampaignTarget(
      [row('a', 'a@x.fr'), row('b', 'b@x.fr', true), row('c', null)],
      only('z')
    )

    expect(target).toMatchObject({
      recipients: [],
      withoutEmail: 0,
      unsubscribed: 0,
      profilesWithEmail: 0,
    })
  })

  it('la désinscription portée par la fiche hors cible exclut l’adresse (critère 7, ADR 057)', () => {
    const target = computeCampaignTarget(
      [row('cible', 'bernard@x.fr'), row('hors-cible', 'bernard@x.fr', true)],
      only('cible')
    )

    expect(target.recipients).toEqual([])
    expect(target.unsubscribed).toBe(1)
  })

  it('compte en fiches ciblées celles avec et sans adresse active', () => {
    const target = computeCampaignTarget(
      [
        row('a', 'a1@x.fr'),
        row('a', 'a2@x.fr'),
        row('b', null),
        row('c', null),
        row('d', 'd@x.fr'),
      ],
      only('a', 'b')
    )

    expect(target.profilesWithEmail).toBe(1)
    expect(target.withoutEmail).toBe(1)
    expect(target.recipients.map((r) => r.email)).toEqual([
      'a1@x.fr',
      'a2@x.fr',
    ])
  })

  it('une fiche dont toutes les adresses sont désinscrites compte « avec adresse », ses adresses désinscrites', () => {
    const target = computeCampaignTarget([
      row('a', 'a1@x.fr', true),
      row('a', 'a2@x.fr', true),
    ])

    expect(target.profilesWithEmail).toBe(1)
    expect(target.withoutEmail).toBe(0)
    expect(target.unsubscribed).toBe(2)
    expect(target.recipients).toEqual([])
  })

  it('sans prédicat, la cible reste « tous les membres »', () => {
    const rows = [row('a', 'a@x.fr'), row('b', null), row('c', 'a@x.fr')]

    expect(computeCampaignTarget(rows)).toEqual(
      computeCampaignTarget(rows, () => true)
    )
  })
})

describe('sameAddressRowsOf — restreint aux fiches ciblées (s27, ADR 060 §2)', () => {
  const row = (memberProfileId: string, currentParcelNumbers: string[]) => ({
    memberProfileId,
    name: memberProfileId,
    email: 'bernard@x.fr',
    unsubscribed: false,
    currentParcelNumbers,
    accountName: 'Bernard',
  })
  const rows = [row('p12', ['12']), row('p27', ['27']), row('sci', ['31'])]

  it('{parcelle} ne cite que les fiches ciblées de l’adresse', () => {
    const sameAddress = sameAddressRowsOf(rows, rows[1], (candidate) =>
      ['p27', 'sci'].includes(candidate.memberProfileId)
    )

    expect(sameAddress.map((r) => r.memberProfileId)).toEqual(['p27', 'sci'])
  })

  it('sans prédicat, toutes les fiches de l’adresse', () => {
    expect(sameAddressRowsOf(rows, rows[0])).toHaveLength(3)
  })
})

describe('campaignTargetCountsOf — décompte en fiches puis en adresses (critère 5)', () => {
  it('rend fiches avec / sans adresse active, leur total, puis les adresses', () => {
    expect(
      campaignTargetCountsOf({
        recipients: [{}, {}, {}] as never,
        withoutEmail: 2,
        unsubscribed: 1,
        reinstated: 0,
        profilesWithEmail: 4,
      })
    ).toEqual({
      profilesWithEmail: 4,
      profilesWithoutEmail: 2,
      profiles: 6,
      recipients: 3,
      unsubscribed: 1,
      reinstated: 0,
      nature: 'facultative',
    })
  })

  it('rend les adresses désinscrites réintégrées d’un envoi statutaire (s27b)', () => {
    expect(
      campaignTargetCountsOf(
        {
          recipients: [{}, {}] as never,
          withoutEmail: 0,
          unsubscribed: 0,
          reinstated: 1,
          profilesWithEmail: 2,
        },
        'statutaire'
      )
    ).toMatchObject({
      recipients: 2,
      unsubscribed: 0,
      reinstated: 1,
      nature: 'statutaire',
    })
  })
})

/**
 * s27b (ADR 064) : en `statutaire`, une adresse desinscrite reste
 * destinataire, comptee `reinstated` ; en `facultative`, elle est exclue,
 * comptee `unsubscribed`. Verifie sur les trois predicats.
 */
describe('computeCampaignTarget — nature de l’envoi (s27b, critère 3)', () => {
  const row = (
    memberProfileId: string,
    email: string | null,
    unsubscribed = false
  ) => ({
    memberProfileId,
    name: `Fiche ${memberProfileId}`,
    email,
    unsubscribed,
    currentParcelNumbers: [],
    accountName: null,
  })
  const rows = [
    row('a', 'a@x.fr'),
    row('b', 'b@x.fr', true),
    row('c', 'c@x.fr', true),
    row('d', null),
  ]
  const only =
    (...ids: string[]) =>
    (candidate: {memberProfileId: string}) =>
      ids.includes(candidate.memberProfileId)
  const predicates = {
    tous: () => true,
    impayés: only('a', 'b', 'd'),
    groupe: only('b', 'd'),
  }

  it.each(Object.entries(predicates))(
    'cible « %s » : un désinscrit est exclu d’un envoi facultatif',
    (_, isTargeted) => {
      const target = computeCampaignTarget(rows, isTargeted, 'facultative')

      expect(target.recipients.map((r) => r.memberProfileId)).not.toContain('b')
      expect(target.reinstated).toBe(0)
      expect(target.unsubscribed).toBeGreaterThan(0)
    }
  )

  it.each(Object.entries(predicates))(
    'cible « %s » : un désinscrit est réintégré dans un envoi statutaire',
    (_, isTargeted) => {
      const target = computeCampaignTarget(rows, isTargeted, 'statutaire')

      expect(target.recipients.map((r) => r.memberProfileId)).toContain('b')
      expect(target.unsubscribed).toBe(0)
      expect(target.reinstated).toBeGreaterThan(0)
    }
  )

  it('les deux natures comptent les mêmes adresses, rangées différemment', () => {
    const optional = computeCampaignTarget(rows, predicates.impayés)
    const statutory = computeCampaignTarget(
      rows,
      predicates.impayés,
      'statutaire'
    )

    expect(optional).toMatchObject({unsubscribed: 1, reinstated: 0})
    expect(optional.recipients.map((r) => r.memberProfileId)).toEqual(['a'])
    expect(statutory).toMatchObject({unsubscribed: 0, reinstated: 1})
    expect(statutory.recipients.map((r) => r.memberProfileId)).toEqual([
      'a',
      'b',
    ])
    expect(statutory.withoutEmail).toBe(optional.withoutEmail)
    expect(statutory.profilesWithEmail).toBe(optional.profilesWithEmail)
  })

  it('une adresse partagée dont une fiche est désinscrite : une fois, réintégrée et portée par la fiche ciblée', () => {
    const shared = [
      row('cible', 'bernard@x.fr'),
      row('hors-cible', 'Bernard@x.fr', true),
    ]

    const statutory = computeCampaignTarget(shared, only('cible'), 'statutaire')
    expect(statutory.recipients.map((r) => r.memberProfileId)).toEqual([
      'cible',
    ])
    expect(statutory).toMatchObject({unsubscribed: 0, reinstated: 1})

    const optional = computeCampaignTarget(shared, only('cible'))
    expect(optional.recipients).toEqual([])
    expect(optional).toMatchObject({unsubscribed: 1, reinstated: 0})
  })

  it('une fiche sans adresse n’est jamais comptée désinscrite ni réintégrée', () => {
    for (const nature of ['facultative', 'statutaire'] as const) {
      const target = computeCampaignTarget([row('d', null)], undefined, nature)
      expect(target).toMatchObject({
        recipients: [],
        withoutEmail: 1,
        unsubscribed: 0,
        reinstated: 0,
      })
    }
  })

  it('sans nature, l’envoi est facultatif', () => {
    expect(computeCampaignTarget(rows)).toEqual(
      computeCampaignTarget(rows, undefined, 'facultative')
    )
  })
})
