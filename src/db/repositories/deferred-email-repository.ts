import {and, asc, eq, inArray, sql} from 'drizzle-orm'

import {
  AddDeferredEmailModel,
  deferredEmail,
  DeferredEmailModel,
} from '@/db/models/deferred-email-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Emails reportes (s52, ADR 053 §4). Sous RLS forcee : a appeler dans
 * `withTenant(organizationId, ...)`, sans quoi rien ne se lit ni ne s'ecrit.
 */

export type CreateDeferredEmailInput = Omit<
  AddDeferredEmailModel,
  'id' | 'status' | 'attempts' | 'createdAt' | 'updatedAt'
>

/** Un email en attente ou en echec, vu du bureau : ni adresse ni contenu. */
export type PendingDeferredEmailRow = Pick<
  DeferredEmailModel,
  'id' | 'nature' | 'referenceType' | 'referenceId' | 'sendOn'
> & {status: 'pending' | 'failed'}

/** Conserve un email reporte, en attente. */
export const createDeferredEmailTxnDao = async (
  input: CreateDeferredEmailInput
): Promise<{id: string}> => {
  const [row] = await getDb()
    .insert(deferredEmail)
    .values(input)
    .returning({id: deferredEmail.id})
  return row
}

/**
 * Prend un email en attente pour l'envoyer (`pending → sending`), en une
 * instruction : deux rejeux simultanes ne le prennent pas tous les deux.
 * Deja pris, a verifier ou absent : rien.
 */
export const claimDeferredEmailForSendTxnDao = async (
  id: string
): Promise<DeferredEmailModel | undefined> => {
  const [row] = await getDb()
    .update(deferredEmail)
    .set({status: 'sending', updatedAt: sql`now()`})
    .where(and(eq(deferredEmail.id, id), eq(deferredEmail.status, 'pending')))
    .returning()
  return row
}

/** L'email est parti : la ligne et son contenu sont supprimes (critere 7). */
export const deleteDeferredEmailTxnDao = async (id: string): Promise<void> => {
  await getDb().delete(deferredEmail).where(eq(deferredEmail.id, id))
}

/**
 * Issue inconnue ou arret apres la prise : a verifier, jamais renvoye. Le
 * hash d'un lien de confirmation n'y sert plus et part (revue s54, mi-b).
 */
export const markDeferredEmailToVerifyTxnDao = async (
  id: string
): Promise<void> => {
  await getDb()
    .update(deferredEmail)
    .set({
      status: 'to_verify',
      confirmationTokenHash: null,
      updatedAt: sql`now()`,
    })
    .where(and(eq(deferredEmail.id, id), eq(deferredEmail.status, 'sending')))
}

/**
 * Rend un email pris en attente, pour le jour `sendOn`. `countAttempt` : un
 * refus certain du fournisseur compte une tentative ; un nouveau report faute
 * de budget n'en compte aucune.
 */
export const releaseDeferredEmailTxnDao = async ({
  id,
  sendOn,
  countAttempt,
}: {
  id: string
  sendOn: string
  countAttempt: boolean
}): Promise<void> => {
  await getDb()
    .update(deferredEmail)
    .set({
      status: 'pending',
      sendOn,
      updatedAt: sql`now()`,
      ...(countAttempt ? {attempts: sql`${deferredEmail.attempts} + 1`} : {}),
    })
    .where(and(eq(deferredEmail.id, id), eq(deferredEmail.status, 'sending')))
}

const BUREAU_VISIBLE_STATUSES: PendingDeferredEmailRow['status'][] = [
  'pending',
  'failed',
]

/**
 * Les emails en attente ou en echec de l'association, sans adresse ni
 * contenu.
 */
export const listPendingDeferredEmailsDao = async (
  organizationId: string
): Promise<PendingDeferredEmailRow[]> => {
  const rows = await getDb()
    .select({
      id: deferredEmail.id,
      nature: deferredEmail.nature,
      referenceType: deferredEmail.referenceType,
      referenceId: deferredEmail.referenceId,
      sendOn: deferredEmail.sendOn,
      status: deferredEmail.status,
    })
    .from(deferredEmail)
    .where(
      and(
        eq(deferredEmail.organizationId, organizationId),
        inArray(deferredEmail.status, BUREAU_VISIBLE_STATUSES)
      )
    )
    .orderBy(asc(deferredEmail.sendOn), asc(deferredEmail.createdAt))
  return rows.map((row) => ({
    ...row,
    status: row.status === 'failed' ? 'failed' : 'pending',
  }))
}

/**
 * Tentatives epuisees : la ligne prise passe `failed`, jamais renvoyee. Son
 * adresse et son contenu sont effaces dans la meme instruction (critere 7) :
 * le bureau ne garde que la nature, la reference et le jour.
 */
export const markDeferredEmailFailedTxnDao = async (
  id: string
): Promise<void> => {
  await getDb()
    .update(deferredEmail)
    .set({
      status: 'failed',
      recipient: '',
      subject: '',
      textBody: '',
      htmlBody: null,
      headers: null,
      replyTo: null,
      senderName: null,
      confirmationTokenHash: null,
      updatedAt: sql`now()`,
    })
    .where(and(eq(deferredEmail.id, id), eq(deferredEmail.status, 'sending')))
}

/**
 * Le lien de confirmation d'un email pris a recu un jeton neuf (s54, revue
 * MA2) : la ligne garde le hash courant, pour qu'une nouvelle tentative apres
 * un refus retrouve les attentes du lien. Rend `false` si la ligne n'etait
 * plus en cours d'envoi, ou absente : rien n'est ecrit (revue round 4, mi-r4).
 */
export const updateDeferredEmailConfirmationTokenHashTxnDao = async (
  id: string,
  confirmationTokenHash: string
): Promise<boolean> => {
  const [row] = await getDb()
    .update(deferredEmail)
    .set({confirmationTokenHash, updatedAt: sql`now()`})
    .where(and(eq(deferredEmail.id, id), eq(deferredEmail.status, 'sending')))
    .returning({id: deferredEmail.id})
  return row !== undefined
}
