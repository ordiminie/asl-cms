/**
 * Types de domaine du lancement des invitations et du suivi d'adoption
 * (s42b, ADR 072). Ecrits **sans importer le modele Drizzle**
 * (`rule-architecture`). Aucun lien de connexion, aucun jeton : ils ne
 * sont jamais conserves.
 */
import type {
  CampaignDTO,
  CampaignNature,
  CampaignPlanDTO,
} from './campaign-types'

/** Lignes par page de la liste des adresses jamais connectees. */
export const MEMBER_INVITATION_ADDRESSES_PAGE_SIZE = 25

/** Le decompte du lancement, avant l'envoi (ecran 1a, 1b). */
export type MemberInvitationLaunchCountsDTO = {
  nature: CampaignNature
  /** Fiches couvertes par au moins une adresse destinataire. */
  profilesWithEmail: number
  /** Fiches sans adresse active : le courrier. */
  profilesByLetter: number
  /** Fiches dont toutes les adresses sont exclues d'un envoi facultatif. */
  profilesRefused: number
  profiles: number
  /** Adresses qui recevront l'invitation. */
  recipients: number
  /**
   * Adresses desinscrites : recues en `statutaire` (comprises dans
   * `recipients`), exclues en `facultative`.
   */
  unsubscribed: number
  /** Adresses en attente de confirmation : elles ne recoivent rien. */
  pendingAddresses: number
}

/** Le decompte de la relance (ecran 1f). */
export type MemberInvitationReminderCountsDTO = {
  nature: CampaignNature
  recipients: number
  /** Dont jamais invitees : ajoutees depuis le lancement. */
  neverInvited: number
  unsubscribed: number
  pendingAddresses: number
}

/** Une fiche citee par le suivi : lien vers la fiche, parcelles. */
export type MemberInvitationProfileRefDTO = {
  id: string
  name: string
  parcelNumbers: string[]
}

/** Une adresse jamais connectee, ou en attente (ecran 2). */
export type MemberInvitationAddressDTO = {
  email: string
  /** Toutes les fiches de l'adresse : un seul etat pour toutes (s53). */
  profiles: MemberInvitationProfileRefDTO[]
  /** En attente de confirmation : ne recoit rien. */
  pending: boolean
  /** Le dernier envoi parti, ISO ; `null` jamais invitee. */
  lastInvitedAt: string | null
  /** L'ajout de l'adresse, ISO. */
  addedAt: string
}

export type MemberInvitationAddressesPageDTO = {
  items: MemberInvitationAddressDTO[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  /** Dont en attente de confirmation. */
  pendingCount: number
}

/** Le suivi d'adoption (ecran 2) : en adresses, couverture en fiches. */
export type MemberInvitationOverviewDTO = {
  /** Adresses invitees au moins une fois, toutes origines. */
  invited: number
  /** Adresses connectees au moins une fois. */
  signedIn: number
  /** Adresses actives jamais connectees. */
  neverSignedIn: number
  /** Adresses en attente de confirmation. */
  pending: number
  coverage: {byEmail: number; byLetter: number; neither: number}
  /** Fiches dont toutes les adresses ont refuse un envoi facultatif. */
  refusedProfiles: MemberInvitationProfileRefDTO[]
  addresses: MemberInvitationAddressesPageDTO
}

/** Un envoi du systeme tel que la page le resume : lancement ou relance. */
export type MemberInvitationSendingDTO = {
  campaign: CampaignDTO
  /** Une part reste a envoyer (ni envoyee, ni en echec). */
  inProgress: boolean
}

/** La page « Invitations des membres » (ecrans 1 et 2). */
export type MemberInvitationsPageDTO = {
  launch: MemberInvitationSendingDTO | null
  reminders: MemberInvitationSendingDTO[]
  launchCounts: MemberInvitationLaunchCountsDTO
  reminderCounts: MemberInvitationReminderCountsDTO
  /** Le plan previsionnel de l'envoi a venir (lancement, sinon relance). */
  plan: CampaignPlanDTO
  /** Duree de validite d'un lien, en jours. */
  linkDays: number
  overview: MemberInvitationOverviewDTO
}

export type MemberInvitationsPageInput = {organizationId: string; page: number}

export type LaunchMemberInvitationsInput = {organizationId: string}

export type RemindNeverSignedInInput = {
  organizationId: string
  submissionId: string
}

/** Les refus communs au lancement et a la relance. */
export type MemberInvitationRefusal =
  {status: 'delivery_disabled'} | {status: 'no_site_address'}

export type LaunchMemberInvitationsResult =
  | {
      status: 'created'
      campaignId: string
      /** La livraison, a poser dans `after()` par l'action. */
      deliver: (() => Promise<void>) | null
    }
  | {
      status: 'already_launched'
      campaignId: string
      sendDate: string
      authorName: string | null
    }
  | {status: 'nobody'}
  | MemberInvitationRefusal

export type RemindNeverSignedInResult =
  | {
      status: 'created'
      campaignId: string
      deliver: (() => Promise<void>) | null
    }
  | {status: 'not_launched'}
  | {status: 'in_progress'}
  | {status: 'nobody'}
  | MemberInvitationRefusal

/** Ce que les actions rendent a la page : jamais un lien. */
export type LaunchMemberInvitationsActionResult =
  | {status: 'created'; campaignId: string}
  | {
      status: 'already_launched'
      campaignId: string
      sendDate: string
      authorName: string | null
    }
  | {status: 'nobody'}
  | {status: 'delivery_disabled'}
  | {status: 'no_site_address'}
  | {status: 'error'; message: string}

export type RemindNeverSignedInActionResult =
  | {status: 'created'; campaignId: string}
  | {status: 'not_launched'}
  | {status: 'in_progress'}
  | {status: 'nobody'}
  | {status: 'delivery_disabled'}
  | {status: 'no_site_address'}
  | {status: 'error'; message: string}
