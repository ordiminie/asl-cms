/**
 * Jeu de parametres des tenants de test (s02, critere 6 ; ADR 016).
 *
 * Valeurs fictives, propres a chaque association de test, jamais celles d'un
 * client : une vraie association recoit son adresse de contact au
 * provisioning. Marketing Pro ne declare volontairement aucune teinte : elle
 * sert la teinte par defaut (critere 10), TechCorp une autre (critere 9).
 */
export type TestTenantSetting = {
  organizationSlug: string
  key: string
  value: string
}

export const TEST_TENANT_SETTINGS: readonly TestTenantSetting[] = [
  {
    organizationSlug: 'techcorp-solutions',
    key: 'contact.email',
    value: 'contact@techcorp-solutions.test',
  },
  {
    organizationSlug: 'techcorp-solutions',
    key: 'identity.accent_hue',
    value: '150',
  },
  {
    organizationSlug: 'marketing-pro',
    key: 'contact.email',
    value: 'contact@marketing-pro.test',
  },
]
