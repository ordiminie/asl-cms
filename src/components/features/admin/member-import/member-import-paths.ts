/** Ecran d'import des membres (s13), reserve au SuperAdmin. */
export const MEMBER_IMPORT_PATH = '/admin/membres-import'

/** Parametre qui preselectionne l'association (arrivee depuis sa fiche). */
export const MEMBER_IMPORT_ORGANIZATION_PARAM = 'association'

export const memberImportPathOf = (organizationId: string): string =>
  `${MEMBER_IMPORT_PATH}?${MEMBER_IMPORT_ORGANIZATION_PARAM}=${encodeURIComponent(organizationId)}`

export const ORGANIZATIONS_PATH = '/admin/organizations'

export const organizationEditPathOf = (organizationId: string): string =>
  `${ORGANIZATIONS_PATH}/${encodeURIComponent(organizationId)}/edit`
