import {ORGANIZATION_MODULES} from '@/services/types/domain/organization-types'

/**
 * Normalise l'en-tete `Host` en domaine comparable a `organization.domain`.
 *
 * Le port est retire parce que le `Host` le porte des que le service n'ecoute
 * pas sur 80 ou 443 — c'est le cas de tout developpement et de la suite e2e.
 * La casse est abaissee parce qu'un nom d'hote y est insensible alors qu'une
 * colonne `text` ne l'est pas. Le point final est la forme absolue du DNS.
 */
export const normalizeTenantHost = (
  host: string | null | undefined
): string | undefined => {
  const candidate = host?.trim().toLowerCase()
  if (!candidate) {
    return undefined
  }

  // Une adresse IPv6 litterale garde ses crochets : c'est la partie « hote »
  // du Host, le port vient apres le crochet fermant.
  const withoutPort = candidate.startsWith('[')
    ? `${candidate.split(']')[0] ?? ''}]`
    : (candidate.split(':')[0] ?? '')

  const normalized = withoutPort.replace(/\.$/, '')

  return normalized === '' || normalized === ']' ? undefined : normalized
}

/**
 * Un module est actif si et seulement si sa cle est **connue** et presente
 * dans les drapeaux de l'association. Une cle inconnue est inactive (ADR 010),
 * jamais active par defaut : c'est ce qui rend le critere 4 vrai pour un
 * module fictif comme pour un module reel desactive.
 */
export const isModuleEnabled = (
  enabledModules: readonly string[],
  moduleKey: string
): boolean =>
  (ORGANIZATION_MODULES as readonly string[]).includes(moduleKey) &&
  enabledModules.includes(moduleKey)
