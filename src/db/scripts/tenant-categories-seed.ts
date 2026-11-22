import type {CategoryDomain} from '../../services/types/domain/association-category-types'

/**
 * Categories des tenants de test (s10, ADR 028) : de signalement, et les
 * sujets des questions des membres du premier tenant (s23), l'un avec son
 * adresse, l'autre sans (routage exclusif, critere 2).
 *
 * Valeurs fictives, propres a chaque association de test, jamais celles d'un
 * client : les categories d'une vraie association sont saisies par son bureau.
 * L'adresse du responsable forage est portee **par la categorie « Fuite
 * d'eau »** (ADR 028, consequences), plus par un reglage. Marketing Pro a sa
 * propre categorie, pour prouver l'isolation entre deux tenants.
 *
 * Les categories des documents partages (s31, ADR 069) : « Statuts »,
 * « Proces-verbaux », « Ordres du jour » sont des valeurs de seed du premier
 * tenant (ADR 010), jamais des constantes ; Marketing Pro a la sienne.
 */
export type TestTenantCategory = {
  organizationSlug: string
  domain: CategoryDomain
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
  {
    organizationSlug: 'techcorp-solutions',
    domain: 'question',
    name: 'Factures et cotisation',
    routingEmail: 'tresorerie@techcorp-solutions.test',
  },
  {
    organizationSlug: 'techcorp-solutions',
    domain: 'question',
    name: 'Voirie et portails',
    routingEmail: null,
  },
  {
    organizationSlug: 'techcorp-solutions',
    domain: 'document',
    name: 'Statuts',
    routingEmail: null,
  },
  {
    organizationSlug: 'techcorp-solutions',
    domain: 'document',
    name: 'Procès-verbaux',
    routingEmail: null,
  },
  {
    organizationSlug: 'techcorp-solutions',
    domain: 'document',
    name: 'Ordres du jour',
    routingEmail: null,
  },
  {
    organizationSlug: 'marketing-pro',
    domain: 'document',
    name: 'Comptes rendus',
    routingEmail: null,
  },
]
