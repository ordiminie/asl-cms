import 'server-only'

import {readFileSync} from 'node:fs'
import {join} from 'node:path'

/**
 * Les polices du courrier (ADR 066 §3) : celles du site, lues sur le disque,
 * jamais telechargees. Public Sans vient du woff2 deja heberge (licence OFL),
 * dont on embarque une instance nommee ; le woff2 de Source Serif 4 n'en ayant
 * aucune, sa graisse 600 vient du TTF verse au depot pour l'image de partage
 * (`src/assets/fonts/OFL.txt`).
 */
export type LetterFontFiles = {sans: Buffer; serifSemiBold: Buffer}

const FONT_PATHS = {
  sans: 'src/app/[locale]/fonts/public-sans-latin.woff2',
  serifSemiBold: 'src/assets/fonts/SourceSerif4-SemiBold.ttf',
} as const

let loaded: LetterFontFiles | undefined

/** Les fichiers de police, lus une fois par processus. */
export const letterFontFilesOf = (): LetterFontFiles => {
  loaded ??= {
    sans: readFileSync(join(process.cwd(), FONT_PATHS.sans)),
    serifSemiBold: readFileSync(join(process.cwd(), FONT_PATHS.serifSemiBold)),
  }
  return loaded
}
