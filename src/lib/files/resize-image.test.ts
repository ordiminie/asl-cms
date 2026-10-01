import sharp from 'sharp'
import {describe, expect, it} from 'vitest'

import {convertToPng, resizeToFitWebp, resizeToSquareWebp} from './resize-image'

/**
 * Preuve du critere 2 de s06 et de l'ADR 024 : le redimensionnement s'execute
 * sur de **vrais octets**, `sharp` n'est pas double. Un `sharp` mocke ne
 * prouverait rien du fichier servi.
 */
const makePng = async (
  width: number,
  height: number,
  channel = 200
): Promise<Uint8Array> =>
  new Uint8Array(
    await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: {r: channel, g: 120, b: 60},
      },
    })
      .png()
      .toBuffer()
  )

const describeOutput = async (bytes: Uint8Array) =>
  sharp(Buffer.from(bytes)).metadata()

/**
 * Portrait pris au telephone : les octets sont en paysage et un marqueur EXIF
 * `orientation: 6` demande une rotation de 90 deg a l'affichage. La moitie
 * haute des octets est rouge, la moitie basse bleue ; une fois redressee,
 * l'image doit donc etre bleue a gauche et rouge a droite. Sans redressement,
 * l'inversion est exactement contraire — c'est ce qui distingue les deux.
 */
const makePngOrientedRight = async (side: number): Promise<Uint8Array> => {
  const raw = Buffer.alloc(side * side * 3)
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const offset = (y * side + x) * 3
      if (y < side / 2) {
        raw[offset] = 255
      } else {
        raw[offset + 2] = 255
      }
    }
  }

  return new Uint8Array(
    await sharp(raw, {raw: {width: side, height: side, channels: 3}})
      .withMetadata({orientation: 6})
      .jpeg()
      .toBuffer()
  )
}

const samplePixel = async (
  bytes: Uint8Array,
  left: number,
  top: number
): Promise<{red: number; blue: number}> => {
  const {data} = await sharp(Buffer.from(bytes))
    .raw()
    .extract({left, top, width: 1, height: 1})
    .toBuffer({resolveWithObject: true})

  return {red: data[0], blue: data[2]}
}

describe('resizeToSquareWebp (ADR 024)', () => {
  it('rend un WebP carré de 512 px depuis un PNG paysage de 800×600', async () => {
    const output = await resizeToSquareWebp(await makePng(800, 600), 512)
    const metadata = await describeOutput(output)

    expect(metadata.format).toBe('webp')
    expect(metadata.width).toBe(512)
    expect(metadata.height).toBe(512)
  })

  it('agrandit un carré de 400 px jusqu’à la taille demandée', async () => {
    const output = await resizeToSquareWebp(await makePng(400, 400), 512)
    const metadata = await describeOutput(output)

    expect(metadata.width).toBe(512)
    expect(metadata.height).toBe(512)
  })

  it("rend une sortie plus petite qu'une entrée volumineuse", async () => {
    const original = await makePng(3000, 2000)
    const output = await resizeToSquareWebp(original, 512)

    expect(output.byteLength).toBeLessThan(original.byteLength)
  })

  it('lève sur des octets qui ne sont pas une image', async () => {
    await expect(
      resizeToSquareWebp(new TextEncoder().encode('pas une image'), 512)
    ).rejects.toThrow()
  })

  it('retire les métadonnées EXIF de la source', async () => {
    const withExif = new Uint8Array(
      await sharp({
        create: {
          width: 800,
          height: 800,
          channels: 3,
          background: {r: 10, g: 20, b: 30},
        },
      })
        .withExif({IFD0: {Copyright: 'Association de test'}})
        .jpeg()
        .toBuffer()
    )

    const metadata = await describeOutput(
      await resizeToSquareWebp(withExif, 512)
    )

    expect(metadata.exif).toBeUndefined()
  })

  it("redresse l'orientation EXIF d'un portrait pris au téléphone", async () => {
    const output = await resizeToSquareWebp(
      await makePngOrientedRight(600),
      512
    )

    const left = await samplePixel(output, 40, 100)
    const right = await samplePixel(output, 470, 400)

    expect(left.blue).toBeGreaterThan(200)
    expect(left.red).toBeLessThan(60)
    expect(right.red).toBeGreaterThan(200)
    expect(right.blue).toBeLessThan(60)
  })
})

describe('resizeToFitWebp — image de partage (s11)', () => {
  it('reduit une grande image dans le cadre, sans la recadrer ni la deformer', async () => {
    const output = await resizeToFitWebp(await makePng(2400, 1600), 1200, 630)

    const metadata = await describeOutput(output)
    expect(metadata.format).toBe('webp')
    expect(metadata.height).toBe(630)
    expect(metadata.width).toBe(945)
  })

  it('n agrandit pas une petite image', async () => {
    const output = await resizeToFitWebp(await makePng(600, 315), 1200, 630)

    const metadata = await describeOutput(output)
    expect(metadata.format).toBe('webp')
    expect(metadata.width).toBe(600)
    expect(metadata.height).toBe(315)
  })
})

describe('convertToPng — logo WebP pour l image de repli (s11)', () => {
  it('rend un PNG de memes dimensions', async () => {
    const webp = new Uint8Array(
      await sharp(Buffer.from(await makePng(320, 200)))
        .webp()
        .toBuffer()
    )

    const metadata = await describeOutput(await convertToPng(webp))
    expect(metadata.format).toBe('png')
    expect(metadata.width).toBe(320)
    expect(metadata.height).toBe(200)
  })
})

describe('convertToPng borne — logo de l image de repli (revue s11, m12)', () => {
  it('ramene un grand logo dans le carre demande, proportions gardees', async () => {
    const metadata = await describeOutput(
      await convertToPng(await makePng(4000, 2000), 480)
    )

    expect(metadata.format).toBe('png')
    expect(metadata.width).toBe(480)
    expect(metadata.height).toBe(240)
  })

  it('n agrandit jamais un petit logo', async () => {
    const metadata = await describeOutput(
      await convertToPng(await makePng(120, 80), 480)
    )

    expect(metadata.width).toBe(120)
    expect(metadata.height).toBe(80)
  })
})
