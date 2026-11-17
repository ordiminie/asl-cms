import {drizzle} from 'drizzle-orm/pg-proxy'
import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * Emails reportes (s52, ADR 053 §4). Client Drizzle `pg-proxy` : chaque
 * requete est rendue au test telle qu'elle partirait vers Postgres. La RLS se
 * prouve en e2e.
 */
const {sent, responses} = vi.hoisted(() => ({
  sent: [] as {sql: string; params: unknown[]}[],
  responses: {current: [] as unknown[][]},
}))

vi.mock('@/db/tenant-scope', () => ({
  getDb: () =>
    drizzle(async (sql, params) => {
      sent.push({sql, params})
      return {rows: responses.current.shift() ?? []}
    }),
}))

import {
  claimDeferredEmailForSendTxnDao,
  createDeferredEmailTxnDao,
  deleteDeferredEmailTxnDao,
  listPendingDeferredEmailsDao,
  markDeferredEmailFailedTxnDao,
  markDeferredEmailToVerifyTxnDao,
  releaseDeferredEmailTxnDao,
  updateDeferredEmailConfirmationTokenHashTxnDao,
} from './deferred-email-repository'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const EMAIL_ID = '22222222-2222-4222-8222-222222222222'
const REFERENCE_ID = '33333333-3333-4333-8333-333333333333'
const NOW = new Date('2026-11-14T15:00:00.000Z')

const CONTENT_COLUMNS = [
  'recipient',
  'subject',
  'text_body',
  'html_body',
  'headers',
  'reply_to',
  'sender_name',
  'confirmation_token_hash',
]

/** Une ligne `deferred_email` dans l'ordre des colonnes du modele. */
const deferredRow = (status = 'sending') => [
  EMAIL_ID,
  ORG_ID,
  'board_notification',
  'bureau@asl.test',
  'Nouveau message',
  'Texte',
  '<p>HTML</p>',
  null,
  'visiteur@asl.test',
  'ASL Les Pins',
  '2026-11-15',
  status,
  0,
  'contact_message',
  REFERENCE_ID,
  null,
  NOW.toISOString(),
  NOW.toISOString(),
]

beforeEach(() => {
  sent.length = 0
  responses.current = []
})

describe('createDeferredEmailTxnDao — le message rendu est conservé', () => {
  it('insère la ligne en attente et rend son identifiant', async () => {
    responses.current = [[[EMAIL_ID]]]

    const created = await createDeferredEmailTxnDao({
      organizationId: ORG_ID,
      nature: 'board_notification',
      recipient: 'bureau@asl.test',
      subject: 'Nouveau message',
      textBody: 'Texte',
      htmlBody: '<p>HTML</p>',
      headers: null,
      replyTo: 'visiteur@asl.test',
      senderName: 'ASL Les Pins',
      sendOn: '2026-11-15',
      referenceType: 'contact_message',
      referenceId: REFERENCE_ID,
    })

    const [{sql, params}] = sent
    expect(sql).toMatch(/^insert into "deferred_email"/)
    expect(params).toEqual(
      expect.arrayContaining([ORG_ID, 'board_notification', '2026-11-15'])
    )
    expect(created).toEqual({id: EMAIL_ID})
  })
})

describe('claimDeferredEmailForSendTxnDao — pending → sending, atomique', () => {
  it('ne prend que la ligne en attente, et la rend', async () => {
    responses.current = [[deferredRow()]]

    const claimed = await claimDeferredEmailForSendTxnDao(EMAIL_ID)

    const [{sql, params}] = sent
    expect(sql).toMatch(/^update "deferred_email" set "status" = \$1/)
    expect(sql).toMatch(/"deferred_email"\."status" = \$\d+/)
    expect(params).toEqual(
      expect.arrayContaining(['sending', EMAIL_ID, 'pending'])
    )
    expect(claimed).toMatchObject({
      id: EMAIL_ID,
      recipient: 'bureau@asl.test',
      htmlBody: '<p>HTML</p>',
      status: 'sending',
    })
  })

  it('déjà prise ou absente : rien', async () => {
    responses.current = [[]]

    await expect(claimDeferredEmailForSendTxnDao(EMAIL_ID)).resolves.toBe(
      undefined
    )
  })
})

describe('après la prise — purge, à vérifier, rendue', () => {
  it('deleteDeferredEmailTxnDao supprime la ligne une fois partie (critère 7)', async () => {
    await deleteDeferredEmailTxnDao(EMAIL_ID)

    expect(sent[0].sql).toMatch(/^delete from "deferred_email" where/)
    expect(sent[0].params).toEqual([EMAIL_ID])
  })

  it('markDeferredEmailToVerifyTxnDao : sending → to_verify seulement', async () => {
    await markDeferredEmailToVerifyTxnDao(EMAIL_ID)

    const [{sql, params}] = sent
    expect(sql).toMatch(/^update "deferred_email" set "status" = \$1/)
    expect(params).toEqual(
      expect.arrayContaining(['to_verify', EMAIL_ID, 'sending'])
    )
  })

  it('markDeferredEmailToVerifyTxnDao efface aussi le hash du lien de confirmation (revue s54, mi-b)', async () => {
    await markDeferredEmailToVerifyTxnDao(EMAIL_ID)

    const [{sql, params}] = sent
    expect(sql).toMatch(/"confirmation_token_hash" = \$\d+/)
    expect(params).toContain(null)
  })

  it('releaseDeferredEmailTxnDao : rendue en attente pour un autre jour, sans tentative comptée', async () => {
    await releaseDeferredEmailTxnDao({
      id: EMAIL_ID,
      sendOn: '2026-11-16',
      countAttempt: false,
    })

    const [{sql, params}] = sent
    expect(sql).toMatch(/^update "deferred_email" set /)
    expect(sql).toMatch(/"status" = \$\d+/)
    expect(sql).not.toContain('"attempts" + 1')
    expect(params).toEqual(
      expect.arrayContaining(['pending', '2026-11-16', EMAIL_ID, 'sending'])
    )
  })

  it('releaseDeferredEmailTxnDao : un refus du fournisseur compte une tentative', async () => {
    await releaseDeferredEmailTxnDao({
      id: EMAIL_ID,
      sendOn: '2026-11-15',
      countAttempt: true,
    })

    expect(sent[0].sql).toContain('"attempts" + 1')
  })
})

describe('listPendingDeferredEmailsDao — ce que le bureau voit (critère 4, 7)', () => {
  it('ne sélectionne jamais l’adresse ni le contenu du message, et rend l’état de chaque envoi', async () => {
    responses.current = [
      [
        [
          EMAIL_ID,
          'board_notification',
          'contact_message',
          REFERENCE_ID,
          '2026-11-15',
          'failed',
        ],
      ],
    ]

    const rows = await listPendingDeferredEmailsDao(ORG_ID)

    const [{sql, params}] = sent
    expect(sql).toMatch(
      /^select "id", "nature", "reference_type", "reference_id", "send_on", "status" from "deferred_email"/
    )
    for (const column of CONTENT_COLUMNS) {
      expect(sql).not.toContain(`"${column}"`)
    }
    expect(params).toEqual(
      expect.arrayContaining([ORG_ID, 'pending', 'failed'])
    )
    expect(rows).toEqual([
      {
        id: EMAIL_ID,
        nature: 'board_notification',
        referenceType: 'contact_message',
        referenceId: REFERENCE_ID,
        sendOn: '2026-11-15',
        status: 'failed',
      },
    ])
  })
})

describe('markDeferredEmailFailedTxnDao — tentatives épuisées (revue s52, n° 2)', () => {
  it('sending → failed seulement, et efface l’adresse et le contenu du message (critère 7)', async () => {
    await markDeferredEmailFailedTxnDao(EMAIL_ID)

    const [{sql, params}] = sent
    expect(sql).toMatch(/^update "deferred_email" set /)
    expect(sql).toMatch(/"deferred_email"\."status" = \$\d+\)$/)
    for (const column of CONTENT_COLUMNS) {
      expect(sql).toContain(`"${column}" = `)
    }
    expect(params).toEqual(
      expect.arrayContaining(['failed', EMAIL_ID, 'sending'])
    )
    expect(params).not.toContain('bureau@asl.test')
  })
})

describe('updateDeferredEmailConfirmationTokenHashTxnDao — le lien reporté suit son jeton neuf (revue s54, MA2)', () => {
  it('écrit le hash neuf sur la ligne prise, sending seulement', async () => {
    const NEW_HASH = 'c'.repeat(64)
    await updateDeferredEmailConfirmationTokenHashTxnDao(EMAIL_ID, NEW_HASH)

    const [{sql, params}] = sent
    expect(sql).toMatch(
      /^update "deferred_email" set "confirmation_token_hash" = \$1/
    )
    expect(sql).toMatch(/"deferred_email"\."status" = \$\d+\)/)
    expect(params).toEqual(
      expect.arrayContaining([NEW_HASH, EMAIL_ID, 'sending'])
    )
  })

  it('dit si la ligne a été écrite : prise, oui ; plus en cours d’envoi ou absente, non (revue s54 round 4, mi-r4)', async () => {
    const NEW_HASH = 'c'.repeat(64)
    responses.current = [[[EMAIL_ID]], []]

    await expect(
      updateDeferredEmailConfirmationTokenHashTxnDao(EMAIL_ID, NEW_HASH)
    ).resolves.toBe(true)
    await expect(
      updateDeferredEmailConfirmationTokenHashTxnDao(EMAIL_ID, NEW_HASH)
    ).resolves.toBe(false)
    expect(sent[0].sql).toMatch(/returning "id"$/)
  })
})
