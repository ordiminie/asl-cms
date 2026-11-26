/**
 * Accès à une fiche après la vente (s57, ADR 075). Un état calculé à chaque
 * lecture depuis les périodes de propriété et le délai du tenant : rien
 * n'est stocké.
 */

/** Une période de propriété d'une fiche, demi-ouverte `[startsOn, endsOn)`. */
export type ProfileOwnershipPeriod = {
  startsOn: string
  endsOn: string | null
}

/**
 * État d'une fiche : `out_of_rule` sans aucune période, `owner` avec une
 * période ouverte, sinon `grace` tant que `today < closesOn`, puis `closed`.
 * `soldOn` est la fin de la dernière période, `closesOn` le premier jour
 * sans accès.
 */
export type ProfileAccess =
  | {status: 'out_of_rule'}
  | {status: 'owner'}
  | {status: 'grace'; soldOn: string; closesOn: string}
  | {status: 'closed'; soldOn: string; closesOn: string}

export type ProfileAccessStatus = ProfileAccess['status']

/**
 * La fin d'accès d'une fiche vendue, telle que le bureau la lit (s57, critère
 * 8) : le dernier jour ouvert pendant le délai, le premier jour fermé ensuite.
 * Nulle pour une fiche propriétaire ou hors règle.
 */
export type ProfileAccessWindow =
  | {status: 'grace'; soldOn: string; openUntil: string}
  | {status: 'closed'; soldOn: string; closedSince: string}
