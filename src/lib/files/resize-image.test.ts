import sharp from 'sharp'
import {describe, expect, it} from 'vitest'

import {resizeToSquareWebp} from './resize-image'

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
})
