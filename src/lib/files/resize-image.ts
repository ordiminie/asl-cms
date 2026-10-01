import sharp from 'sharp'

/**
 * Redimensionnement d'image a l'ecriture (ADR 024).
 *
 * Module sans dependance metier : il prend des octets et rend des octets. Il
 * ne connait ni les fiches du bureau ni les actualites — toute story qui
 * stockera une image pourra l'appeler avec ses propres dimensions.
 *
 * L'original n'est pas conserve : le fichier stocke est le fichier servi.
 */

/**
 * Rend un WebP carre de `size` px de cote, recadre au centre (`fit: cover`),
 * **sans metadonnee de la source** : un portrait pris au telephone porte
 * souvent la position GPS et le modele d'appareil, qui n'ont rien a faire sur
 * un site public.
 *
 * `rotate()` sans argument applique d'abord l'orientation EXIF : un portrait
 * pris au telephone est stocke en paysage avec un marqueur de rotation, que
 * `sharp` n'applique pas de lui-meme et que la sortie WebP ne conserve pas —
 * sans ce redressement, la photo serait servie couchee.
 *
 * Leve si les octets ne sont pas une image que `sharp` sait decoder. L'echec
 * est bruyant, jamais un fichier vide ecrit en silence.
 */
export const resizeToSquareWebp = async (
  content: Uint8Array,
  size: number
): Promise<Uint8Array> => {
  const output = await sharp(Buffer.from(content))
    .rotate()
    .resize(size, size, {fit: 'cover', position: 'centre'})
    .webp()
    .toBuffer()

  return new Uint8Array(output)
}

/**
 * Rend un WebP qui tient dans `width` x `height` px, **sans recadrage ni
 * agrandissement** (`fit: inside`) et sans metadonnee de la source. Sert
 * l'image de partage d'une page (s11) : les plateformes recadrent elles-memes,
 * l'image deposee n'est que bornee en poids et en dimensions.
 *
 * Leve si les octets ne sont pas une image que `sharp` sait decoder.
 */
export const resizeToFitWebp = async (
  content: Uint8Array,
  width: number,
  height: number
): Promise<Uint8Array> => {
  const output = await sharp(Buffer.from(content))
    .rotate()
    .resize(width, height, {fit: 'inside', withoutEnlargement: true})
    .webp()
    .toBuffer()

  return new Uint8Array(output)
}

/**
 * Rend les octets d'une image en PNG. Sert le logo de l'image de repli (s11) :
 * le moteur de rendu de `next/og` ne lit pas le WebP.
 *
 * Avec `maxSide`, la sortie tient dans un carre de `maxSide` px, sans recadrage
 * ni agrandissement : le logo est rendu a chaque requete, inutile de reencoder
 * et de redecoder un fichier de plusieurs milliers de pixels pour l'afficher
 * en 240 px. Sans `maxSide`, dimensions inchangees.
 */
export const convertToPng = async (
  content: Uint8Array,
  maxSide?: number
): Promise<Uint8Array> => {
  const image = sharp(Buffer.from(content))
  const bounded = maxSide
    ? image.resize(maxSide, maxSide, {fit: 'inside', withoutEnlargement: true})
    : image

  return new Uint8Array(await bounded.png().toBuffer())
}
