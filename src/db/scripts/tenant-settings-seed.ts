/**
 * Jeu de parametres des tenants de test (s02, critere 6 ; ADR 016).
 *
 * Valeurs fictives, propres a chaque association de test, jamais celles d'un
 * client : une vraie association recoit son adresse de contact au
 * provisioning. Marketing Pro ne declare volontairement aucune teinte : elle
 * sert la teinte par defaut (critere 10), TechCorp une autre (critere 9).
 * Le delai de confirmation d'une adresse (s54, ADR 056 §5) est une valeur de
 * seed du premier tenant, pas une constante. Le terrain par defaut (s55,
 * ADR 058) aussi : code postal et commune fictifs chez TechCorp, rien chez
 * Marketing Pro (l'import y laisse le terrain vide). L'objet des factures
 * (s19, ADR 059 §6) est une valeur de seed du premier tenant, a valider avec
 * son bureau ; **aucun statut de facture** n'est livre (amendement du 15/11).
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
    organizationSlug: 'techcorp-solutions',
    key: 'member.email_confirmation_days',
    value: '7',
  },
  {
    organizationSlug: 'techcorp-solutions',
    key: 'member.default_land_postal_code',
    value: '33680',
  },
  {
    organizationSlug: 'techcorp-solutions',
    key: 'member.default_land_city',
    value: 'Lacanau',
  },
  {
    organizationSlug: 'techcorp-solutions',
    key: 'billing.invoice_subject',
    value: 'Cotisation et eau {année}',
  },
  {
    organizationSlug: 'marketing-pro',
    key: 'contact.email',
    value: 'contact@marketing-pro.test',
  },
]
