/**
 * Types de domaine des adresses d'une fiche (s54, ADR 056). Ecrits sans
 * importer le modele Drizzle (`rule-architecture`).
 */

/** Role d'une adresse **sur une fiche** : titulaire ou supplementaire. */
export type MemberEmailRole = 'holder' | 'additional'

/** `pending` tant que le lien de confirmation n'est pas clique. */
export type MemberEmailStatus = 'active' | 'pending'

/** Fichier Pennylane (import) ou saisie sur le site (bureau, membre). */
export type MemberEmailOrigin = 'file' | 'site'

export const MemberEmailRoleConst = {
  HOLDER: 'holder',
  ADDITIONAL: 'additional',
} as const satisfies Record<string, MemberEmailRole>

export const MemberEmailStatusConst = {
  ACTIVE: 'active',
  PENDING: 'pending',
} as const satisfies Record<string, MemberEmailStatus>

export const MemberEmailOriginConst = {
  FILE: 'file',
  SITE: 'site',
} as const satisfies Record<string, MemberEmailOrigin>

/** Une adresse d'une fiche, telle que les regles pures la lisent. */
export type MemberEmailRecord = {
  id: string
  email: string
  role: MemberEmailRole
  status: MemberEmailStatus
  /** L'auteur d'un ajout par le membre ; nul pour le fichier et le bureau. */
  addedByUserId: string | null
  /** L'adresse qu'une modification en attente remplacera. */
  replacesEmailId: string | null
  /** Echeance d'une adresse en attente ; nulle pour une adresse active. */
  expiresAt: Date | null
}

/**
 * Remplacante designee par le bureau quand il retire la titulaire (critere
 * 9) : une adresse active de la fiche, une nouvelle adresse, ou aucune (seule
 * la derniere adresse active se retire sans remplacante).
 */
export type MemberEmailReplacement =
  | {kind: 'existing'; emailId: string}
  | {kind: 'new'; email: string}
  | {kind: 'none'}

export type MemberEmailRemovalPlan =
  | {
      ok: true
      removeEmailId: string
      /** Adresse active existante qui prend le titre. */
      promoteEmailId?: string
      /** Nouvelle adresse saisie qui devient titulaire. */
      addHolderEmail?: string
      /** La derniere adresse active part : la fiche passe en courrier. */
      mailOnly?: true
    }
  | {
      ok: false
      reason:
        | 'not_found'
        | 'replacement_required'
        | 'invalid_replacement'
        | 'already_listed'
    }

export type MemberEmailDesignationPlan =
  | {ok: true; promoteEmailId: string; demoteEmailId: string | null}
  | {ok: false; reason: 'not_found' | 'not_active' | 'already_holder'}

/** Ce que l'activation d'une adresse en attente fait de la fiche. */
export type MemberEmailConfirmationPlan = {
  role: MemberEmailRole
  /** L'adresse remplacee par une modification, retiree a la confirmation. */
  removeEmailId: string | null
  demoteEmailId: string | null
}

/** Ajout par le membre (critere 7) : accepte, deja liste, ou porte ailleurs. */
export type MemberEmailAdditionDecision = 'ok' | 'already_listed' | 'taken'

/**
 * Confirmation par lien : valide, inutilisable (3c), prise (3d), ou
 * retiree a son auteur, qui n'est plus relie aux fiches (revue C1).
 */
export type MemberEmailConfirmationDecision =
  'ok' | 'invalid' | 'taken' | 'revoked'

/** Une demande de la page publique : l'association du domaine et le jeton. */
export type MemberEmailConfirmationRequest = {
  organizationId: string
  token: string
}

/** L'etat de la page publique (3a, 3c), lu sans rien ecrire. */
export type MemberEmailConfirmationStateDTO =
  | {status: 'confirm'; email: string; parcelNumbers: string[]}
  | {status: 'invalid'}
  | {status: 'revoked'}

/** L'issue du bouton « Confirmer cette adresse » (3b, 3c, 3d). */
export type ConfirmMemberEmailResult =
  | {status: 'confirmed'; replaced: boolean}
  | {status: 'invalid'}
  | {status: 'taken'}
  | {status: 'revoked'}

/**
 * Une adresse de « Mes adresses email » (s54, ecran 1), resolue par la
 * session : aucun identifiant de fiche. Seule une attente ajoutee par la
 * personne connectee porte son identifiant, que le serveur revérifie contre
 * l'auteur.
 */
export type MyEmailDTO = {
  email: string
  status: MemberEmailStatus
  /** L'adresse de la personne connectee (« Votre adresse »). */
  own: boolean
  /** Titulaire d'au moins un des terrains (`meta` seulement, critere 2). */
  holder: boolean
  /** L'attente ajoutee par la personne connectee : Corriger / Annuler. */
  pendingId: string | null
  /** Sa propre adresse active, a modifier (« Modifier ») ; nul sinon. */
  ownEmailId: string | null
  /** Une modification de sa propre adresse, en attente. */
  replacesOwn: boolean
  /** Envoi et echeance du lien d'une attente (ISO) ; nuls sinon. */
  sentAt: string | null
  expiresAt: string | null
  /**
   * Les parcelles des seuls terrains qui la portent, quand elle ne vaut pas
   * pour tous ; nul sinon.
   */
  onlyParcelNumbers: string[] | null
}

export type MyEmailsDTO = {
  emails: MyEmailDTO[]
  /** Nombre de terrains du compte : « Elles valent pour vos {n} terrains. » */
  landCount: number
  /** Jours de validite d'un lien (parametre du tenant). */
  confirmationDays: number
}

/** Ajout d'une adresse par le membre (1b). */
export type AddMyEmailInput = {
  organizationId: string
  email: string
  locale?: string
}

/** Modification de sa propre adresse (1e), designee par son identifiant. */
export type UpdateMyEmailInput = AddMyEmailInput & {emailId: string}

/** Correction d'une attente dont la personne connectee est l'autrice. */
export type CorrectMyPendingEmailInput = AddMyEmailInput & {emailId: string}

export type CancelMyPendingEmailInput = {
  organizationId: string
  emailId: string
}

/**
 * Ecriture du membre : lien envoye (1c), ou reporte au lendemain faute de
 * budget (1f) ; refus du critere 7, sans nommer personne (1d).
 */
export type MyEmailWriteResult =
  | {status: 'sent'; email: string; expiresAt: string}
  | {status: 'deferred'; email: string; expiresAt: string}
  | {status: 'already_listed'}
  | {status: 'taken'}
  | {status: 'not_found'}

export type CancelMyPendingEmailResult = {status: 'cancelled'}
