import {AsyncLocalStorage} from 'node:async_hooks'

import {sql} from 'drizzle-orm'

import db from './models/db'

/**
 * Le client Drizzle vu par les repositories : soit le client du pool, soit la
 * transaction du scope de tenant courant. Les deux doivent porter la meme
 * surface (`.query` relationnelle, `.select`, `.insert`, `.execute`), d'ou le
 * cast : `NodePgDatabase` et `PgTransaction` ne sont pas le meme type pour
 * TypeScript, alors qu'ils le sont pour tous les appels des repositories.
 */
export type ScopedDb = typeof db

type TenantScope = {
  db: ScopedDb
  /**
   * Valeurs des reglages poses par les scopes ouverts. Sert a rendre au scope
   * externe SA valeur quand un scope imbrique se referme.
   */
  settings: Readonly<Record<string, string>>
}

const tenantScopeStorage = new AsyncLocalStorage<TenantScope>()

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * `set_config(name, value, true)` et non `SET LOCAL` : `SET LOCAL` ne se
 * parametre pas (`PREPARE t1(text) AS SET LOCAL app.organization_id = $1` rend
 * `syntax error at or near "SET"`, mesure), et interpoler la valeur dans la
 * chaine serait une injection. Le troisieme argument `true` donne la portee
 * transactionnelle : le reglage meurt avec la transaction, donc aucune fuite
 * vers la requete suivante du pool.
 */
const setScopeSetting = async (
  scoped: ScopedDb,
  setting: string,
  value: string
) => {
  await scoped.execute(sql`select set_config(${setting}, ${value}, true)`)
}

/**
 * Scope imbrique : le reglage est pose dans la transaction DEJA ouverte, puis
 * **restaure** a la sortie.
 *
 * Les deux moities de cette fonction repondent au meme piege, mesure en base :
 * la portee de `set_config(..., true)` est la **transaction**, pas le
 * savepoint. Reouvrir une transaction depuis le pool donnerait deux sessions
 * Postgres (deux connexions retenues, et un scope imbrique aveugle aux
 * ecritures du scope externe) ; s'appuyer sur le savepoint que Drizzle ouvre
 * pour une transaction imbriquee laisserait le reglage interne **survivre** au
 * `release savepoint` — verifie :
 *
 *     begin; select set_config('app.organization_id','AAAA',true);
 *     savepoint sp1; select set_config('app.organization_id','BBBB',true);
 *     release savepoint sp1;
 *     select current_setting('app.organization_id', true);  -->  BBBB
 *
 * Le scope externe lirait alors les lignes du mauvais tenant, sans rien
 * signaler : l'inverse exact de la garantie du projet (« un oubli de scope ne
 * fuite pas : il ne retourne rien »). D'ou la restauration explicite, en
 * `finally`.
 *
 * La chaine vide restaure l'etat « non pose » : la policy lit
 * `NULLIF(current_setting(...), '')`, qui la traite comme absente.
 */
const runInNestedScope = async <T>(
  current: TenantScope,
  setting: string,
  value: string,
  callback: () => Promise<T>
): Promise<T> => {
  const previous = current.settings[setting] ?? ''

  await setScopeSetting(current.db, setting, value)

  try {
    return await tenantScopeStorage.run(
      {db: current.db, settings: {...current.settings, [setting]: value}},
      callback
    )
  } finally {
    await setScopeSetting(current.db, setting, previous)
  }
}

/**
 * Ouvre une transaction, y pose un reglage local, et publie la transaction
 * dans l'`AsyncLocalStorage` pour que `getDb()` la retrouve (ADR 002). Dans un
 * scope deja ouvert, reutilise sa transaction (voir `runInNestedScope`).
 */
const runInTenantScope = async <T>(
  setting: string,
  value: string,
  callback: () => Promise<T>
): Promise<T> => {
  const current = tenantScopeStorage.getStore()
  if (current) {
    return runInNestedScope(current, setting, value, callback)
  }

  return db.transaction(async (transaction) => {
    const scoped = transaction as unknown as ScopedDb

    await setScopeSetting(scoped, setting, value)

    return tenantScopeStorage.run(
      {db: scoped, settings: {[setting]: value}},
      callback
    )
  })
}

/**
 * Le client Drizzle a utiliser dans un repository. Jamais `db` directement :
 * hors scope de tenant, une table couverte par une policy ne rend rien.
 */
export const getDb = (): ScopedDb => tenantScopeStorage.getStore()?.db ?? db

/**
 * Execute `callback` avec le tenant courant pose en base. Tout chemin serveur
 * touchant une table metier passe par la.
 */
export const withTenant = async <T>(
  organizationId: string,
  callback: () => Promise<T>
): Promise<T> => {
  if (!UUID_PATTERN.test(organizationId)) {
    throw new Error('withTenant requires a valid organization id')
  }

  return runInTenantScope('app.organization_id', organizationId, callback)
}

/**
 * La seule porte derobee du systeme : leve l'isolation pour le SuperAdmin
 * Zourite Studio. Reservee au provisioning (s01) et a la simulation de role
 * (s41). Toute nouvelle occurrence dans un diff est un point d'arret de revue.
 */
export const withRlsBypass = async <T>(
  callback: () => Promise<T>
): Promise<T> => runInTenantScope('app.bypass_rls', 'on', callback)
