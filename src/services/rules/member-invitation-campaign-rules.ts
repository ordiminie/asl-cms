import {v5 as uuidv5} from 'uuid'

import {
  type CampaignNature,
  MEMBER_INVITATION_LAUNCH_SEND_KIND,
} from '../types/domain/campaign-types'
import type {MemberEmailStatus} from '../types/domain/member-email-types'
import {
  MEMBER_INVITATION_ADDRESSES_PAGE_SIZE,
  type MemberInvitationAddressDTO,
  type MemberInvitationLaunchCountsDTO,
  type MemberInvitationOverviewDTO,
  type MemberInvitationProfileRefDTO,
  type MemberInvitationReminderCountsDTO,
} from '../types/domain/member-invitation-campaign-types'
import {campaignChannelsOf} from './campaign-letter-rules'
import {
  type CampaignTargetPredicate,
  type CampaignTargetRow,
  computeCampaignTarget,
} from './campaign-rules'

/**
 * Regles pures du lancement des invitations, de sa relance et du suivi
 * d'adoption (s42b, ADR 072). Aucun acces a la base, aucune horloge : le
 * service passe l'instant courant. Une adresse se compare sans casse ni
 * espaces (s53).
 */

/** Une adresse et les traces de son compte sur l'association (s42a). */
export type InvitationAddressState = {
  email: string
  userId: string
  lastInvitedAt: Date | null
  firstSignedInAt: Date | null
}

/** Les traces par adresse, cle sans casse. */
export type InvitationStates = ReadonlyMap<string, InvitationAddressState>

/**
 * Une adresse de fiche telle que le suivi la lit. Une adresse desactivee par
 * l'import (s56, ADR 076) en est ecartee.
 */
export type InvitationAddressRow = {
  email: string
  status: MemberEmailStatus
  createdAt: Date
  expiresAt: Date | null
  memberProfileId: string
  name: string
  parcelNumbers: string[]
}

export const invitationEmailKeyOf = (email: string): string =>
  email.trim().toLowerCase()

export const invitationStatesOf = (
  rows: readonly InvitationAddressState[]
): InvitationStates =>
  new Map(rows.map((row) => [invitationEmailKeyOf(row.email), row]))

/** Espace de noms des soumissions du lancement (uuid v5, ADR 072 §2). */
const LAUNCH_SUBMISSION_NAMESPACE = 'b7e0c5a2-4f6d-4c1e-9a3b-42b1a7d0e8f3'

/**
 * La soumission du lancement, deterministe : uuid v5 de l'association et du
 * type (ADR 072 §2). Un second lancement retrouve la campagne existante.
 */
export const launchSubmissionIdOf = (organizationId: string): string =>
  uuidv5(
    `${organizationId}:${MEMBER_INVITATION_LAUNCH_SEND_KIND}`,
    LAUNCH_SUBMISSION_NAMESPACE
  )

/** Le lancement vise toutes les fiches (critere 1). */
export const launchPredicate: CampaignTargetPredicate = () => true

/**
 * La relance (critere 8) : une adresse dont le compte ne s'est jamais
 * connecte ; une adresse sans compte compte comme jamais connectee. Jamais
 * une ligne sans adresse : la relance n'a pas de courrier (Q10).
 */
export const reminderPredicateOf =
  (states: InvitationStates): CampaignTargetPredicate =>
  (row) =>
    row.email !== null &&
    !states.get(invitationEmailKeyOf(row.email))?.firstSignedInAt

/**
 * L'ecart d'une ligne a sa livraison (ADR 072 §5) : l'adresse s'est
 * connectee, ou une invitation lui est partie apres la creation de la
 * campagne.
 */
export const invitationSkipOf = (
  state: InvitationAddressState | undefined,
  campaignCreatedAt: Date
): 'superseded' | null => {
  if (!state) return null
  if (state.firstSignedInAt) return 'superseded'
  if (
    state.lastInvitedAt &&
    state.lastInvitedAt.getTime() > campaignCreatedAt.getTime()
  ) {
    return 'superseded'
  }
  return null
}

const isVisible = (address: InvitationAddressRow, now: Date): boolean =>
  address.status === 'active' ||
  (address.status === 'pending' &&
    (address.expiresAt === null || address.expiresAt.getTime() > now.getTime()))

type AddressGroup = {
  key: string
  rows: InvitationAddressRow[]
  active: boolean
}

/** Les adresses visibles, une par adresse : active si une de ses lignes l'est. */
const addressGroupsOf = (
  addresses: readonly InvitationAddressRow[],
  now: Date
): AddressGroup[] => {
  const groups = new Map<string, InvitationAddressRow[]>()
  for (const address of addresses) {
    if (!isVisible(address, now)) continue
    const key = invitationEmailKeyOf(address.email)
    groups.set(key, [...(groups.get(key) ?? []), address])
  }
  return [...groups.entries()].map(([key, rows]) => ({
    key,
    rows,
    active: rows.some((row) => row.status === 'active'),
  }))
}

const pendingAddressCountOf = (
  addresses: readonly InvitationAddressRow[],
  now: Date
): number => addressGroupsOf(addresses, now).filter((g) => !g.active).length

/** Le decompte de l'ecran 1a : en fiches, puis en adresses. */
export const launchCountsOf = ({
  rows,
  nature,
  addresses,
  now,
}: {
  rows: readonly CampaignTargetRow[]
  nature: CampaignNature
  addresses: readonly InvitationAddressRow[]
  now: Date
}): MemberInvitationLaunchCountsDTO => {
  const target = computeCampaignTarget(rows, launchPredicate, nature)
  const channels = campaignChannelsOf(rows, launchPredicate, nature, target)
  return {
    nature,
    profilesWithEmail: channels.emailProfileIds.length,
    profilesByLetter: channels.letterProfileIds.length,
    profilesRefused: channels.refusedProfileIds.length,
    profiles: new Set(rows.map((row) => row.memberProfileId)).size,
    recipients: target.recipients.length,
    unsubscribed:
      nature === 'statutaire' ? target.reinstated : target.unsubscribed,
    pendingAddresses: pendingAddressCountOf(addresses, now),
  }
}

/** Le decompte de l'ecran 1f. */
export const reminderCountsOf = ({
  rows,
  states,
  nature,
  addresses,
  now,
}: {
  rows: readonly CampaignTargetRow[]
  states: InvitationStates
  nature: CampaignNature
  addresses: readonly InvitationAddressRow[]
  now: Date
}): MemberInvitationReminderCountsDTO => {
  const target = computeCampaignTarget(
    rows,
    reminderPredicateOf(states),
    nature
  )
  return {
    nature,
    recipients: target.recipients.length,
    neverInvited: target.recipients.filter(
      (recipient) =>
        !states.get(invitationEmailKeyOf(recipient.email))?.lastInvitedAt
    ).length,
    unsubscribed:
      nature === 'statutaire' ? target.reinstated : target.unsubscribed,
    pendingAddresses: pendingAddressCountOf(addresses, now),
  }
}

const byName = (a: {name: string}, b: {name: string}): number =>
  a.name.localeCompare(b.name, 'fr')

const profilesOf = (
  rows: readonly InvitationAddressRow[]
): MemberInvitationProfileRefDTO[] => {
  const seen = new Map<string, MemberInvitationProfileRefDTO>()
  for (const row of rows) {
    if (!seen.has(row.memberProfileId)) {
      seen.set(row.memberProfileId, {
        id: row.memberProfileId,
        name: row.name,
        parcelNumbers: row.parcelNumbers,
      })
    }
  }
  return [...seen.values()].sort(byName)
}

const addressLineOf = (
  group: AddressGroup,
  state: InvitationAddressState | undefined
): MemberInvitationAddressDTO => ({
  email: group.key,
  profiles: profilesOf(group.rows),
  pending: !group.active,
  lastInvitedAt: state?.lastInvitedAt?.toISOString() ?? null,
  addedAt: new Date(
    Math.min(...group.rows.map((row) => row.createdAt.getTime()))
  ).toISOString(),
})

/** Les fiches refusees, nommees depuis la cible. */
const refusedProfilesOf = (
  rows: readonly CampaignTargetRow[],
  ids: readonly string[]
): MemberInvitationProfileRefDTO[] =>
  ids
    .map((id) => rows.find((row) => row.memberProfileId === id))
    .filter((row): row is CampaignTargetRow => row !== undefined)
    .map((row) => ({
      id: row.memberProfileId,
      name: row.name,
      parcelNumbers: [...row.currentParcelNumbers],
    }))
    .sort(byName)

/**
 * Le suivi d'adoption (critere 7) : compteurs en adresses, une ligne par
 * adresse jamais connectee ou en attente, toutes ses fiches, un seul etat ;
 * triee par nom de fiche, paginee. La couverture se compte en fiches, sous la
 * nature du lancement.
 */
export const invitationOverviewOf = ({
  addresses,
  states,
  rows,
  nature,
  now,
  page,
}: {
  addresses: readonly InvitationAddressRow[]
  states: InvitationStates
  rows: readonly CampaignTargetRow[]
  nature: CampaignNature
  now: Date
  page: number
}): MemberInvitationOverviewDTO => {
  const groups = addressGroupsOf(addresses, now)
  const stateOf = (group: AddressGroup) => states.get(group.key)
  const neverSignedIn = groups.filter(
    (group) => group.active && !stateOf(group)?.firstSignedInAt
  )
  const pending = groups.filter((group) => !group.active)
  const lines = [...neverSignedIn, ...pending]
    .map((group) => addressLineOf(group, stateOf(group)))
    .sort(
      (a, b) =>
        byName(a.profiles[0], b.profiles[0]) || a.email.localeCompare(b.email)
    )
  const totalPages = Math.max(
    1,
    Math.ceil(lines.length / MEMBER_INVITATION_ADDRESSES_PAGE_SIZE)
  )
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), totalPages)
  const start = (current - 1) * MEMBER_INVITATION_ADDRESSES_PAGE_SIZE
  const channels = campaignChannelsOf(rows, launchPredicate, nature)

  return {
    invited: groups.filter((group) => stateOf(group)?.lastInvitedAt).length,
    signedIn: groups.filter((group) => stateOf(group)?.firstSignedInAt).length,
    neverSignedIn: neverSignedIn.length,
    pending: pending.length,
    coverage: {
      byEmail: channels.emailProfileIds.length,
      byLetter: channels.letterProfileIds.length,
      neither: channels.refusedProfileIds.length,
    },
    refusedProfiles: refusedProfilesOf(rows, channels.refusedProfileIds),
    addresses: {
      items: lines.slice(start, start + MEMBER_INVITATION_ADDRESSES_PAGE_SIZE),
      page: current,
      pageSize: MEMBER_INVITATION_ADDRESSES_PAGE_SIZE,
      total: lines.length,
      totalPages,
      pendingCount: pending.length,
    },
  }
}
