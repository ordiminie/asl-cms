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
 * La nature des envois (s27b, ADR 064) est une valeur de seed du premier
 * tenant (arbitrage du 18/09/2026, a confirmer par le conseil RGPD) :
 * relance, facture et convocation statutaires ; message libre et documents
 * apres l'AG facultatifs. Marketing Pro n'en declare aucune.
 * La relance automatique des impayes (s29, ADR 070 §7) est activee chez
 * TechCorp en valeurs de seed : intervalles 3, 2 puis 1 semaines (CDCT §8.3),
 * objet et texte fictifs, nature statutaire. Marketing Pro ne l'active pas.
 * La duree du lien d'invitation (s42a, arbitrage du 24/11/2026) est une
 * valeur de seed du premier tenant : 7 jours.
 * Le delai d'acces apres la vente (s57, ADR 075) est une valeur de seed du
 * premier tenant : 6 mois, en attente de l'avis du conseil RGPD. Marketing
 * Pro n'en declare aucun (defaut du registre).
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
    key: 'invitation.link_days',
    value: '7',
  },
  {
    organizationSlug: 'techcorp-solutions',
    key: 'member.access_after_sale_months',
    value: '6',
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
    organizationSlug: 'techcorp-solutions',
    key: 'campaign.nature.free',
    value: 'facultative',
  },
  {
    organizationSlug: 'techcorp-solutions',
    key: 'campaign.nature.reminder',
    value: 'statutaire',
  },
  {
    organizationSlug: 'techcorp-solutions',
    key: 'campaign.nature.invoice',
    value: 'statutaire',
  },
  {
    organizationSlug: 'techcorp-solutions',
    key: 'campaign.nature.general_assembly',
    value: 'statutaire',
  },
  {
    organizationSlug: 'techcorp-solutions',
    key: 'campaign.nature.post_assembly_documents',
    value: 'facultative',
  },
  {
    organizationSlug: 'techcorp-solutions',
    key: 'campaign.nature.unpaid_reminder',
    value: 'statutaire',
  },
  {
    organizationSlug: 'techcorp-solutions',
    key: 'campaign.nature.member_invitation_launch',
    value: 'statutaire',
  },
  {
    organizationSlug: 'techcorp-solutions',
    key: 'campaign.nature.member_invitation_reminder',
    value: 'statutaire',
  },
  {
    organizationSlug: 'techcorp-solutions',
    key: 'billing.reminder.enabled',
    value: 'true',
  },
  {
    organizationSlug: 'techcorp-solutions',
    key: 'billing.reminder.delay_weeks.1',
    value: '3',
  },
  {
    organizationSlug: 'techcorp-solutions',
    key: 'billing.reminder.delay_weeks.2',
    value: '2',
  },
  {
    organizationSlug: 'techcorp-solutions',
    key: 'billing.reminder.delay_weeks.3',
    value: '1',
  },
  {
    organizationSlug: 'techcorp-solutions',
    key: 'billing.reminder.subject',
    value: 'Facture en attente de règlement',
  },
  {
    organizationSlug: 'techcorp-solutions',
    key: 'billing.reminder.body',
    value:
      'Bonjour {nom},\n\nSauf erreur de notre part, les factures suivantes restent à régler :\n\n{factures}\n\nSi vous avez déjà réglé, merci de ne pas tenir compte de ce message.\n\nLe bureau de TechCorp Solutions',
  },
  {
    organizationSlug: 'marketing-pro',
    key: 'contact.email',
    value: 'contact@marketing-pro.test',
  },
]
