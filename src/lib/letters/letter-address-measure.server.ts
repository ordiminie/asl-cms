import 'server-only'

import {fitAddressLines} from './letter-address-fit'
import {letterFontFilesOf} from './letter-fonts.server'
import {
  addressWidthOf,
  createLetterDocument,
  LetterDocument,
} from './letter-pdf-document'

/**
 * La mesure du bloc adresse avant la generation (s28, M1) : la carte du
 * courrier signale une lettre dont l'adresse ne tient pas dans le cadre,
 * mesuree sur la meme police et par la meme regle que le PDF. Un document de
 * mesure par processus, jamais rendu, sans cache de mise en page : les mots
 * des adresses de tous les tenants ne s'y accumulent pas (m5).
 */
let measuring: LetterDocument | undefined

export const letterAddressFitsWindow = (lines: readonly string[]): boolean => {
  measuring ??= createLetterDocument(letterFontFilesOf(), {layoutCache: false})
  return fitAddressLines(lines, addressWidthOf(measuring)).fits
}
