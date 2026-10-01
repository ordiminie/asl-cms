import {readFile} from 'node:fs/promises'
import {join} from 'node:path'

import {ImageResponse} from 'next/og'

import {getAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {getCurrentTenantDal, TenantDTO} from '@/app/dal/tenant-dal'
import {convertToPng} from '@/lib/files/resize-image'
import {shareImageNameKey} from '@/lib/seo/resolve-metadata'
import {
  getShareImageColors,
  SHARE_IMAGE_MONOGRAM_TEXT,
  ShareImageColors,
} from '@/lib/seo/share-image-colors'
import {readAssociationIdentityFileService} from '@/services/facades/association-identity-service-facade'
import {
  getAssociationMonogram,
  getIdentityVersionFromKey,
} from '@/services/types/domain/association-identity-types'
import {getAccentHue} from '@/services/types/domain/association-settings-types'
import {
  SHARE_IMAGE_HEIGHT,
  SHARE_IMAGE_WIDTH,
} from '@/services/types/domain/seo-types'

const LONG_CACHE = 'public, max-age=31536000, immutable'
const REVALIDATE_CACHE = 'public, no-cache'

/** Gabarit du design system (§9) : marges, logo, ecart et corps du nom. */
const MARGIN = 64
const MARK_SIZE = 240
const MARK_GAP = 40
const NAME_SIZE = 72
const NAME_MAX_LINES = 2
const FONT_NAME = 'Source Serif 4'
const FONT_WEIGHT = 600

/**
 * Police versee au depot (licence OFL, `src/assets/fonts/OFL.txt`) : lue sur
 * le disque, jamais telechargee a l'execution.
 */
const FONT_PATH = join(
  process.cwd(),
  'src/assets/fonts/SourceSerif4-SemiBold.ttf'
)

const notFound = () =>
  new Response(null, {
    status: 404,
    headers: {'X-Content-Type-Options': 'nosniff'},
  })

/**
 * Le logo en `data:` PNG, ou rien sans logo lisible. Le moteur de rendu ne
 * lit pas le WebP : il est converti.
 */
const readLogoDataUrl = async (
  tenant: TenantDTO
): Promise<string | undefined> => {
  if (!tenant.logoKey) return undefined
  try {
    const stored = await readAssociationIdentityFileService(
      tenant.id,
      'logo',
      tenant.logoKey
    )
    const bytes = new Uint8Array(await stored.content.arrayBuffer())
    const png =
      stored.contentType === 'image/png' ? bytes : await convertToPng(bytes)
    return `data:image/png;base64,${Buffer.from(png).toString('base64')}`
  } catch {
    return undefined
  }
}

const isCurrentKey = (
  request: Request,
  logoVersion: string | undefined,
  hue: number,
  name: string
): boolean => {
  const query = new URL(request.url).searchParams
  return (
    query.get('h') === String(hue) &&
    (query.get('v') ?? undefined) === logoVersion &&
    query.get('n') === shareImageNameKey(name)
  )
}

/**
 * Le gabarit, en elements simples : fond `surface`, logo ou monogramme
 * centre, le nom dessous en encre de la teinte. Rien d'autre.
 */
const shareImageElement = ({
  name,
  logoDataUrl,
  colors,
}: {
  name: string
  logoDataUrl: string | undefined
  colors: ShareImageColors
}) => (
  <div
    style={{
      backgroundColor: colors.surface,
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: MARGIN,
      gap: MARK_GAP,
    }}
  >
    {logoDataUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoDataUrl}
        alt=""
        width={MARK_SIZE}
        height={MARK_SIZE}
        style={{objectFit: 'contain'}}
      />
    ) : (
      <div
        style={{
          width: MARK_SIZE,
          height: MARK_SIZE,
          borderRadius: 24,
          backgroundColor: colors.solid,
          color: SHARE_IMAGE_MONOGRAM_TEXT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: MARK_SIZE / 2,
        }}
      >
        {getAssociationMonogram(name)}
      </div>
    )}
    <div
      style={{
        color: colors.ink,
        fontSize: NAME_SIZE,
        lineHeight: 1.15,
        textAlign: 'center',
        display: 'block',
        lineClamp: NAME_MAX_LINES,
      }}
    >
      {name}
    </div>
  </div>
)

/**
 * Image de partage de repli de l'association du domaine appele (s11, design
 * ecran 3) : 1200 x 630, rendue par `next/og`. Le tenant vient du domaine,
 * le logo de la base ; rien n'est lu depuis la requete hors la cle de cache.
 * Cache long seulement quand `?v=&h=&n=` portent la version du logo, la
 * teinte et l'empreinte du nom en vigueur, pour qu'un changement s'affiche
 * aussitot.
 */
export async function GET(request: Request): Promise<Response> {
  const tenant = await getCurrentTenantDal()
  if (!tenant) {
    return notFound()
  }

  const [settings, logoDataUrl, font] = await Promise.all([
    getAssociationSettingsDal(tenant.id),
    readLogoDataUrl(tenant),
    readFile(FONT_PATH),
  ])
  const hue = getAccentHue(settings)
  const logoVersion = getIdentityVersionFromKey(tenant.logoKey)

  return new ImageResponse(
    shareImageElement({
      name: tenant.name,
      logoDataUrl,
      colors: getShareImageColors(hue),
    }),
    {
      width: SHARE_IMAGE_WIDTH,
      height: SHARE_IMAGE_HEIGHT,
      fonts: [
        {
          name: FONT_NAME,
          data: font.buffer.slice(
            font.byteOffset,
            font.byteOffset + font.byteLength
          ) as ArrayBuffer,
          weight: FONT_WEIGHT,
          style: 'normal',
        },
      ],
      headers: {
        'Cache-Control': isCurrentKey(request, logoVersion, hue, tenant.name)
          ? LONG_CACHE
          : REVALIDATE_CACHE,
        'X-Content-Type-Options': 'nosniff',
      },
    }
  )
}
