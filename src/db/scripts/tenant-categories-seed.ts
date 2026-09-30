/**
 * Categories de signalement des tenants de test (s10, ADR 028).
 *
 * Valeurs fictives, propres a chaque association de test, jamais celles d'un
 * client : les categories d'une vraie association sont saisies par son bureau.
 * L'adresse du responsable forage est portee **par la categorie « Fuite
 * d'eau »** (ADR 028, consequences), plus par un reglage. Marketing Pro a sa
 * propre categorie, pour prouver l'isolation entre deux tenants.
 */
export type TestTenantCategory = {
  organizationSlug: string
  domain: 'report'
  name: string
  routingEmail: string | null
}

export const TEST_TENANT_CATEGORIES: readonly TestTenantCategory[] = [
  {
    organizationSlug: 'techcorp-solutions',
    domain: 'report',
    name: "Fuite d'eau",
    routingEmail: 'forage@techcorp-solutions.test',
  },
  {
    organizationSlug: 'techcorp-solutions',
    domain: 'report',
    name: 'Voirie et chemins',
    routingEmail: null,
  },
  {
    organizationSlug: 'techcorp-solutions',
    domain: 'report',
    name: 'Éclairage',
    routingEmail: null,
  },
  {
    organizationSlug: 'techcorp-solutions',
    domain: 'report',
    name: 'Nuisance',
    routingEmail: null,
  },
  {
    organizationSlug: 'marketing-pro',
    domain: 'report',
    name: 'Portail et clôtures',
    routingEmail: null,
  },
]
