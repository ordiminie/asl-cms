/**
 * Fiches du bureau (s06) — module isomorphe : les regles pures servent au
 * service, au DAL, au formulaire et a la page publique, sans dependance
 * serveur.
 *
 * « Role » designe ici le role **affiche** (Presidente, Tresorier…), texte
 * libre, et jamais le role d'autorisation `board`.
 */

export type BoardMemberDTO = {
  id: string
  organizationId: string
  name: string
  roleLabel: string
  photoKey: string | null
  biography: string
  rank: number
}

/**
 * Une photo refusee est **un resultat**, pas une exception : le formulaire
 * garde ses valeurs et affiche la raison, et rien n'est ecrit.
 */
export type BoardMemberMutationResult =
  | {status: 'saved'; member: BoardMemberDTO}
  | {status: 'rejected'; reason: 'format'}
  | {status: 'rejected'; reason: 'size'; size: number; maxBytes: number}

export const BOARD_MEMBER_NAME_MAX_LENGTH = 120
export const BOARD_MEMBER_ROLE_LABEL_MAX_LENGTH = 120
export const BOARD_MEMBER_BIOGRAPHY_MAX_LENGTH = 500

/** L'emplacement de la photo dans la cle de fichier de contenu (ADR 023). */
export const BOARD_MEMBER_PHOTO_SLOT = 'photo'

/** Le plus grand rendu d'un portrait, en public sur poste fixe (§3.9). */
export const PORTRAIT_RENDERED_SIZE = 128

/**
 * Cote du carre stocke (ADR 024) : `PORTRAIT_RENDERED_SIZE` jusqu'a 4× de
 * densite d'ecran. Au-dela, on stockerait des octets que personne n'affiche.
 */
export const PORTRAIT_STORED_SIZE = 512

/**
 * Initiales d'une personne pour le repli de photo (design system §3.9) :
 * initiale du prenom et initiale du nom, un nom d'un seul mot donnant ses deux
 * premieres lettres. Les accents sont conserves — ce sont des lettres, pas du
 * bruit a normaliser.
 *
 * Distinct de `getAssociationMonogram`, dont la regle ignore un « ASL » en
 * tete : celui-la nomme une association, celui-ci une personne.
 */
export const getPersonInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''

  const first = [...words[0]]
  const last = [...words[words.length - 1]]
  const letters = words.length === 1 ? first.slice(0, 2) : [first[0], last[0]]

  return letters.join('').toLocaleUpperCase('fr-FR')
}

/**
 * Texte alternatif d'un portrait, **deduit du nom** : aucun champ a saisir.
 * Source unique de la phrase, employee par la page publique comme par la ligne
 * qui l'annonce dans le formulaire.
 */
export const buildPortraitAlt = (name: string): string =>
  `Portrait de ${name.trim()}`
