import type {TestTenantSetting} from './tenant-settings-seed'

/**
 * Factures des tenants de test (s19, ADR 059).
 *
 * Valeurs **fictives**, jamais celles d'un client. Les identifiants sont fixes
 * pour que le seed soit deterministe et rejouable. Chaque facture porte la
 * fiche facturee et la parcelle dont elle etait proprietaire a la date
 * d'emission (ADR 059 §3).
 *
 * TechCorp porte les cas des criteres : les trois fiches de Bernard Lefevre
 * (une seule liste, trois terrains), une facture Pennylane a statut **non
 * classe** (critere 6), et la parcelle 9 vendue le 01/10/2019 : une facture
 * d'avant la vente a Lucie Moreau, une d'apres a Marcel Laurent (critere 8).
 * Marketing Pro a la sienne, pour l'acces croise.
 */
export type TestMemberInvoice = {
  id: string
  organizationSlug: string
  memberProfileId: string
  parcelNumber: string
  source: 'site' | 'pennylane'
  externalId: string | null
  year: number
  issuedOn: string
  dueOn: string
  amountCents: number
  status: string
}

const TECHCORP = 'techcorp-solutions'
const MARKETING = 'marketing-pro'

const MOREAU_ID = 'a1200000-0000-4000-8000-000000000006'
const LAURENT_ID = 'a1200000-0000-4000-8000-000000000004'
const LEFEVRE_FIRST_ID = 'a1200000-0000-4000-8000-000000000008'
const LEFEVRE_SECOND_ID = 'a1200000-0000-4000-8000-000000000009'
const LEFEVRE_SCI_ID = 'a1200000-0000-4000-8000-00000000000a'
const SCI_PINS_ID = 'b1200000-0000-4000-8000-000000000001'

/** Statuts fictifs de demonstration, jamais la configuration d'un client. */
const PENDING = 'En attente'
const REMINDED = 'Relance 1'
const PAID = 'Payée'
/** Un statut que la configuration de demonstration ne classe pas. */
const UNCLASSIFIED = 'Partiellement payée'

export const TEST_MEMBER_INVOICES: readonly TestMemberInvoice[] = [
  {
    id: 'a1900000-0000-4000-8000-0000000000c1',
    organizationSlug: TECHCORP,
    memberProfileId: LEFEVRE_FIRST_ID,
    parcelNumber: '61',
    source: 'site',
    externalId: null,
    year: 2026,
    issuedOn: '2026-03-15',
    dueOn: '2026-04-15',
    amountCents: 41250,
    status: PENDING,
  },
  {
    id: 'a1900000-0000-4000-8000-0000000000c2',
    organizationSlug: TECHCORP,
    memberProfileId: LEFEVRE_SECOND_ID,
    parcelNumber: '62',
    source: 'site',
    externalId: null,
    year: 2025,
    issuedOn: '2025-03-15',
    dueOn: '2025-04-15',
    amountCents: 39800,
    status: PAID,
  },
  {
    id: 'a1900000-0000-4000-8000-0000000000c3',
    organizationSlug: TECHCORP,
    memberProfileId: LEFEVRE_SCI_ID,
    parcelNumber: '63',
    source: 'pennylane',
    externalId: 'PL-DEMO-0063-2026',
    year: 2026,
    issuedOn: '2026-03-20',
    dueOn: '2026-04-30',
    amountCents: 128000,
    status: UNCLASSIFIED,
  },
  {
    id: 'a1900000-0000-4000-8000-0000000000c4',
    organizationSlug: TECHCORP,
    memberProfileId: MOREAU_ID,
    parcelNumber: '9',
    source: 'site',
    externalId: null,
    year: 2019,
    issuedOn: '2019-03-15',
    dueOn: '2019-04-15',
    amountCents: 31500,
    status: PAID,
  },
  {
    id: 'a1900000-0000-4000-8000-0000000000c5',
    organizationSlug: TECHCORP,
    memberProfileId: LAURENT_ID,
    parcelNumber: '9',
    source: 'site',
    externalId: null,
    year: 2020,
    issuedOn: '2020-03-16',
    dueOn: '2020-04-15',
    amountCents: 32700,
    status: REMINDED,
  },
  {
    id: 'b1900000-0000-4000-8000-0000000000d1',
    organizationSlug: MARKETING,
    memberProfileId: SCI_PINS_ID,
    parcelNumber: '47',
    source: 'site',
    externalId: null,
    year: 2026,
    issuedOn: '2026-02-10',
    dueOn: '2026-03-10',
    amountCents: 52000,
    status: PENDING,
  },
]

/**
 * Classement de **demonstration** des statuts, pose par le seed de
 * developpement seulement (amendement du 15/11 : aucune valeur de statut dans
 * le code ni dans la configuration livree). Separe de `TEST_TENANT_SETTINGS`.
 */
export const TEST_INVOICE_DEMO_SETTINGS: readonly TestTenantSetting[] = [
  {
    organizationSlug: TECHCORP,
    key: 'billing.unpaid_statuses',
    value: `${PENDING}\n${REMINDED}`,
  },
  {
    organizationSlug: TECHCORP,
    key: 'billing.settled_statuses',
    value: PAID,
  },
  {
    organizationSlug: MARKETING,
    key: 'billing.unpaid_statuses',
    value: PENDING,
  },
  {
    organizationSlug: MARKETING,
    key: 'billing.settled_statuses',
    value: PAID,
  },
]

export type TestInvoiceStatusAlert = {
  id: string
  organizationSlug: string
  status: string
}

/** Un statut fictif que la configuration de demonstration ne classe pas. */
const ALREADY_SIGNALED = 'Litige'

/**
 * Statuts **deja signales** au bureau, un par association : sans eux, la table
 * `invoice_status_alert` serait vide au moment des preuves RLS, qui
 * passeraient alors sans policy (revue s19, M1). Aucune facture du seed ne
 * porte ce statut : le signalement des autres reste demontrable.
 */
export const TEST_INVOICE_STATUS_ALERTS: readonly TestInvoiceStatusAlert[] = [
  {
    id: 'a1900000-0000-4000-8000-0000000000e1',
    organizationSlug: TECHCORP,
    status: ALREADY_SIGNALED,
  },
  {
    id: 'b1900000-0000-4000-8000-0000000000f1',
    organizationSlug: MARKETING,
    status: ALREADY_SIGNALED,
  },
]
