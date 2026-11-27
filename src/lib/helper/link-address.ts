/**
 * Liste blanche des adresses qu'un membre du bureau peut saisir pour un lien
 * (ADR 078, s50). Un seul predicat, pur et sans dependance : le formulaire
 * client, la Server Action, le service a l'ecriture **et** le service au rendu
 * (sous `'use cache'`, ni horloge ni `logger`) l'appellent tous.
 */

export type LinkAddressKind = 'internal' | 'external'

export type LinkAddressRefusal = 'empty' | 'http' | 'refused'

export type LinkAddressClassification =
  | {ok: true; kind: LinkAddressKind; address: string}
  | {ok: false; reason: LinkAddressRefusal}

/**
 * Caracteres de controle C0 et DEL : le parseur d'URL des navigateurs retire
 * ceux de tete et de queue et ignore les tabulations et retours a la ligne au
 * milieu — l'adresse suivie ne serait plus celle qu'on relit. Ils sont donc
 * cherches **avant** le `trim()`, qui les effacerait sans bruit.
 */
const CONTROL_CHARACTER = /[\u0000-\u001F\u007F]/

/**
 * Un espace au milieu n'est jamais une adresse que le bureau a voulu ecrire,
 * et une barre oblique inverse est lue comme `/` par le navigateur : `/\hote`
 * et `\\hote` deviendraient des adresses relatives au protocole, qui quittent
 * le site.
 */
const AMBIGUOUS_CHARACTER = /[\s\\]/

const isInternalPath = (address: string): boolean =>
  address.startsWith('/') && address[1] !== '/'

/**
 * `https://` litteral exige en tete : `https:/hote` serait complete par le
 * navigateur, et la valeur stockee ne serait plus celle qu'il suit. Les
 * identifiants sont refuses parce que l'hote reel de
 * `https://mairie.fr@autre.example` n'est pas celui qu'on lit.
 */
const isExternalHttpsAddress = (address: string): boolean => {
  if (!address.toLowerCase().startsWith('https://')) return false
  if (!URL.canParse(address)) return false

  const url = new URL(address)
  return (
    url.protocol === 'https:' &&
    url.hostname !== '' &&
    url.username === '' &&
    url.password === ''
  )
}

/**
 * Classe une adresse saisie : chemin interne (une seule `/` en tete) ou
 * adresse externe en `https://`. Tout le reste est refuse — jamais de liste
 * noire. L'adresse rendue est la saisie apres `trim()`, **jamais normalisee** :
 * c'est exactement celle que le navigateur suivra et que le bureau relira.
 *
 * `http://` a sa propre raison de refus (message dedie a l'ecran), sans etre
 * accepte pour autant.
 */
export const classifyLinkAddress = (raw: string): LinkAddressClassification => {
  if (raw.trim() === '') return {ok: false, reason: 'empty'}
  if (CONTROL_CHARACTER.test(raw)) return {ok: false, reason: 'refused'}

  const address = raw.trim()
  if (AMBIGUOUS_CHARACTER.test(address)) return {ok: false, reason: 'refused'}

  if (isInternalPath(address)) return {ok: true, kind: 'internal', address}
  if (isExternalHttpsAddress(address)) {
    return {ok: true, kind: 'external', address}
  }

  if (address.toLowerCase().startsWith('http://')) {
    return {ok: false, reason: 'http'}
  }
  return {ok: false, reason: 'refused'}
}
