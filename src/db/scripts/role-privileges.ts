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
