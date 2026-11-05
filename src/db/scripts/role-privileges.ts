export type RolePrivileges = {
  rolname: string
  rolsuper: boolean
  rolbypassrls: boolean
}

/**
 * Verifie que le role applicatif est bien soumis a la RLS.
 *
 * C'est le garde-fou de l'echec le plus couteux de ce socle, parce qu'il est
 * **silencieux** : `FORCE ROW LEVEL SECURITY` ne contraint ni un role
 * SUPERUSER ni un role BYPASSRLS. Si `DATABASE_URL` pointe sur un tel role,
 * les policies existent, `pg_policies` les affiche, et l'isolation n'existe
 * pas. Aucun test ne peut l'attraper depuis l'application : seule la base sait
 * sous quel role elle est appelee (ADR 002).
 */
export const assertApplicationRolePrivileges = (
  role: RolePrivileges | undefined
): void => {
  if (!role) {
    throw new Error(
      "Le role de DATABASE_URL est introuvable dans pg_roles : impossible de verifier qu'il est soumis a la RLS."
    )
  }

  const privileges = [
    role.rolsuper ? 'SUPERUSER' : undefined,
    role.rolbypassrls ? 'BYPASSRLS' : undefined,
  ].filter(Boolean)

  if (privileges.length === 0) {
    return
  }

  throw new Error(
    `Le role applicatif « ${role.rolname} » porte ${privileges.join(' et ')} : ` +
      'FORCE ROW LEVEL SECURITY ne le contraint pas, donc toutes les policies ' +
      'de tenant sont posees et INERTES. Faire pointer DATABASE_URL sur un role ' +
      'non proprietaire (asl_app), et garder le role proprietaire pour ' +
      'DATABASE_MIGRATION_URL (ADR 002).'
  )
}

export type BackupRolePrivileges = RolePrivileges & {
  /** Objets de la base dont le role est proprietaire (`pg_class`, schemas). */
  ownedObjects: number
}

/**
 * Verifie le role de sauvegarde (`BACKUP_DATABASE_URL`, ADR 045) avant tout
 * `pg_dump`.
 *
 * Sans BYPASSRLS, `FORCE ROW LEVEL SECURITY` s'applique a `pg_dump` comme a
 * l'application : la sauvegarde echoue, ou ne contient aucune ligne metier.
 * Superuser, la minuterie aurait tous les pouvoirs sur la base ; proprietaire,
 * elle pourrait modifier ou supprimer ce qu'elle est censee seulement lire.
 */
export const assertBackupRolePrivileges = (
  role: BackupRolePrivileges | undefined
): void => {
  if (!role) {
    throw new Error(
      'Le role de BACKUP_DATABASE_URL est introuvable dans pg_roles : impossible de verifier ses privileges.'
    )
  }

  const problems = [
    role.rolbypassrls
      ? undefined
      : 'ne porte pas BYPASSRLS : la sauvegarde ne contiendrait aucune ligne metier',
    role.rolsuper
      ? 'porte SUPERUSER : une minuterie ne doit pas avoir tous les pouvoirs sur la base'
      : undefined,
    role.ownedObjects > 0
      ? `est proprietaire de ${role.ownedObjects} objet(s) : il pourrait modifier ce qu'il sauvegarde`
      : undefined,
  ].filter(Boolean)

  if (problems.length === 0) {
    return
  }

  throw new Error(
    `Le role de sauvegarde « ${role.rolname} » ${problems.join(' ; ')}. ` +
      'Utiliser asl_backup (LOGIN BYPASSRLS, membre de pg_read_all_data, ' +
      'proprietaire de rien), voir ADR 045.'
  )
}
