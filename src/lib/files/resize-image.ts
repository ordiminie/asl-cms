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
 * Leve si les octets ne sont pas une image que `sharp` sait decoder. L'echec
 * est bruyant, jamais un fichier vide ecrit en silence.
 */
export const resizeToSquareWebp = async (
  content: Uint8Array,
  size: number
): Promise<Uint8Array> => {
  const output = await sharp(Buffer.from(content))
    .resize(size, size, {fit: 'cover', position: 'centre'})
    .webp()
    .toBuffer()

  return new Uint8Array(output)
}
