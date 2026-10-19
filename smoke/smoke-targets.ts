/**
 * Cibles du test de fumee (s12b), passees en variables d'environnement : le
 * depot est public, aucun domaine n'y est ecrit.
 */
export type SmokeAssociation = {domain: string; name: string}

export type SmokeTargets = {
  associations: [SmokeAssociation, SmokeAssociation]
  /** Domaine route par nginx, avec certificat, mais sans association. */
  unknownDomain: string
}

const VARIABLES = [
  'SMOKE_DOMAIN_A',
  'SMOKE_DOMAIN_B',
  'SMOKE_NAME_A',
  'SMOKE_NAME_B',
  'SMOKE_UNKNOWN_DOMAIN',
] as const

const DOMAIN_VARIABLES = new Set<string>([
  'SMOKE_DOMAIN_A',
  'SMOKE_DOMAIN_B',
  'SMOKE_UNKNOWN_DOMAIN',
])

const HOSTNAME =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i

export const readSmokeTargets = (
  env: Record<string, string | undefined>
): SmokeTargets => {
  const values = Object.fromEntries(
    VARIABLES.map((name) => [name, env[name]?.trim() ?? ''])
  ) as Record<(typeof VARIABLES)[number], string>

  const missing = VARIABLES.filter((name) => values[name] === '')
  if (missing.length > 0) {
    throw new Error(
      `Variables du test de fumee manquantes : ${missing.join(', ')}`
    )
  }

  const malformed = VARIABLES.filter(
    (name) => DOMAIN_VARIABLES.has(name) && !HOSTNAME.test(values[name])
  )
  if (malformed.length > 0) {
    throw new Error(
      `Nom d'hote attendu, sans protocole ni chemin : ${malformed.join(', ')}`
    )
  }

  if (
    values.SMOKE_DOMAIN_A === values.SMOKE_DOMAIN_B ||
    values.SMOKE_NAME_A === values.SMOKE_NAME_B
  ) {
    throw new Error(
      'Les deux associations doivent avoir des domaines et des noms distincts'
    )
  }

  return {
    associations: [
      {domain: values.SMOKE_DOMAIN_A, name: values.SMOKE_NAME_A},
      {domain: values.SMOKE_DOMAIN_B, name: values.SMOKE_NAME_B},
    ],
    unknownDomain: values.SMOKE_UNKNOWN_DOMAIN,
  }
}
