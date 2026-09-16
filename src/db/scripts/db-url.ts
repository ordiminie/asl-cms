// L'index signature n'est pas decorative : sans elle le type est « faible »
// (toutes proprietes optionnelles) et TypeScript refuse `process.env`, dont le
// type `ProcessEnv` n'a aucune propriete declaree en commun (TS2559).
type DatabaseUrlEnv = {
  readonly DATABASE_MIGRATION_URL?: string
  readonly DATABASE_URL?: string
  readonly [key: string]: string | undefined
}

const trimmed = (value?: string) => {
  const candidate = value?.trim()
  return candidate ? candidate : undefined
}

/**
 * URL de connexion des migrations et du seed.
 *
 * Ces deux chemins créent et possèdent les objets du schéma : ils s'exécutent
 * sous le rôle propriétaire (`DATABASE_MIGRATION_URL`), là où l'application
 * tourne sous le rôle applicatif `asl_app`, soumis à la RLS (ADR 002).
 * La retombée sur `DATABASE_URL` garde les environnements qui n'ont pas encore
 * deux rôles fonctionnels ; elle échoue bruyamment côté Postgres si le rôle
 * applicatif ne possède pas les objets.
 */
export const resolveMigrationUrl = (env: DatabaseUrlEnv): string => {
  const url = trimmed(env.DATABASE_MIGRATION_URL) ?? trimmed(env.DATABASE_URL)

  if (!url) {
    throw new Error('DATABASE_MIGRATION_URL or DATABASE_URL must be defined')
  }

  return url
}
