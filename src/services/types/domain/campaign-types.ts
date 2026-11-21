/**
 * Types de domaine des campagnes email (s25, ADR 051). Ecrits **sans importer
 * le modele Drizzle** (`rule-architecture`).
 *
 * Le contenu d'une campagne et ses destinataires sont des donnees
 * personnelles : jamais dans un journal, jamais dans un `'use cache'`.
 */

/** Le mode libre, puis les quatre modeles (contenu provisoire, ADR 051). */
export const CAMPAIGN_TEMPLATE_IDS = [
  'free',
  'reminder',
  'invoice',
  'general_assembly',
  'post_assembly_documents',
] as const
export type CampaignTemplateId = (typeof CAMPAIGN_TEMPLATE_IDS)[number]

/**
 * La nature d'un type d'envoi (s27b, ADR 064) : un envoi `statutaire` atteint
 * aussi les adresses desinscrites, un envoi `facultative` ne les atteint pas.
 * Lue dans les reglages du tenant, `facultative` par defaut ; jamais saisie
 * par le bureau en redigeant.
 */
export const CAMPAIGN_NATURES = ['facultative', 'statutaire'] as const
export type CampaignNature = (typeof CAMPAIGN_NATURES)[number]
export const DEFAULT_CAMPAIGN_NATURE: CampaignNature = 'facultative'

/** Les variables reconnues, liste fermee de code : `{nom}` `{parcelle}` `{date}`. */
export const CAMPAIGN_VARIABLES = ['nom', 'parcelle', 'date'] as const
export type CampaignVariable = (typeof CAMPAIGN_VARIABLES)[number]
export type CampaignVariableValues = Record<CampaignVariable, string>

/**
 * Les cibles possibles (s25, s27, ADR 060 §1) : tous les membres, les membres
 * en impaye (calcules a l'envoi), un groupe compose par le bureau.
 */
export const CAMPAIGN_TARGET_KINDS = [
  'all_members',
  'unpaid_members',
  'group',
] as const
export type CampaignTargetKind = (typeof CAMPAIGN_TARGET_KINDS)[number]

/** La cible choisie, recue par les quatre lecteurs de la cible (ADR 060 §1). */
export type CampaignTarget =
  | {kind: 'all_members'}
  | {kind: 'unpaid_members'}
  | {kind: 'group'; groupId: string}

export const CAMPAIGN_STATUSES = ['sending', 'sent', 'interrupted'] as const
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]

export const CAMPAIGN_RECIPIENT_STATUSES = [
  'pending',
  'sending',
  'sent',
  'to_verify',
  'failed',
  'unsubscribed',
] as const
export type CampaignRecipientStatus =
  (typeof CAMPAIGN_RECIPIENT_STATUSES)[number]

/**
 * Longueur maximale de l'objet **recu**, prefixe « {association} — » compris
 * (design system §5.6). Le plafond du champ s'en deduit.
 */
export const CAMPAIGN_SUBJECT_MAX_TOTAL = 60

/** Separateur entre le nom de l'association et l'objet saisi. */
export const CAMPAIGN_SUBJECT_SEPARATOR = ' — '

/** Plafond du texte d'apercu (design system §5.6). */
export const CAMPAIGN_PREHEADER_MAX = 90

/** Plafond du corps Markdown. */
export const CAMPAIGN_BODY_MAX = 20000

/** Lignes par page de l'archive. */
export const CAMPAIGNS_PAGE_SIZE = 25

/**
 * Age au-dela duquel une ligne laissee `sending` (arret entre l'envoi et son
 * enregistrement) passe `to_verify` (ADR 052). Jamais renvoyee. **Strictement
 * inferieur** au verrou perime d'une tache (`SCHEDULED_JOB_LOCK_STALE_MS`) :
 * une ligne prise apres la pose du verrou est donc deja perimee quand la
 * tache redevient reprenable. L'ADR 052 ecrit « 15 minutes » ; le seuil est
 * abaisse pour tenir sa promesse (revue de s26, M1).
 */
export const CAMPAIGN_RECIPIENT_SENDING_STALE_MS = 5 * 60 * 1000

/**
 * Pas de la reprise d'une part en echec (ADR 052) : la tentative n repart
 * apres n x 30 minutes.
 */
export const CAMPAIGN_PART_RETRY_STEP_MS = 30 * 60 * 1000

/** Intervalle de relecture de la page d'une campagne en cours d'envoi. */
export const CAMPAIGN_PROGRESS_REFRESH_MS = 3000

/** Octets aleatoires d'un jeton de desinscription (256 bits). */
export const UNSUBSCRIBE_TOKEN_BYTES = 32

export const CAMPAIGN_PART_STATUSES = [
  'scheduled',
  'sending',
  'sent',
  'failed',
] as const
export type CampaignPartStatus = (typeof CAMPAIGN_PART_STATUSES)[number]

/**
 * L'etat d'une campagne tel que le bureau le lit (s26, ADR 052) : lu des
 * statuts et des decomptes, jamais d'une duree sans progres.
 */
export type CampaignDisplayState = 'sending' | 'sent' | 'to_verify' | 'failed'

/** L'etat d'une part : une part servie avec des lignes a verifier l'affiche. */
export type CampaignPartDisplayState =
  'scheduled' | 'sending' | 'sent' | 'to_verify' | 'failed'

/** Les destinataires d'une campagne, par statut ; la somme fait le total. */
export type CampaignRecipientCountsDTO = {
  received: number
  scheduled: number
  sending: number
  toVerify: number
  failed: number
  unsubscribed: number
}

/** Une part d'envoi telle que le bureau la lit. */
export type CampaignPartDTO = {
  number: number
  /** Jour de Paris ISO `YYYY-MM-DD`. */
  day: string
  recipientCount: number
  receivedCount: number
  toVerifyCount: number
  displayState: CampaignPartDisplayState
  /**
   * Jour de Paris ou part le reste d'une part entamee, reporte faute de
   * budget d'envoi (s52) ; rien sinon.
   */
  deferredUntil: string | null
  /** Destinataires de la part reportes a `deferredUntil`. */
  deferredCount: number
}

/**
 * Une campagne archivee telle que le bureau la lit. Liste blanche : ni
 * l'association, ni la soumission, ni le compte auteur, ni l'imitation, ni
 * aucun jeton.
 */
export type CampaignDTO = {
  id: string
  subject: string
  preheader: string | null
  /** Corps tel qu'ecrit : variables non remplacees. */
  bodyMarkdown: string
  templateId: CampaignTemplateId | null
  /** Nature figee a l'envoi (s27b, ADR 064). */
  nature: CampaignNature
  targetKind: CampaignTargetKind
  /** Nom du groupe vise, copie a l'envoi (s27, ADR 060 §5), ou rien. */
  targetGroupName: string | null
  /** Le groupe vise a ete supprime depuis l'envoi. */
  targetGroupDeleted: boolean
  recipientCount: number
  withoutEmailCount: number
  unsubscribedCount: number
  sentCount: number
  status: CampaignStatus
  displayState: CampaignDisplayState
  recipientCounts: CampaignRecipientCountsDTO
  /** Les parts, dans l'ordre ; une seule pour un envoi unique. */
  parts: CampaignPartDTO[]
  /** Jour de lancement ISO `YYYY-MM-DD` (Paris). */
  sendDate: string
  authorName: string | null
  createdAt: string
  updatedAt: string
  finishedAt: string | null
}

export type CampaignListPageDTO = {
  items: CampaignDTO[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/**
 * Le decompte de la cible, avant l'envoi (s25 critere 2 ; s27 critere 5) : en
 * fiches d'abord, avec et sans adresse active, puis en adresses.
 */
export type CampaignTargetCountsDTO = {
  profilesWithEmail: number
  profilesWithoutEmail: number
  profiles: number
  /** Adresses qui recevront la campagne. */
  recipients: number
  /** Adresses desinscrites, exclues d'un envoi facultatif. */
  unsubscribed: number
  /**
   * Adresses desinscrites qui recevront un envoi statutaire (s27b, ADR 064),
   * comprises dans `recipients`.
   */
  reinstated: number
  /** La nature du modele choisi, lue dans les reglages (s27b). */
  nature: CampaignNature
}

/** Un membre joignable, pour choisir l'apercu (« Voir avec un autre membre »). */
export type CampaignPreviewMemberDTO = {
  id: string
  name: string
}

export type CampaignComposerContextDTO = {
  associationName: string
  /** Adresse de contact des Reglages : les reponses y arrivent. */
  replyTo: string | null
  subjectMaxLength: number
  counts: CampaignTargetCountsDTO
  reachableMembers: CampaignPreviewMemberDTO[]
  /** Les groupes de l'association, choix possibles de la cible (s27). */
  groups: CampaignTargetGroupDTO[]
  /**
   * La nature de chaque modele, lue dans les reglages (s27b, ADR 064) : le
   * composeur l'ecrit sous chaque choix, sans permettre de la changer.
   */
  templateNatures: Record<CampaignTemplateId, CampaignNature>
}

/** Un groupe propose comme cible : son nom et son nombre de fiches. */
export type CampaignTargetGroupDTO = {
  id: string
  name: string
  profileCount: number
}

/** Le rendu final d'un envoi pour un destinataire reel (critere 5). */
export type CampaignPreviewDTO = {
  member: CampaignPreviewMemberDTO
  subject: string
  preheader: string | null
  html: string
  text: string
  counts: CampaignTargetCountsDTO
}

/** Une part annoncee : un jour de Paris et son nombre de destinataires. */
export type CampaignPlannedPartDTO = {day: string; count: number}

/** Le plan d'envoi annonce par l'apercu (ecran 1 de s26). */
export type CampaignPlanDTO = {
  /** Le jour de Paris de la lecture, ISO `YYYY-MM-DD`. */
  today: string
  dailySendCap: number
  /** Envois de campagne deja programmes aujourd'hui, toutes campagnes. */
  allottedToday: number
  parts: CampaignPlannedPartDTO[]
}

export type CampaignContentInput = {
  organizationId: string
  templateId: CampaignTemplateId
  subject: string
  preheader: string
  bodyMarkdown: string
}

export type PreviewCampaignInput = CampaignContentInput & {
  /** La cible choisie (s27, ADR 060 §1). */
  target: CampaignTarget
  /** La fiche de l'apercu ; absente, le premier membre joignable. */
  memberProfileId?: string
}

export type SendCampaignInput = CampaignContentInput & {
  /** La cible choisie, recalculee a la creation (s27, ADR 060 §1). */
  target: CampaignTarget
  submissionId: string
}

export type CampaignsPageInput = {organizationId: string; page: number}

/** Les filtres de la liste des destinataires (ecran 2 de s26). */
export const CAMPAIGN_RECIPIENT_FILTERS = [
  'all',
  'received',
  'scheduled',
  'to_verify',
  'failed',
] as const
export type CampaignRecipientFilter =
  (typeof CAMPAIGN_RECIPIENT_FILTERS)[number]

/** Lignes par page de la liste des destinataires. */
export const CAMPAIGN_RECIPIENTS_PAGE_SIZE = 25

export type CampaignRecipientsInput = {
  organizationId: string
  campaignId: string
  filter: CampaignRecipientFilter
  page: number
}

/** Un destinataire tel que le bureau le lit : aucun jeton. */
export type CampaignRecipientDTO = {
  id: string
  /** `null` : la fiche a ete supprimee depuis l'envoi. */
  name: string | null
  parcelNumbers: string[]
  status: CampaignRecipientStatus
  /** Instant de reception, ISO ; `null` tant que rien n'est parti. */
  sentAt: string | null
  /** Le jour de la part du destinataire, ISO `YYYY-MM-DD`. */
  scheduledFor: string
}

export type CampaignRecipientsPageDTO = {
  items: CampaignRecipientDTO[]
  filter: CampaignRecipientFilter
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type CampaignRecipientsReadResult =
  | {status: 'found'; recipients: CampaignRecipientsPageDTO}
  | {status: 'not_found'}

export type CampaignByIdInput = {organizationId: string; campaignId: string}

export type PreviewCampaignResult =
  | {status: 'ok'; preview: CampaignPreviewDTO}
  | {status: 'unknown_variables'; variables: string[]}
  | {status: 'no_recipient'}

export type SendCampaignResult =
  | {
      status: 'created'
      campaignId: string
      /**
       * La livraison, a poser dans `after()` par l'action. `null` quand la
       * soumission etait deja connue (rejeu, double clic) : la livraison de la
       * premiere soumission est deja partie, une seconde ecrirait deux fois.
       */
      deliver: (() => Promise<void>) | null
    }
  | {status: 'unknown_variables'; variables: string[]}
  | {status: 'no_recipient'}
  | {status: 'delivery_disabled'}

export type CampaignReadResult =
  {status: 'found'; campaign: CampaignDTO} | {status: 'not_found'}

/** Une demande de desinscription : association du domaine appele, jeton. */
export type UnsubscribeRequestInput = {organizationId: string; token: string}

/**
 * Etat de la page publique de desinscription (ecran 6). Un jeton valide
 * rend aussi les types d'envoi statutaires de l'association (s27b, critere
 * 5) : ce que le membre continuera de recevoir. Aucune donnee du membre.
 */
export type UnsubscribePageState =
  | {status: 'confirm'; statutoryTemplateIds: CampaignTemplateId[]}
  | {status: 'already'; statutoryTemplateIds: CampaignTemplateId[]}
  | {status: 'invalid'}

export type ConfirmUnsubscribeResult =
  {status: 'unsubscribed'} | {status: 'already'} | {status: 'invalid'}

/** Le refus d'une fiche, tel que la fiche du bureau le montre (ecran 5). */
export type MemberUnsubscribeDTO = {
  /** Instant du refus, ISO. */
  createdAt: string
}

/** Les champs du composeur (ecran 2). */
export type CampaignFormField =
  'templateId' | 'subject' | 'preheader' | 'bodyMarkdown'

export type CampaignFormError = {field: CampaignFormField; message: string}

/** Ce que l'action « Voir l'apercu » rend au composeur ; la saisie reste. */
export type PreviewCampaignActionResult =
  | {status: 'ok'; preview: CampaignPreviewDTO; plan: CampaignPlanDTO}
  | {status: 'invalid'; errors: CampaignFormError[]}
  | {status: 'unknown_variables'; variables: string[]}
  | {status: 'no_recipient'}
  | {status: 'error'; message: string}

/** Ce que l'action « Envoyer » rend a l'apercu ; la saisie reste. */
export type SendCampaignActionResult =
  | {status: 'created'; campaignId: string}
  | {status: 'invalid'; errors: CampaignFormError[]}
  | {status: 'unknown_variables'; variables: string[]}
  | {status: 'no_recipient'}
  | {status: 'delivery_disabled'}
  | {status: 'error'; message: string}

/** Le decompte relu quand le bureau change de cible (s27, critere 5). */
export type CampaignTargetActionResult =
  | {
      status: 'ok'
      counts: CampaignTargetCountsDTO
      reachableMembers: CampaignPreviewMemberDTO[]
    }
  | {status: 'error'; message: string}

/** Ce que la page publique recoit apres « Me desinscrire » : aucun detail. */
export type ConfirmUnsubscribeActionResult =
  | {status: 'unsubscribed'}
  | {status: 'already'}
  | {status: 'invalid'}
  | {status: 'error'}

/**
 * Le regroupement des lettres d'homonymes (s28, critere 2, ADR 067 §5) :
 * choisi par le bureau a la generation, jamais enregistre ni preselectionne.
 */
export const CAMPAIGN_LETTER_GROUPINGS = ['per_person', 'per_land'] as const
export type CampaignLetterGrouping = (typeof CAMPAIGN_LETTER_GROUPINGS)[number]

/** D'ou vient le bloc adresse d'une lettre (ADR 067 §1). */
export type CampaignLetterAddressSource = 'home' | 'land' | 'name_only'

/** Une fiche citee par la carte du courrier : lien vers la fiche, parcelles. */
export type CampaignLetterProfileRefDTO = {
  id: string
  name: string
  parcelNumbers: string[]
}

/** Des fiches de meme nom et meme domicile, signalees avant la generation. */
export type CampaignLetterHomonymGroupDTO = {
  name: string
  /** Le domicile en clair, « ligne, code postal ville ». */
  homeAddress: string
  profileCount: number
  parcelNumbers: string[]
}

/** Ce que la carte « Courrier postal » montre avant la generation (s28). */
export type CampaignLetterContextDTO = {
  /** Jour d'envoi de la campagne, date portee sur les lettres. */
  sendDate: string
  withoutEmailCount: number
  /** Dont sans domicile : adressees au terrain ou au nom seul (ADR 067 §1). */
  withoutHomeCount: number
  homonymGroups: CampaignLetterHomonymGroupDTO[]
  landAddressed: CampaignLetterProfileRefDTO[]
  nameOnly: CampaignLetterProfileRefDTO[]
  /**
   * Adresses qui ne tiennent pas dans le cadre de 90 mm, meme reduites a
   * 10 pt et coupees apres une virgule (§6.1) : a raccourcir sur la fiche.
   */
  addressTooWide: CampaignLetterProfileRefDTO[]
}

/**
 * Le courrier d'une campagne : introuvable, anterieure a s28 (ADR 065 §4),
 * sans fiche sans email (critere 5), ou pret.
 */
export type CampaignLetterUnavailableStatus = 'not_found' | 'legacy' | 'none'

export type CampaignLetterContextResult =
  | {status: CampaignLetterUnavailableStatus}
  | {status: 'ready'; context: CampaignLetterContextDTO}

export type CampaignLettersPdfResult =
  | {status: CampaignLetterUnavailableStatus}
  /** Des homonymes existent et le bureau n'a pas choisi (critere 2). */
  | {status: 'grouping_required'}
  /**
   * Le lot : chaque lettre commence sur une nouvelle page, une lettre longue
   * continue sur des pages de suite (§6.1), d'ou `pageCount >= letterCount`.
   */
  | {
      status: 'ready'
      pdf: Uint8Array
      sendDate: string
      letterCount: number
      pageCount: number
    }

/**
 * Plage maximale, en jours inclusifs, d'une lecture des statistiques chez le
 * fournisseur (s30, ADR 068 §6) : 89, marge sur la limite de 90 de Brevo et
 * sur son fuseau.
 */
export const CAMPAIGN_STATISTICS_WINDOW_DAYS = 89

/** Pourquoi des statistiques ne sont pas disponibles (s30, ADR 068 §5). */
export type CampaignStatisticsUnavailableReason =
  'unreachable' | 'untracked' | 'expired'

/**
 * Les statistiques d'une campagne telles que le bureau les lit (s30, ADR
 * 068). **Un chiffre n'existe que dans `available`** : aucun autre etat n'en
 * porte, pour ne jamais afficher un zero qui n'est pas mesure (critere 3).
 * Ouvertures et clics en personnes uniques, taux arrondis sur les envois.
 */
export type CampaignStatisticsDTO =
  | {
      state: 'available'
      sentCount: number
      uniqueOpens: number
      uniqueClicks: number
      openRate: number
      clickRate: number
      /** Instant du releve, ISO. */
      readAt: string
      /** Le releve conserve, faute de lecture possible. */
      fromSnapshot: boolean
    }
  | {state: 'pending_sending'; lastSendDay: string}
  | {state: 'pending_provider'}
  | {state: 'unavailable'; reason: CampaignStatisticsUnavailableReason}
  | {state: 'nothing_sent'}

export type CampaignStatisticsReadResult =
  {status: 'found'; statistics: CampaignStatisticsDTO} | {status: 'not_found'}
