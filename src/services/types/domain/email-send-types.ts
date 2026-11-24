/**
 * Portee d'un envoi d'email (s52, ADR 053). `sendEmailService` la recoit
 * **obligatoirement** : un appelant qui l'oublie ne compile pas. Un envoi
 * d'association decompte son budget quotidien ; un envoi de plateforme n'en
 * decompte aucun (critere 8).
 */

/**
 * Natures d'un envoi d'association. s29 et s42 y ajoutent la leur. s54 : le
 * lien de confirmation d'une adresse ajoutee ou modifiee par un membre
 * (ADR 056 §6), decompte et reporte au lendemain si le budget est epuise.
 * s42a : l'invitation d'un membre (ADR 071 §4), reportable, rejouee avec un
 * lien neuf.
 */
export const TENANT_EMAIL_NATURES = [
  'login',
  'campaign',
  'board_notification',
  'member_email_confirmation',
  'invitation',
] as const

export type TenantEmailNature = (typeof TENANT_EMAIL_NATURES)[number]

/**
 * Natures d'un envoi de plateforme (boilerplate) : securite du compte
 * (verification, mot de passe, OTP), facturation Stripe, notifications
 * internes, accueil et invitations.
 */
export const PLATFORM_EMAIL_NATURES = [
  'account_security',
  'billing',
  'platform_notification',
  'onboarding',
] as const

export type PlatformEmailNature = (typeof PLATFORM_EMAIL_NATURES)[number]

/**
 * Objet dont un email d'association parle, pour le designer au bureau sans
 * rien lire de son contenu (envois en attente).
 */
export type EmailSendReferenceType =
  | 'contact_message'
  | 'incident_report'
  | 'member_question'
  /** Un statut de facture a classer, signale une fois (s19, ADR 059 §5). */
  | 'invoice_status'

export type EmailSendReference = {type: EmailSendReferenceType; id: string}

export type EmailSendContext =
  | {
      scope: 'tenant'
      organizationId: string
      nature: TenantEmailNature
      reference?: EmailSendReference
    }
  | {scope: 'platform'; nature: PlatformEmailNature}

export type TenantEmailSendContext = Extract<
  EmailSendContext,
  {scope: 'tenant'}
>

/**
 * Issue d'un envoi : parti, reporte au jour `until` (jour de Paris), ou
 * ignore par les interrupteurs de l'application. Un report n'est pas une
 * erreur.
 */
export type EmailSendResult =
  {status: 'sent'} | {status: 'deferred'; until: string} | {status: 'skipped'}

/** Un email reporte, tel que la vue du bureau le lit : ni adresse ni contenu. */
export type PendingDeferredEmail = {
  id: string
  nature: string
  referenceType: string | null
  referenceId: string | null
  sendOn: string
  /** `failed` : refuse a chaque tentative, il ne partira plus (revue s52). */
  status: 'pending' | 'failed'
}

/** Le reste d'une part de campagne reportee faute de budget. */
export type DeferredCampaignPart = {
  campaignId: string
  campaignSubject: string
  partNumber: number
  partCount: number
  recipientCount: number
  sendOn: string
}

/** Ce dont un envoi en attente parle, pour y mener le bureau. */
export type PendingSendReference = {
  type: 'campaign' | EmailSendReferenceType
  id: string
}

/**
 * Un envoi en attente, vu du bureau (s52, ecran 1) : une part de campagne ou
 * une notification = une ligne. Liste blanche : aucune adresse, aucun
 * contenu de message ; l'objet d'une campagne seul, son titre.
 */
export type PendingSendDTO = {
  key: string
  nature: PendingSendNature
  reference: PendingSendReference | null
  campaignSubject: string | null
  partNumber: number | null
  partCount: number | null
  recipientCount: number
  /** Jour de Paris ou l'envoi partira. */
  sendOn: string
  /** Programme, ou en echec : il ne partira plus. */
  state: 'scheduled' | 'failed'
}

/** La page « Envois d'emails » du bureau (s52, ecran 1). */
export type EmailSendingOverviewDTO = {
  /** Jour de Paris du budget. */
  day: string
  limit: number
  reserve: number
  sentToday: number
  loginSentToday: number
  /** Envois reportables encore possibles aujourd'hui. */
  remainingReportable: number
  limitReached: boolean
  /** Tout le budget est consomme : la connexion n'a plus de marge. */
  reserveExhausted: boolean
  pending: PendingSendDTO[]
  pendingRecipientTotal: number
  /** Le premier jour ou des envois en attente partiront ; rien sans attente. */
  nextSendOn: string | null
}

/**
 * La nature d'un envoi en attente : toute nature reportable, la connexion
 * n'etant jamais reportee (revue s54, M2 : chaque email reporte garde la
 * sienne).
 */
export type PendingSendNature = Exclude<TenantEmailNature, 'login'>
