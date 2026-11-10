import {getIdentityVersionFromKey} from '@/services/types/domain/association-identity-types'

/**
 * L'adresse absolue du logo de l'association, pour un email. Seul un PNG est
 * servi : la plupart des clients de messagerie n'affichent pas le WebP. Sans
 * PNG, l'email porte le nom seul (design system §5).
 */
export const pngLogoUrlOf = (
  logoKey: string | null | undefined,
  origin: string
): string | undefined => {
  const version = getIdentityVersionFromKey(logoKey)
  if (!version || !logoKey?.endsWith('.png')) return undefined
  return `${origin}/api/identity/logo?v=${encodeURIComponent(version)}`
}
