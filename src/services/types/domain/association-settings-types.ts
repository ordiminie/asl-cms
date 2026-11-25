import {z} from 'zod'

import {
  CAMPAIGN_BODY_MAX,
  CAMPAIGN_NATURES,
  CAMPAIGN_SEND_KINDS,
  CAMPAIGN_SUBJECT_MAX_TOTAL,
  CampaignNature,
  CampaignSendKind,
  DEFAULT_CAMPAIGN_NATURE,
} from './campaign-types'
import {SEO_DESCRIPTION_MAX} from './seo-types'

/**
 * Parametres d'une association (ADR 010, ADR 016).
 *
 * La **definition** d'un parametre vit ici, dans un registre type ; la table
 * `organization_setting` ne stocke que des valeurs. Absence de ligne = valeur
 * par defaut du registre. Module isomorphe : les regles pures servent au
 * service, au DAL et au formulaire, sans aucune dependance serveur.
 *
 * Aucune valeur propre a une association dans ce fichier : un defaut est une
 * constante neutre ou une reference a une autre cle.
 */

/** Page du back-office qui affiche le parametre. */
export type AssociationSettingPage = 'settings' | 'identity'

/**
 * Carte de la page « Reglages » qui regroupe le parametre. Absente : la carte
 * d'origine, celle des adresses de notification.
 */
export type AssociationSettingSection =
  | 'seo'
  | 'legal'
  | 'sending'
  | 'campaign_nature'
  | 'billing'
  | 'reminder'
  | 'letter'
  | 'invitation'

/** Defaut constant (valeur brute, comme en base) ou reference a une autre cle. */
export type AssociationSettingDefault = {value: string} | {fromKey: string}

type AssociationSettingDefinitionBase = {
  key: string
  required: boolean
  default?: AssociationSettingDefault
  /** Cles de traduction, dans le namespace `AssociationSettings`. */
  labelKey: string
  helpKey: string
  /** Message propre a ce parametre pour un code de refus donne. */
  errorMessageKeys?: Partial<Record<AssociationSettingErrorCode, string>>
  /** Phrase affichee sous le champ vide, qui dit la valeur par defaut. */
  whenEmptyKey?: string
  page: AssociationSettingPage
  section?: AssociationSettingSection
  /**
   * Droit de modification restreint (s52, ADR 053) : `super_admin`, seul le
   * SuperAdmin (ou une session ouverte a la place d'un compte par lui) peut le
   * modifier ; le bureau le lit. Absent : le bureau le modifie.
   */
  editableBy?: AssociationSettingEditor
  /**
   * Phrase affichee sous un reglage lu en lecture seule par le bureau, a la
   * place de la phrase commune (s27b). Absente : la phrase commune.
   */
  readOnlyHelpKey?: string
  /**
   * Controle croise (s29, ADR 070 §7) : tant que le booleen de cette autre
   * cle vaut vrai, ce reglage ne peut pas rester vide ; le refus
   * `requiredToEnable` porte sur ce champ-ci.
   */
  requiredWhenKey?: string
}

export type AssociationSettingEditor = 'super_admin'

export type EmailSettingDefinition = AssociationSettingDefinitionBase & {
  type: 'email'
}

export type NumberSettingDefinition = AssociationSettingDefinitionBase & {
  type: 'number'
  min?: number
  max?: number
  integer?: boolean
  unitKey?: string
  /**
   * Controle croise (s52) : la valeur en vigueur doit rester strictement
   * inferieure a celle de cette autre cle ; le refus porte sur ce champ-ci.
   */
  lessThanKey?: string
}

export type BooleanSettingDefinition = AssociationSettingDefinitionBase & {
  type: 'boolean'
}

export type ChoiceSettingOption = {value: string; labelKey: string}

export type ChoiceSettingDefinition = AssociationSettingDefinitionBase & {
  type: 'choice'
  options: readonly ChoiceSettingOption[]
}

/**
 * Jeu de caracteres restreint d'un texte : `verification-code` n'accepte que
 * lettres, chiffres, tirets et soulignes, et reduit une balise `<meta>` collee
 * entiere a la valeur de son attribut `content` ; `postal-code` n'accepte que
 * cinq chiffres (s55), refus `invalidCode`.
 */
export type TextSettingFormat = 'verification-code' | 'postal-code'

export type TextSettingDefinition = AssociationSettingDefinitionBase & {
  type: 'text'
  maxLength: number
  /** Texte long (zone de saisie sur plusieurs lignes, avec compteur). */
  multiline: boolean
  format?: TextSettingFormat
}

export type AssociationSettingDefinition =
  | EmailSettingDefinition
  | NumberSettingDefinition
  | BooleanSettingDefinition
  | ChoiceSettingDefinition
  | TextSettingDefinition

export type AssociationSettingType = AssociationSettingDefinition['type']

export type AssociationSettingsRegistry =
  readonly AssociationSettingDefinition[]

export type AssociationSettingValue = string | number | boolean

export const ASSOCIATION_SETTING_ERROR_CODES = [
  'required',
  'invalidEmail',
  'invalidNumber',
  'belowMin',
  'aboveMax',
  'invalidBoolean',
  'invalidChoice',
  'tooLong',
  'invalidCode',
  'unknownKey',
  'notBelow',
  'statusInBothLists',
  'requiredToEnable',
  'unknownVariable',
] as const

export type AssociationSettingErrorCode =
  (typeof ASSOCIATION_SETTING_ERROR_CODES)[number]

export type AssociationSettingError = {
  code: AssociationSettingErrorCode
  min?: number
  max?: number
}

export type AssociationSettingParseResult =
  | {valid: true; value: AssociationSettingValue; normalized: string}
  | {valid: false; error: AssociationSettingError}

/** Valeur lue d'un parametre, defaut applique. */
export type ResolvedAssociationSetting = {
  /** Valeur en vigueur : stockee, sinon defaut ; `null` sans l'un ni l'autre. */
  value: AssociationSettingValue | null
  /** Valeur brute stockee et valide ; `null` si le parametre n'est pas renseigne. */
  storedValue: string | null
  /** Cle dont la valeur s'applique quand celle-ci n'est pas renseignee. */
  defaultFromKey: string | null
}

export type ResolvedAssociationSettings = Record<
  string,
  ResolvedAssociationSetting
>

export type AssociationSettingRow = {key: string; value: string}

export type AssociationSettingsChangesValidation =
  | {
      valid: true
      upserts: AssociationSettingRow[]
      deletions: string[]
    }
  | {valid: false; errors: Record<string, AssociationSettingError>}

export const CONTACT_EMAIL_SETTING_KEY = 'contact.email'
export const FORAGE_EMAIL_SETTING_KEY = 'forage.responsable.email'
export const ACCENT_HUE_SETTING_KEY = 'identity.accent_hue'
export const MAGIC_LINK_REQUESTS_PER_DAY_SETTING_KEY =
  'login.link_requests_per_address_per_day'
/**
 * Nombre de membres proprietaires de l'association (s06), saisi par le bureau
 * en attendant la base des membres de s12. **Sans defaut** : non renseigne, la
 * phrase de la page publique est omise, jamais rendue « 0 membres ».
 */
export const ASSOCIATION_MEMBER_COUNT_SETTING_KEY = 'association.member_count'
/**
 * Envois acceptes par heure et par visiteur sur les formulaires publics (s08b) :
 * un seul seuil pour tous les formulaires publics de l'association.
 */
export const CONTACT_MESSAGES_PER_HOUR_SETTING_KEY =
  'contact.messages_per_visitor_per_hour'
/**
 * Description de l'association (s11) : repli de la description des pages
 * publiques. **Sans defaut** : vide, aucune balise `description` n'est emise.
 */
export const ASSOCIATION_DESCRIPTION_SETTING_KEY = 'association.description'
/** Code de verification de la Search Console de Google (s11). */
export const GOOGLE_VERIFICATION_SETTING_KEY = 'search.google_verification'

/**
 * Raison sociale de l'association, au pied de page des campagnes (s25).
 * **Sans defaut** : vide, le pied porte le nom de l'association seul.
 */
export const ASSOCIATION_LEGAL_NAME_SETTING_KEY = 'association.legal_name'
/**
 * Mentions du pied de page des campagnes (adresse, SIRET...), s25. **Sans
 * defaut** : vide, aucune mention n'est ecrite ; l'envoi n'est pas bloque.
 */
export const ASSOCIATION_LEGAL_MENTIONS_SETTING_KEY =
  'association.legal_mentions'
/**
 * Decalage horizontal du cadre de l'adresse du courrier, en mm, vers la
 * droite (s28, ADR 067 §4) : corrige une imprimante sans sortir l'adresse de
 * la fenetre. Ne deplace que le cadre de l'adresse.
 */
export const LETTER_ADDRESS_OFFSET_X_SETTING_KEY = 'letter.address_offset_x_mm'
/** Decalage vertical du cadre de l'adresse, en mm, vers le bas (ADR 067 §4). */
export const LETTER_ADDRESS_OFFSET_Y_SETTING_KEY = 'letter.address_offset_y_mm'
/** Borne des deux decalages, en mm de part et d'autre de la norme. */
const LETTER_ADDRESS_OFFSET_BOUND_MM = 10
/**
 * Emails de campagne envoyes au plus par jour (Paris) et par association,
 * toutes campagnes confondues (s26, ADR 052). Au-dela, la campagne s'etale
 * en parts quotidiennes.
 */
export const CAMPAIGN_DAILY_SEND_CAP_SETTING_KEY = 'campaign.daily_send_cap'
/**
 * Tentatives d'envoi d'une part avant que la campagne passe en echec (s26,
 * ADR 052).
 */
export const CAMPAIGN_SEND_MAX_ATTEMPTS_SETTING_KEY =
  'campaign.send_max_attempts'
/**
 * Emails envoyes au plus par jour (Paris) et par association, tous envois
 * confondus (s52, ADR 053) : la limite du compte de messagerie.
 */
export const EMAIL_DAILY_SEND_LIMIT_SETTING_KEY = 'email.daily_send_limit'
/**
 * Part de la limite gardee pour les emails de connexion (s52, ADR 053) : les
 * envois reportables consomment au plus `limite - reserve`.
 */
export const EMAIL_LOGIN_RESERVE_SETTING_KEY = 'email.login_reserve'
/**
 * Jours de validite du lien de confirmation d'une adresse ajoutee ou
 * modifiee par le membre (s54, ADR 056 §5) ; une attente echue est ignoree.
 */
export const MEMBER_EMAIL_CONFIRMATION_DAYS_SETTING_KEY =
  'member.email_confirmation_days'
/**
 * Texte de l'invitation d'un membre (s42a) : il s'affiche au-dessus du bouton
 * de connexion. **Sans defaut** dans le registre : vide, l'email reprend le
 * texte par defaut de `messages/fr.json`.
 */
export const INVITATION_TEXT_SETTING_KEY = 'invitation.text'
/** Plafond du texte de l'invitation. */
export const INVITATION_TEXT_MAX_LENGTH = 2000
/**
 * Texte du courrier de lancement (s42b, ADR 072 §6), envoye par la poste aux
 * membres sans adresse email : ni lien de connexion, ni promesse d'acces.
 * **Sans defaut** dans le registre : vide, le courrier reprend le texte par
 * defaut de `messages/fr.json`.
 */
export const INVITATION_LETTER_TEXT_SETTING_KEY = 'invitation.letter_text'
/**
 * Jours de validite du lien d'une invitation (s42a, ADR 071) ; le lien
 * demande depuis la page de connexion garde sa propre duree.
 */
export const INVITATION_LINK_DAYS_SETTING_KEY = 'invitation.link_days'
/**
 * Code postal et commune du terrain par defaut (s55, ADR 058) : l'import les
 * ecrit au terrain d'une fiche **creee** sans adresse de terrain. **Sans
 * defaut** : vides, le terrain reste vide. La valeur d'une association se
 * saisit dans « Reglages », jamais dans le code (ADR 010).
 */
export const MEMBER_DEFAULT_LAND_POSTAL_CODE_SETTING_KEY =
  'member.default_land_postal_code'
export const MEMBER_DEFAULT_LAND_CITY_SETTING_KEY = 'member.default_land_city'
/** Plafond de la commune du terrain par defaut : celui d'une fiche. */
export const MEMBER_DEFAULT_LAND_CITY_MAX_LENGTH = 100
/**
 * Fournisseur des factures des membres (s19, ADR 059 §7) : l'implementation de
 * `MemberBillingProvider` en vigueur. `manual` en s19 ; s20 ajoute
 * `pennylane`. Reserve au SuperAdmin.
 */
export const BILLING_PROVIDER_SETTING_KEY = 'billing.provider'
export const BILLING_PROVIDER_MANUAL = 'manual'
/** Factures synchronisees depuis Pennylane, en lecture seule (s20, ADR 062). */
export const BILLING_PROVIDER_PENNYLANE = 'pennylane'
/**
 * Modele de l'objet d'une facture (s19, ADR 059 §6) : `{année}` y est
 * remplace par l'annee de la facture. Le libelle de la source n'est jamais
 * affiche.
 */
export const BILLING_INVOICE_SUBJECT_SETTING_KEY = 'billing.invoice_subject'
/** Balise du modele d'objet remplacee par l'annee de la facture. */
export const INVOICE_SUBJECT_YEAR_TOKEN = '{année}'
/**
 * Statuts de facture qui valent « impayé » et « réglé » (s19, ADR 059 §4) :
 * un par ligne, vides par defaut. Un statut absent des deux est « à classer ».
 * Aucune valeur n'est livree : le bureau les recopie de sa source.
 */
export const BILLING_UNPAID_STATUSES_SETTING_KEY = 'billing.unpaid_statuses'
export const BILLING_SETTLED_STATUSES_SETTING_KEY = 'billing.settled_statuses'
/**
 * Libelles des statuts lus par les membres (s20, ADR 062 §5) : « statut =
 * libelle », un par ligne, vide par defaut. Un statut sans libelle s'affiche
 * tel quel ; le libelle ne sert jamais au classement.
 */
export const BILLING_STATUS_LABELS_SETTING_KEY = 'billing.status_labels'
/**
 * Destinataire du signalement d'un statut de facture a classer (s19, ADR 059
 * §5) ; repli sur l'adresse de contact.
 */
export const BILLING_ALERT_EMAIL_SETTING_KEY = 'billing.alert_email'
/** Plafond du modele d'objet d'une facture. */
export const BILLING_INVOICE_SUBJECT_MAX_LENGTH = 120
/** Plafond d'une liste de statuts de facture. */
export const BILLING_STATUS_LIST_MAX_LENGTH = 1000

/**
 * Relance automatique des impayes (s29, ADR 070 §7). Desactivee par defaut ;
 * intervalles, objet et texte **sans defaut** : les valeurs d'une association
 * se saisissent dans « Reglages » (seed du premier tenant), jamais dans le
 * code (ADR 010). L'activation exige les cinq.
 */
export const BILLING_REMINDER_ENABLED_SETTING_KEY = 'billing.reminder.enabled'
/** Intervalles successifs, en semaines : depuis l'echeance, puis le rang precedent. */
export const BILLING_REMINDER_DELAY_WEEKS_SETTING_KEYS = [
  'billing.reminder.delay_weeks.1',
  'billing.reminder.delay_weeks.2',
  'billing.reminder.delay_weeks.3',
] as const
export const BILLING_REMINDER_SUBJECT_SETTING_KEY = 'billing.reminder.subject'
export const BILLING_REMINDER_BODY_SETTING_KEY = 'billing.reminder.body'
/** Plafond d'un intervalle de relance, en semaines. */
const BILLING_REMINDER_DELAY_WEEKS_MAX = 52

/** Plafond de la raison sociale. */
export const ASSOCIATION_LEGAL_NAME_MAX_LENGTH = 120
/** Plafond des mentions du pied de page. */
export const ASSOCIATION_LEGAL_MENTIONS_MAX_LENGTH = 500

/** Plafond d'une description, valeur d'usage des moteurs de recherche. */
export const ASSOCIATION_DESCRIPTION_MAX_LENGTH = SEO_DESCRIPTION_MAX
/** Plafond d'un code de verification : bien au-dela des ~43 de Google. */
export const VERIFICATION_CODE_MAX_LENGTH = 100

/**
 * Les six teintes d'accent validees (design system §1.2). Le bureau choisit
 * dans cette liste, jamais au selecteur libre.
 */
export const ACCENT_HUES = [
  {hue: 195, name: 'water'},
  {hue: 150, name: 'pines'},
  {hue: 255, name: 'lake'},
  {hue: 40, name: 'tile'},
  {hue: 300, name: 'heather'},
  {hue: 95, name: 'broom'},
] as const

export type AccentHue = (typeof ACCENT_HUES)[number]['hue']
export type AccentHueName = (typeof ACCENT_HUES)[number]['name']

export const DEFAULT_ACCENT_HUE: AccentHue = 195

export const isAccentHue = (value: unknown): value is AccentHue =>
  ACCENT_HUES.some(({hue}) => hue === value)

export const getAccentHueName = (hue: AccentHue): AccentHueName =>
  ACCENT_HUES.find((candidate) => candidate.hue === hue)?.name ?? 'water'

/**
 * Cle de la nature d'un type d'envoi (s27b, ADR 064) : une par valeur de
 * `CAMPAIGN_SEND_KINDS` (modeles du composeur, relance automatique de s29,
 * lancement et relance des invitations de s42b).
 */
export const campaignNatureSettingKeyOf = (
  templateId: CampaignSendKind
): string => `campaign.nature.${templateId}`

/**
 * Les reglages de nature, un par type d'envoi, `facultative` par defaut,
 * reserves au SuperAdmin (arbitrage du 20/11/2026). La classification d'une
 * association est une valeur de reglage, jamais une constante (ADR 010).
 */
const CAMPAIGN_NATURE_SETTINGS: AssociationSettingDefinition[] =
  CAMPAIGN_SEND_KINDS.map((templateId) => ({
    key: campaignNatureSettingKeyOf(templateId),
    type: 'choice',
    required: false,
    default: {value: DEFAULT_CAMPAIGN_NATURE},
    options: CAMPAIGN_NATURES.map((nature) => ({
      value: nature,
      labelKey: `campaignNature.options.${nature}`,
    })),
    labelKey: `campaignNature.templates.${templateId}`,
    helpKey: 'campaignNature.help',
    whenEmptyKey: 'campaignNature.whenEmpty',
    readOnlyHelpKey: 'campaignNature.superAdminOnly',
    page: 'settings',
    section: 'campaign_nature',
    editableBy: 'super_admin',
  }))

/** Le registre de production. */
export const ASSOCIATION_SETTINGS_REGISTRY: AssociationSettingsRegistry = [
  {
    key: CONTACT_EMAIL_SETTING_KEY,
    type: 'email',
    required: true,
    labelKey: 'fields.contactEmail.label',
    helpKey: 'fields.contactEmail.help',
    errorMessageKeys: {required: 'fields.contactEmail.errors.required'},
    page: 'settings',
  },
  {
    key: FORAGE_EMAIL_SETTING_KEY,
    type: 'email',
    required: false,
    default: {fromKey: CONTACT_EMAIL_SETTING_KEY},
    labelKey: 'fields.forageEmail.label',
    helpKey: 'fields.forageEmail.help',
    whenEmptyKey: 'fields.forageEmail.whenEmpty',
    page: 'settings',
  },
  {
    key: ACCENT_HUE_SETTING_KEY,
    type: 'choice',
    required: false,
    default: {value: String(DEFAULT_ACCENT_HUE)},
    options: ACCENT_HUES.map(({hue, name}) => ({
      value: String(hue),
      labelKey: `hues.${name}`,
    })),
    labelKey: 'fields.accentHue.label',
    helpKey: 'fields.accentHue.help',
    page: 'identity',
  },
  {
    key: MAGIC_LINK_REQUESTS_PER_DAY_SETTING_KEY,
    type: 'number',
    required: false,
    default: {value: '3'},
    min: 1,
    max: 20,
    integer: true,
    unitKey: 'units.requestsPerDay',
    labelKey: 'fields.linkRequestsPerDay.label',
    helpKey: 'fields.linkRequestsPerDay.help',
    page: 'settings',
  },
  {
    key: ASSOCIATION_MEMBER_COUNT_SETTING_KEY,
    type: 'number',
    required: false,
    min: 0,
    integer: true,
    unitKey: 'units.members',
    labelKey: 'fields.memberCount.label',
    helpKey: 'fields.memberCount.help',
    whenEmptyKey: 'fields.memberCount.whenEmpty',
    page: 'settings',
  },
  {
    key: CONTACT_MESSAGES_PER_HOUR_SETTING_KEY,
    type: 'number',
    required: false,
    default: {value: '3'},
    min: 1,
    max: 20,
    integer: true,
    unitKey: 'units.messagesPerHour',
    labelKey: 'fields.contactMessagesPerHour.label',
    helpKey: 'fields.contactMessagesPerHour.help',
    page: 'settings',
  },
  {
    key: ASSOCIATION_DESCRIPTION_SETTING_KEY,
    type: 'text',
    required: false,
    maxLength: ASSOCIATION_DESCRIPTION_MAX_LENGTH,
    multiline: true,
    labelKey: 'fields.associationDescription.label',
    helpKey: 'fields.associationDescription.help',
    whenEmptyKey: 'fields.associationDescription.whenEmpty',
    page: 'settings',
    section: 'seo',
  },
  {
    key: GOOGLE_VERIFICATION_SETTING_KEY,
    type: 'text',
    required: false,
    maxLength: VERIFICATION_CODE_MAX_LENGTH,
    multiline: false,
    format: 'verification-code',
    labelKey: 'fields.googleVerification.label',
    helpKey: 'fields.googleVerification.help',
    whenEmptyKey: 'fields.googleVerification.whenEmpty',
    page: 'settings',
    section: 'seo',
  },
  {
    key: ASSOCIATION_LEGAL_NAME_SETTING_KEY,
    type: 'text',
    required: false,
    maxLength: ASSOCIATION_LEGAL_NAME_MAX_LENGTH,
    multiline: false,
    labelKey: 'fields.legalName.label',
    helpKey: 'fields.legalName.help',
    whenEmptyKey: 'fields.legalName.whenEmpty',
    page: 'settings',
    section: 'legal',
  },
  {
    key: ASSOCIATION_LEGAL_MENTIONS_SETTING_KEY,
    type: 'text',
    required: false,
    maxLength: ASSOCIATION_LEGAL_MENTIONS_MAX_LENGTH,
    multiline: true,
    labelKey: 'fields.legalMentions.label',
    helpKey: 'fields.legalMentions.help',
    whenEmptyKey: 'fields.legalMentions.whenEmpty',
    page: 'settings',
    section: 'legal',
  },
  {
    key: EMAIL_DAILY_SEND_LIMIT_SETTING_KEY,
    type: 'number',
    required: false,
    default: {value: '300'},
    min: 1,
    integer: true,
    unitKey: 'units.sendsPerDay',
    labelKey: 'fields.emailDailySendLimit.label',
    helpKey: 'fields.emailDailySendLimit.help',
    page: 'settings',
    section: 'sending',
    editableBy: 'super_admin',
  },
  {
    key: EMAIL_LOGIN_RESERVE_SETTING_KEY,
    type: 'number',
    required: false,
    default: {value: '100'},
    min: 0,
    integer: true,
    unitKey: 'units.sendsPerDay',
    labelKey: 'fields.emailLoginReserve.label',
    helpKey: 'fields.emailLoginReserve.help',
    errorMessageKeys: {notBelow: 'fields.emailLoginReserve.errors.notBelow'},
    page: 'settings',
    section: 'sending',
    editableBy: 'super_admin',
    lessThanKey: EMAIL_DAILY_SEND_LIMIT_SETTING_KEY,
  },
  {
    key: CAMPAIGN_DAILY_SEND_CAP_SETTING_KEY,
    type: 'number',
    required: false,
    default: {value: '100'},
    min: 1,
    integer: true,
    unitKey: 'units.sendsPerDay',
    labelKey: 'fields.campaignDailySendCap.label',
    helpKey: 'fields.campaignDailySendCap.help',
    errorMessageKeys: {
      invalidNumber: 'fields.campaignDailySendCap.errors.invalidNumber',
      belowMin: 'fields.campaignDailySendCap.errors.belowMin',
    },
    page: 'settings',
    section: 'sending',
  },
  {
    key: CAMPAIGN_SEND_MAX_ATTEMPTS_SETTING_KEY,
    type: 'number',
    required: false,
    default: {value: '3'},
    min: 1,
    max: 10,
    integer: true,
    unitKey: 'units.attempts',
    labelKey: 'fields.campaignSendMaxAttempts.label',
    helpKey: 'fields.campaignSendMaxAttempts.help',
    page: 'settings',
    section: 'sending',
  },
  {
    key: MEMBER_EMAIL_CONFIRMATION_DAYS_SETTING_KEY,
    type: 'number',
    required: false,
    default: {value: '7'},
    min: 1,
    integer: true,
    unitKey: 'units.days',
    labelKey: 'fields.memberEmailConfirmationDays.label',
    helpKey: 'fields.memberEmailConfirmationDays.help',
    errorMessageKeys: {
      invalidNumber: 'fields.memberEmailConfirmationDays.errors.invalidNumber',
      belowMin: 'fields.memberEmailConfirmationDays.errors.belowMin',
    },
    page: 'settings',
    section: 'sending',
  },
  ...CAMPAIGN_NATURE_SETTINGS,
  {
    key: MEMBER_DEFAULT_LAND_POSTAL_CODE_SETTING_KEY,
    type: 'text',
    required: false,
    maxLength: 5,
    multiline: false,
    format: 'postal-code',
    labelKey: 'fields.defaultLandPostalCode.label',
    helpKey: 'fields.defaultLandPostalCode.help',
    whenEmptyKey: 'fields.defaultLandPostalCode.whenEmpty',
    errorMessageKeys: {
      invalidCode: 'fields.defaultLandPostalCode.errors.invalidCode',
    },
    page: 'settings',
  },
  {
    key: MEMBER_DEFAULT_LAND_CITY_SETTING_KEY,
    type: 'text',
    required: false,
    maxLength: MEMBER_DEFAULT_LAND_CITY_MAX_LENGTH,
    multiline: false,
    labelKey: 'fields.defaultLandCity.label',
    helpKey: 'fields.defaultLandCity.help',
    whenEmptyKey: 'fields.defaultLandCity.whenEmpty',
    page: 'settings',
  },
  {
    key: BILLING_PROVIDER_SETTING_KEY,
    type: 'choice',
    required: false,
    default: {value: BILLING_PROVIDER_MANUAL},
    options: [
      {value: BILLING_PROVIDER_MANUAL, labelKey: 'billingProviders.manual'},
      {
        value: BILLING_PROVIDER_PENNYLANE,
        labelKey: 'billingProviders.pennylane',
      },
    ],
    labelKey: 'fields.billingProvider.label',
    helpKey: 'fields.billingProvider.help',
    page: 'settings',
    section: 'billing',
    editableBy: 'super_admin',
  },
  {
    key: BILLING_INVOICE_SUBJECT_SETTING_KEY,
    type: 'text',
    required: true,
    default: {value: `Facture ${INVOICE_SUBJECT_YEAR_TOKEN}`},
    maxLength: BILLING_INVOICE_SUBJECT_MAX_LENGTH,
    multiline: false,
    labelKey: 'fields.invoiceSubject.label',
    helpKey: 'fields.invoiceSubject.help',
    page: 'settings',
    section: 'billing',
  },
  {
    key: BILLING_UNPAID_STATUSES_SETTING_KEY,
    type: 'text',
    required: false,
    maxLength: BILLING_STATUS_LIST_MAX_LENGTH,
    multiline: true,
    labelKey: 'fields.unpaidStatuses.label',
    helpKey: 'fields.unpaidStatuses.help',
    whenEmptyKey: 'fields.unpaidStatuses.whenEmpty',
    page: 'settings',
    section: 'billing',
  },
  {
    key: BILLING_SETTLED_STATUSES_SETTING_KEY,
    type: 'text',
    required: false,
    maxLength: BILLING_STATUS_LIST_MAX_LENGTH,
    multiline: true,
    labelKey: 'fields.settledStatuses.label',
    helpKey: 'fields.settledStatuses.help',
    whenEmptyKey: 'fields.settledStatuses.whenEmpty',
    page: 'settings',
    section: 'billing',
  },
  {
    key: BILLING_STATUS_LABELS_SETTING_KEY,
    type: 'text',
    required: false,
    maxLength: BILLING_STATUS_LIST_MAX_LENGTH,
    multiline: true,
    labelKey: 'fields.statusLabels.label',
    helpKey: 'fields.statusLabels.help',
    whenEmptyKey: 'fields.statusLabels.whenEmpty',
    page: 'settings',
    section: 'billing',
  },
  {
    key: BILLING_ALERT_EMAIL_SETTING_KEY,
    type: 'email',
    required: false,
    default: {fromKey: CONTACT_EMAIL_SETTING_KEY},
    labelKey: 'fields.billingAlertEmail.label',
    helpKey: 'fields.billingAlertEmail.help',
    page: 'settings',
    section: 'billing',
  },
  {
    key: BILLING_REMINDER_ENABLED_SETTING_KEY,
    type: 'boolean',
    required: false,
    default: {value: 'false'},
    labelKey: 'fields.reminderEnabled.label',
    helpKey: 'fields.reminderEnabled.help',
    page: 'settings',
    section: 'reminder',
  },
  ...BILLING_REMINDER_DELAY_WEEKS_SETTING_KEYS.map(
    (key, index): NumberSettingDefinition => ({
      key,
      type: 'number',
      required: false,
      min: 1,
      max: BILLING_REMINDER_DELAY_WEEKS_MAX,
      integer: true,
      unitKey: `units.reminderWeeks${index + 1}`,
      labelKey: `fields.reminderDelay${index + 1}.label`,
      helpKey: `fields.reminderDelay${index + 1}.help`,
      errorMessageKeys: {
        requiredToEnable: `fields.reminderDelay${index + 1}.errors.requiredToEnable`,
      },
      page: 'settings',
      section: 'reminder',
      requiredWhenKey: BILLING_REMINDER_ENABLED_SETTING_KEY,
    })
  ),
  {
    key: BILLING_REMINDER_SUBJECT_SETTING_KEY,
    type: 'text',
    required: false,
    maxLength: CAMPAIGN_SUBJECT_MAX_TOTAL,
    multiline: false,
    labelKey: 'fields.reminderSubject.label',
    helpKey: 'fields.reminderSubject.help',
    errorMessageKeys: {
      requiredToEnable: 'fields.reminderSubject.errors.requiredToEnable',
    },
    page: 'settings',
    section: 'reminder',
    requiredWhenKey: BILLING_REMINDER_ENABLED_SETTING_KEY,
  },
  {
    key: BILLING_REMINDER_BODY_SETTING_KEY,
    type: 'text',
    required: false,
    maxLength: CAMPAIGN_BODY_MAX,
    multiline: true,
    labelKey: 'fields.reminderBody.label',
    helpKey: 'fields.reminderBody.help',
    errorMessageKeys: {
      requiredToEnable: 'fields.reminderBody.errors.requiredToEnable',
    },
    page: 'settings',
    section: 'reminder',
    requiredWhenKey: BILLING_REMINDER_ENABLED_SETTING_KEY,
  },
  ...(
    [
      [LETTER_ADDRESS_OFFSET_X_SETTING_KEY, 'letterAddressOffsetX'],
      [LETTER_ADDRESS_OFFSET_Y_SETTING_KEY, 'letterAddressOffsetY'],
    ] as const
  ).map(([key, field]): NumberSettingDefinition => ({
    key,
    type: 'number',
    required: false,
    default: {value: '0'},
    min: -LETTER_ADDRESS_OFFSET_BOUND_MM,
    max: LETTER_ADDRESS_OFFSET_BOUND_MM,
    integer: true,
    unitKey: 'units.millimeters',
    labelKey: `fields.${field}.label`,
    helpKey: `fields.${field}.help`,
    errorMessageKeys: {
      invalidNumber: `fields.${field}.errors.invalidNumber`,
      belowMin: `fields.${field}.errors.outOfRange`,
      aboveMax: `fields.${field}.errors.outOfRange`,
    },
    page: 'settings',
    section: 'letter',
  })),
  {
    key: INVITATION_TEXT_SETTING_KEY,
    type: 'text',
    required: false,
    maxLength: INVITATION_TEXT_MAX_LENGTH,
    multiline: true,
    labelKey: 'fields.invitationText.label',
    helpKey: 'fields.invitationText.help',
    whenEmptyKey: 'fields.invitationText.whenEmpty',
    page: 'settings',
    section: 'invitation',
  },
  {
    key: INVITATION_LETTER_TEXT_SETTING_KEY,
    type: 'text',
    required: false,
    maxLength: INVITATION_TEXT_MAX_LENGTH,
    multiline: true,
    labelKey: 'fields.invitationLetterText.label',
    helpKey: 'fields.invitationLetterText.help',
    whenEmptyKey: 'fields.invitationLetterText.whenEmpty',
    page: 'settings',
    section: 'invitation',
  },
  {
    key: INVITATION_LINK_DAYS_SETTING_KEY,
    type: 'number',
    required: false,
    default: {value: '7'},
    min: 1,
    max: 30,
    integer: true,
    unitKey: 'units.days',
    labelKey: 'fields.invitationLinkDays.label',
    helpKey: 'fields.invitationLinkDays.help',
    errorMessageKeys: {
      invalidNumber: 'fields.invitationLinkDays.errors.outOfRange',
      belowMin: 'fields.invitationLinkDays.errors.outOfRange',
      aboveMax: 'fields.invitationLinkDays.errors.outOfRange',
    },
    page: 'settings',
    section: 'invitation',
  },
]

const emailSchema = z.email()

const accepted = (
  value: AssociationSettingValue,
  normalized: string
): AssociationSettingParseResult => ({valid: true, value, normalized})

const refused = (
  error: AssociationSettingError
): AssociationSettingParseResult => ({valid: false, error})

const parseEmail = (raw: string): AssociationSettingParseResult =>
  emailSchema.safeParse(raw).success
    ? accepted(raw, raw)
    : refused({code: 'invalidEmail'})

const parseNumber = (
  definition: NumberSettingDefinition,
  raw: string
): AssociationSettingParseResult => {
  const pattern = definition.integer ? /^-?\d+$/ : /^-?\d+(\.\d+)?$/
  if (!pattern.test(raw)) return refused({code: 'invalidNumber'})

  const value = Number(raw)
  if (definition.min !== undefined && value < definition.min) {
    return refused({code: 'belowMin', min: definition.min})
  }
  if (definition.max !== undefined && value > definition.max) {
    return refused({code: 'aboveMax', max: definition.max})
  }
  return accepted(value, String(value))
}

const parseBoolean = (raw: string): AssociationSettingParseResult =>
  raw === 'true' || raw === 'false'
    ? accepted(raw === 'true', raw)
    : refused({code: 'invalidBoolean'})

const parseChoice = (
  definition: ChoiceSettingDefinition,
  raw: string
): AssociationSettingParseResult =>
  definition.options.some((option) => option.value === raw)
    ? accepted(raw, raw)
    : refused({code: 'invalidChoice'})

const VERIFICATION_CODE_PATTERN = /^[A-Za-z0-9_-]+$/
const POSTAL_CODE_PATTERN = /^\d{5}$/
const META_CONTENT_PATTERN = /\bcontent\s*=\s*(["'])(.*?)\1/i

/**
 * Le code de verification d'une saisie : la valeur de l'attribut `content`
 * si une balise `<meta>` a ete collee entiere, sinon la saisie elle-meme,
 * espaces de bord retires. Une balise sans `content` ne donne aucun code.
 */
export const extractGoogleVerificationCode = (
  raw: string
): string | undefined => {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('<')) return trimmed
  const content = META_CONTENT_PATTERN.exec(trimmed)?.[2]?.trim()
  return content === undefined || content === '' ? undefined : content
}

const parseText = (
  definition: TextSettingDefinition,
  raw: string
): AssociationSettingParseResult => {
  const text =
    definition.format === 'verification-code'
      ? extractGoogleVerificationCode(raw)
      : raw
  if (text === undefined) return refused({code: 'invalidCode'})
  if (
    definition.format === 'verification-code' &&
    !VERIFICATION_CODE_PATTERN.test(text)
  ) {
    return refused({code: 'invalidCode'})
  }
  if (definition.format === 'postal-code' && !POSTAL_CODE_PATTERN.test(text)) {
    return refused({code: 'invalidCode'})
  }
  if (text.length > definition.maxLength) {
    return refused({code: 'tooLong', max: definition.maxLength})
  }
  return accepted(text, text)
}

/**
 * Valide une valeur brute selon le type declare. Une valeur vide est refusee
 * (`required`) : vider un parametre se traite dans `validateSettingsChanges`.
 */
export const parseSettingValue = (
  definition: AssociationSettingDefinition,
  raw: string
): AssociationSettingParseResult => {
  if (raw.trim() === '') return refused({code: 'required'})
  const trimmed = definition.type === 'boolean' ? raw : raw.trim()

  switch (definition.type) {
    case 'email':
      return parseEmail(trimmed)
    case 'number':
      return parseNumber(definition, trimmed)
    case 'boolean':
      return parseBoolean(trimmed)
    case 'choice':
      return parseChoice(definition, trimmed)
    case 'text':
      return parseText(definition, trimmed)
  }
}

export const getSettingsForPage = (
  registry: AssociationSettingsRegistry,
  page: AssociationSettingPage
): AssociationSettingDefinition[] =>
  registry.filter((definition) => definition.page === page)

const findDefinition = (
  registry: AssociationSettingsRegistry,
  key: string
): AssociationSettingDefinition | undefined =>
  registry.find((definition) => definition.key === key)

/** Vrai si une chaine de references de defaut revient sur elle-meme. */
export const hasSettingReferenceCycle = (
  registry: AssociationSettingsRegistry
): boolean =>
  registry.some((start) => {
    const visited = new Set<string>([start.key])
    let current: AssociationSettingDefinition | undefined = start
    while (current?.default && 'fromKey' in current.default) {
      const next = current.default.fromKey
      if (visited.has(next)) return true
      visited.add(next)
      current = findDefinition(registry, next)
    }
    return false
  })

const storedValidValues = (
  registry: AssociationSettingsRegistry,
  rows: readonly AssociationSettingRow[]
): Map<string, {raw: string; value: AssociationSettingValue}> => {
  const values = new Map<
    string,
    {raw: string; value: AssociationSettingValue}
  >()
  for (const row of rows) {
    const definition = findDefinition(registry, row.key)
    if (!definition) continue
    const parsed = parseSettingValue(definition, row.value)
    if (parsed.valid) {
      values.set(row.key, {raw: parsed.normalized, value: parsed.value})
    }
  }
  return values
}

const resolveValue = (
  registry: AssociationSettingsRegistry,
  stored: Map<string, {raw: string; value: AssociationSettingValue}>,
  key: string,
  visited: Set<string>
): AssociationSettingValue | null => {
  const definition = findDefinition(registry, key)
  if (!definition || visited.has(key)) return null

  const own = stored.get(key)
  if (own) return own.value
  if (!definition.default) return null

  if ('fromKey' in definition.default) {
    return resolveValue(
      registry,
      stored,
      definition.default.fromKey,
      new Set([...visited, key])
    )
  }

  const parsed = parseSettingValue(definition, definition.default.value)
  return parsed.valid ? parsed.value : null
}

/**
 * Lit les parametres d'une association : valeur stockee, sinon defaut du
 * registre (constante ou autre cle). Une ligne hors registre est ignoree ;
 * une valeur stockee invalide se lit comme absente (ADR 016).
 */
export const resolveSettings = (
  registry: AssociationSettingsRegistry,
  rows: readonly AssociationSettingRow[]
): ResolvedAssociationSettings => {
  const stored = storedValidValues(registry, rows)

  return Object.fromEntries(
    registry.map((definition) => [
      definition.key,
      {
        value: resolveValue(registry, stored, definition.key, new Set()),
        storedValue: stored.get(definition.key)?.raw ?? null,
        defaultFromKey:
          !stored.has(definition.key) &&
          definition.default &&
          'fromKey' in definition.default
            ? definition.default.fromKey
            : null,
      },
    ])
  )
}

/** Vrai si seul le SuperAdmin peut modifier ce parametre (s52, ADR 053). */
export const isSuperAdminOnlySetting = (
  definition: AssociationSettingDefinition
): boolean => definition.editableBy === 'super_admin'

/**
 * Controles croises (s52) : une cle `lessThanKey` doit rester strictement
 * inferieure a sa reference, valeurs en vigueur apres le lot (enregistrees,
 * modifiees, ou defaut). Ne juge que les paires touchees par le lot.
 */
const crossCheckErrors = (
  registry: AssociationSettingsRegistry,
  changes: Readonly<Record<string, string>>,
  upserts: readonly AssociationSettingRow[],
  deletions: readonly string[],
  stored: readonly AssociationSettingRow[]
): Record<string, AssociationSettingError> => {
  const touched = new Set([...upserts.map(({key}) => key), ...deletions])
  const after = resolveSettings(registry, [
    ...stored.filter(({key}) => !(key in changes)),
    ...upserts,
  ])
  const errors: Record<string, AssociationSettingError> = requiredWhenErrors(
    registry,
    touched,
    after
  )
  for (const definition of registry) {
    if (definition.type !== 'number' || !definition.lessThanKey) continue
    if (!touched.has(definition.key) && !touched.has(definition.lessThanKey)) {
      continue
    }
    const value = after[definition.key]?.value
    const reference = after[definition.lessThanKey]?.value
    if (
      typeof value === 'number' &&
      typeof reference === 'number' &&
      value >= reference
    ) {
      errors[definition.key] = {code: 'notBelow', max: reference}
    }
  }
  return errors
}

/**
 * Controle croise d'activation (s29) : une cle `requiredWhenKey` doit etre
 * renseignee tant que le booleen de reference vaut vrai apres le lot. Ne juge
 * que les paires touchees ; desactiver passe toujours.
 */
const requiredWhenErrors = (
  registry: AssociationSettingsRegistry,
  touched: ReadonlySet<string>,
  after: ResolvedAssociationSettings
): Record<string, AssociationSettingError> => {
  const errors: Record<string, AssociationSettingError> = {}
  for (const definition of registry) {
    const reference = definition.requiredWhenKey
    if (!reference) continue
    if (!touched.has(definition.key) && !touched.has(reference)) continue
    const value = after[definition.key]?.value
    const isEmpty =
      value === null || value === undefined || String(value).trim() === ''
    if (after[reference]?.value === true && isEmpty) {
      errors[definition.key] = {code: 'requiredToEnable'}
    }
  }
  return errors
}

/**
 * Valide un lot de modifications, tout ou rien. Un parametre facultatif vide
 * est a supprimer (retour au defaut) ; un parametre obligatoire vide est
 * refuse ; une cle hors registre est refusee. `stored` (valeurs enregistrees)
 * sert aux controles croises : une cle absente du lot garde sa valeur.
 */
export const validateSettingsChanges = (
  registry: AssociationSettingsRegistry,
  changes: Readonly<Record<string, string>>,
  stored: readonly AssociationSettingRow[] = []
): AssociationSettingsChangesValidation => {
  const upserts: AssociationSettingRow[] = []
  const deletions: string[] = []
  const errors: Record<string, AssociationSettingError> = {}

  for (const [key, raw] of Object.entries(changes)) {
    const definition = findDefinition(registry, key)
    if (!definition) {
      errors[key] = {code: 'unknownKey'}
      continue
    }

    if (raw.trim() === '') {
      if (definition.required) errors[key] = {code: 'required'}
      else deletions.push(key)
      continue
    }

    const parsed = parseSettingValue(definition, raw)
    if (parsed.valid) upserts.push({key, value: parsed.normalized})
    else errors[key] = parsed.error
  }

  if (Object.keys(errors).length === 0) {
    Object.assign(
      errors,
      crossCheckErrors(registry, changes, upserts, deletions, stored)
    )
  }

  return Object.keys(errors).length > 0
    ? {valid: false, errors}
    : {valid: true, upserts, deletions}
}

/** Teinte d'accent en vigueur ; la teinte par defaut si rien de valide. */
export const getAccentHue = (
  settings: ResolvedAssociationSettings
): AccentHue => {
  const value = Number(settings[ACCENT_HUE_SETTING_KEY]?.value)
  return isAccentHue(value) ? value : DEFAULT_ACCENT_HUE
}

const numberSettingOf = (
  settings: ResolvedAssociationSettings,
  key: string
): number => {
  const value = settings[key]?.value
  if (typeof value === 'number') return value
  const definition = findDefinition(ASSOCIATION_SETTINGS_REGISTRY, key)
  const fallback =
    definition?.default && 'value' in definition.default
      ? Number(definition.default.value)
      : Number.NaN
  if (Number.isNaN(fallback)) {
    throw new Error(`Parametre numerique sans defaut : ${key}`)
  }
  return fallback
}

/**
 * Demandes de lien de connexion acceptees par adresse et par jour (s03) :
 * valeur du bureau, sinon defaut du registre.
 */
export const getMagicLinkDailyRequestLimit = (
  settings: ResolvedAssociationSettings
): number => numberSettingOf(settings, MAGIC_LINK_REQUESTS_PER_DAY_SETTING_KEY)

/**
 * Envois acceptes par heure et par visiteur sur les formulaires publics
 * (s08b) : valeur du bureau, sinon defaut du registre.
 */
export const getContactMessagesPerHourLimit = (
  settings: ResolvedAssociationSettings
): number => numberSettingOf(settings, CONTACT_MESSAGES_PER_HOUR_SETTING_KEY)

/**
 * Plafond quotidien des emails de campagne de l'association (s26) : valeur
 * du bureau, sinon defaut du registre.
 */
export const getCampaignDailySendCap = (
  settings: ResolvedAssociationSettings
): number => numberSettingOf(settings, CAMPAIGN_DAILY_SEND_CAP_SETTING_KEY)

/**
 * Tentatives d'envoi d'une part avant l'echec de la campagne (s26) : valeur
 * du bureau, sinon defaut du registre.
 */
export const getCampaignSendMaxAttempts = (
  settings: ResolvedAssociationSettings
): number => numberSettingOf(settings, CAMPAIGN_SEND_MAX_ATTEMPTS_SETTING_KEY)

const textSettingOf = (
  settings: ResolvedAssociationSettings,
  key: string
): string | undefined => {
  const value = settings[key]?.value
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

/** Description de l'association (s11) : rien si non renseignee. */
export const getAssociationDescription = (
  settings: ResolvedAssociationSettings
): string | undefined =>
  textSettingOf(settings, ASSOCIATION_DESCRIPTION_SETTING_KEY)

/** Code de verification Google (s11) : rien si non renseigne. */
export const getGoogleVerificationCode = (
  settings: ResolvedAssociationSettings
): string | undefined =>
  textSettingOf(settings, GOOGLE_VERIFICATION_SETTING_KEY)

/**
 * Emails envoyes au plus par jour par l'association, tous envois confondus
 * (s52) : valeur du SuperAdmin, sinon defaut du registre.
 */
export const getEmailDailySendLimit = (
  settings: ResolvedAssociationSettings
): number => numberSettingOf(settings, EMAIL_DAILY_SEND_LIMIT_SETTING_KEY)

/**
 * Envois gardes chaque jour pour les emails de connexion (s52) : valeur du
 * SuperAdmin, sinon defaut du registre.
 */
export const getEmailLoginReserve = (
  settings: ResolvedAssociationSettings
): number => numberSettingOf(settings, EMAIL_LOGIN_RESERVE_SETTING_KEY)

/**
 * Jours de validite d'un lien de confirmation d'adresse (s54) : valeur du
 * bureau, sinon defaut du registre.
 */
export const getMemberEmailConfirmationDays = (
  settings: ResolvedAssociationSettings
): number =>
  numberSettingOf(settings, MEMBER_EMAIL_CONFIRMATION_DAYS_SETTING_KEY)

/**
 * Code postal et commune du terrain par defaut (s55, ADR 058) : `null` quand
 * le bureau ne les a pas renseignes, jamais une valeur du code.
 */
export const getDefaultLandAddress = (
  settings: ResolvedAssociationSettings
): {postalCode: string | null; city: string | null} => ({
  postalCode:
    textSettingOf(settings, MEMBER_DEFAULT_LAND_POSTAL_CODE_SETTING_KEY) ??
    null,
  city: textSettingOf(settings, MEMBER_DEFAULT_LAND_CITY_SETTING_KEY) ?? null,
})

/**
 * La nature d'un type d'envoi (s27b, ADR 064) : `statutaire` seulement si le
 * reglage le dit ; toute valeur absente, vide ou inconnue se lit
 * `facultative` — sur-exclure est le sens sur.
 */
export const getCampaignNature = (
  settings: ResolvedAssociationSettings,
  templateId: CampaignSendKind
): CampaignNature =>
  settings[campaignNatureSettingKeyOf(templateId)]?.value === 'statutaire'
    ? 'statutaire'
    : DEFAULT_CAMPAIGN_NATURE

/**
 * Les types d'envoi statutaires de l'association, dans l'ordre des modeles,
 * puis la relance automatique (s29).
 */
export const getStatutoryTemplateIds = (
  settings: ResolvedAssociationSettings
): CampaignSendKind[] =>
  CAMPAIGN_SEND_KINDS.filter(
    (templateId) => getCampaignNature(settings, templateId) === 'statutaire'
  )

/**
 * Le decalage du cadre de l'adresse du courrier (s28, ADR 067 §4), en mm :
 * valeurs de l'association, sinon 0.
 */
export const getLetterAddressOffset = (
  settings: ResolvedAssociationSettings
): {xMm: number; yMm: number} => ({
  xMm: numberSettingOf(settings, LETTER_ADDRESS_OFFSET_X_SETTING_KEY),
  yMm: numberSettingOf(settings, LETTER_ADDRESS_OFFSET_Y_SETTING_KEY),
})

/**
 * La relance automatique des impayes en vigueur (s29, ADR 070 §7) : activee
 * seulement si le reglage le dit **et** que les intervalles, l'objet et le
 * texte sont renseignes ; les intervalles lus sont rendus meme desactivee,
 * pour l'annonce du calendrier.
 */
export type UnpaidReminderSettings =
  | {enabled: false; delaysWeeks: readonly number[] | null}
  | {
      enabled: true
      delaysWeeks: readonly number[]
      subject: string
      body: string
    }

export const getUnpaidReminderSettings = (
  settings: ResolvedAssociationSettings
): UnpaidReminderSettings => {
  const delays = BILLING_REMINDER_DELAY_WEEKS_SETTING_KEYS.map(
    (key) => settings[key]?.value
  )
  const delaysWeeks = delays.every((value) => typeof value === 'number')
    ? (delays as number[])
    : null
  const subject = textSettingOf(settings, BILLING_REMINDER_SUBJECT_SETTING_KEY)
  const body = textSettingOf(settings, BILLING_REMINDER_BODY_SETTING_KEY)
  if (
    settings[BILLING_REMINDER_ENABLED_SETTING_KEY]?.value !== true ||
    !delaysWeeks ||
    !subject ||
    !body
  ) {
    return {enabled: false, delaysWeeks}
  }
  return {enabled: true, delaysWeeks, subject, body}
}

/**
 * Texte de l'invitation d'un membre (s42a) : `null` quand le bureau ne l'a pas
 * renseigne ; l'email reprend alors le texte par defaut de `messages/fr.json`.
 */
export const getInvitationText = (
  settings: ResolvedAssociationSettings
): string | null => textSettingOf(settings, INVITATION_TEXT_SETTING_KEY) ?? null

/**
 * Jours de validite du lien d'une invitation (s42a, ADR 071) : valeur du
 * bureau, sinon defaut du registre.
 */
export const getInvitationLinkDays = (
  settings: ResolvedAssociationSettings
): number => numberSettingOf(settings, INVITATION_LINK_DAYS_SETTING_KEY)

/**
 * Texte du courrier de lancement (s42b, ADR 072 §6) : `null` quand le bureau
 * ne l'a pas renseigne ; le courrier reprend alors le texte par defaut de
 * `messages/fr.json`.
 */
export const getInvitationLetterText = (
  settings: ResolvedAssociationSettings
): string | null =>
  textSettingOf(settings, INVITATION_LETTER_TEXT_SETTING_KEY) ?? null
