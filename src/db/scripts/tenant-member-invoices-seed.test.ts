import {describe, expect, it} from 'vitest'

import {
  classifyInvoiceStatus,
  findStatusesInBothLists,
  getInvoiceStatusClassification,
  selectableInvoiceStatuses,
} from '@/services/rules/member-invoice-rules'
import {ownerAt} from '@/services/rules/parcel-ownership-rules'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  resolveSettings,
  validateSettingsChanges,
} from '@/services/types/domain/association-settings-types'

import {
  TEST_INVOICE_DEMO_SETTINGS,
  TEST_INVOICE_STATUS_ALERTS,
  TEST_MEMBER_INVOICES,
} from './tenant-member-invoices-seed'
import {
  TEST_MEMBER_PROFILES,
  TEST_PARCEL_OWNERSHIPS,
} from './tenant-member-profiles-seed'
import {TEST_TENANT_SETTINGS} from './tenant-settings-seed'

const TECHCORP = 'techcorp-solutions'
const MARKETING = 'marketing-pro'
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const classificationOf = (slug: string) =>
  getInvoiceStatusClassification(
    resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
      ...TEST_TENANT_SETTINGS.filter((row) => row.organizationSlug === slug),
      ...TEST_INVOICE_DEMO_SETTINGS.filter(
        (row) => row.organizationSlug === slug
      ),
    ])
  )

const periodsOf = (slug: string, parcelNumber: string) =>
  TEST_PARCEL_OWNERSHIPS.filter(
    (row) => row.organizationSlug === slug && row.parcelNumber === parcelNumber
  ).map((row) => ({
    id: row.id,
    memberProfileId: row.memberProfileId,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
  }))

const profileName = (id: string) =>
  TEST_MEMBER_PROFILES.find((row) => row.id === id)?.name

describe('TEST_MEMBER_INVOICES — factures des tenants de test (s19)', () => {
  it('chaque facture a un identifiant fixe, un montant en centimes positif, une échéance au plus tôt à l’émission', () => {
    for (const invoice of TEST_MEMBER_INVOICES) {
      expect(invoice.id, invoice.id).toMatch(UUID)
      expect(Number.isInteger(invoice.amountCents)).toBe(true)
      expect(invoice.amountCents).toBeGreaterThan(0)
      expect(invoice.dueOn >= invoice.issuedOn, invoice.id).toBe(true)
    }
    expect(new Set(TEST_MEMBER_INVOICES.map((row) => row.id)).size).toBe(
      TEST_MEMBER_INVOICES.length
    )
  })

  it('chaque facture porte une fiche de son association, propriétaire de la parcelle à la date d’émission (ADR 059 §3)', () => {
    for (const invoice of TEST_MEMBER_INVOICES) {
      const profile = TEST_MEMBER_PROFILES.find(
        (row) => row.id === invoice.memberProfileId
      )
      expect(profile?.organizationSlug, invoice.id).toBe(
        invoice.organizationSlug
      )
      expect(
        ownerAt(
          periodsOf(invoice.organizationSlug, invoice.parcelNumber),
          invoice.issuedOn
        ),
        invoice.id
      ).toBe(invoice.memberProfileId)
    }
  })

  it('les deux associations ont des factures ; TechCorp en a du site et de Pennylane', () => {
    const sourcesOf = (slug: string) =>
      new Set(
        TEST_MEMBER_INVOICES.filter((row) => row.organizationSlug === slug).map(
          (row) => row.source
        )
      )
    expect(sourcesOf(TECHCORP)).toEqual(new Set(['site', 'pennylane']))
    expect(sourcesOf(MARKETING).size).toBeGreaterThan(0)
  })

  it('critère 8 : la parcelle 9 vendue a une facture d’avant la vente (vendeuse) et une d’après (acquéreur)', () => {
    const parcel9 = TEST_MEMBER_INVOICES.filter(
      (row) => row.organizationSlug === TECHCORP && row.parcelNumber === '9'
    ).toSorted((a, b) => a.issuedOn.localeCompare(b.issuedOn))

    expect(parcel9.map((row) => profileName(row.memberProfileId))).toEqual([
      'Lucie Moreau',
      'Marcel Laurent',
    ])
  })

  it('critère 6 : une facture porte un statut que la configuration de démo ne classe pas', () => {
    expect(
      TEST_MEMBER_INVOICES.some(
        (row) =>
          classifyInvoiceStatus(
            row.status,
            classificationOf(row.organizationSlug)
          ) === 'unclassified'
      )
    ).toBe(true)
  })

  it('une facture saisie sur le site porte un statut proposé à la saisie (ADR 059 §8)', () => {
    for (const invoice of TEST_MEMBER_INVOICES.filter(
      (row) => row.source === 'site'
    )) {
      expect(
        selectableInvoiceStatuses(classificationOf(invoice.organizationSlug)),
        invoice.id
      ).toContain(invoice.status)
    }
  })

  it('une facture Pennylane porte son identifiant chez la source, une facture du site n’en a pas', () => {
    for (const invoice of TEST_MEMBER_INVOICES) {
      if (invoice.source === 'pennylane') {
        expect(invoice.externalId, invoice.id).toEqual(expect.any(String))
      } else {
        expect(invoice.externalId, invoice.id).toBeNull()
      }
    }
  })
})

describe('TEST_INVOICE_DEMO_SETTINGS — classement de démonstration (seed seulement)', () => {
  it('des réglages du registre, valides, deux listes disjointes par association', () => {
    for (const slug of [TECHCORP, MARKETING]) {
      const rows = TEST_INVOICE_DEMO_SETTINGS.filter(
        (row) => row.organizationSlug === slug
      )
      expect(
        validateSettingsChanges(
          ASSOCIATION_SETTINGS_REGISTRY,
          Object.fromEntries(rows.map(({key, value}) => [key, value]))
        ),
        slug
      ).toMatchObject({valid: true})
      expect(findStatusesInBothLists(classificationOf(slug)), slug).toEqual([])
      expect(classificationOf(slug).unpaid.length, slug).toBeGreaterThan(0)
    }
  })

  it('ne touche pas au jeu de paramètres des tenants : aucun statut n’y est livré', () => {
    const demoKeys = new Set(TEST_INVOICE_DEMO_SETTINGS.map((row) => row.key))
    expect(TEST_TENANT_SETTINGS.filter((row) => demoKeys.has(row.key))).toEqual(
      []
    )
  })
})

describe('TEST_INVOICE_STATUS_ALERTS — statuts déjà signalés (preuve RLS de invoice_status_alert)', () => {
  it('une alerte à identifiant fixe par association, pour l’accès croisé', () => {
    for (const alert of TEST_INVOICE_STATUS_ALERTS) {
      expect(alert.id, alert.id).toMatch(UUID)
    }
    expect(
      TEST_INVOICE_STATUS_ALERTS.map((row) => row.organizationSlug).toSorted()
    ).toEqual([MARKETING, TECHCORP])
  })

  it('un statut à classer pour son association, qu’aucune facture du seed ne porte', () => {
    const invoiceStatuses = new Set(
      TEST_MEMBER_INVOICES.map((row) => row.status)
    )
    for (const alert of TEST_INVOICE_STATUS_ALERTS) {
      expect(
        classifyInvoiceStatus(
          alert.status,
          classificationOf(alert.organizationSlug)
        ),
        alert.id
      ).toBe('unclassified')
      expect(invoiceStatuses.has(alert.status), alert.id).toBe(false)
    }
  })
})
