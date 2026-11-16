/**
 * « Mes adresses email » (s54, ecran 1) : le resultat des actions du membre,
 * partage par la carte et par les actions serveur. La validation du champ est
 * celle des adresses du bureau (`createMemberEmailFormSchema`).
 */

/** Champs envoyes : l'adresse saisie et, pour Modifier / Gerer, la ligne. */
export const MY_EMAIL_FORM_FIELDS = {
  email: 'email',
  emailId: 'emailId',
} as const

export type MyEmailActionResult =
  | {status: 'sent'; email: string; expiresAt: string}
  | {status: 'deferred'; email: string; expiresAt: string}
  | {status: 'invalid'; message: string}
  | {status: 'already_listed'}
  | {status: 'taken'}
  | {status: 'cancelled'}
  | {status: 'error'; message: string}

export type MyEmailFormAction = (
  prevState: MyEmailActionResult | undefined,
  formData: FormData
) => Promise<MyEmailActionResult>

/** Les quatre actions de la carte. */
export type MyEmailActions = {
  addEmailAction: MyEmailFormAction
  updateEmailAction: MyEmailFormAction
  correctEmailAction: MyEmailFormAction
  cancelEmailAction: MyEmailFormAction
}
