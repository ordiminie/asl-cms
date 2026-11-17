import {describe, expect, it} from 'vitest'

import {
  ASSOCIATION_SETTINGS_REGISTRY,
  resolveSettings,
} from '../types/domain/association-settings-types'
import {
  BILLING_INVOICE_SUBJECT_SETTING_KEY,
  BILLING_SETTLED_STATUSES_SETTING_KEY,
  BILLING_UNPAID_STATUSES_SETTING_KEY,
} from '../types/domain/association-settings-types'
import {
  classifyInvoiceStatus,
  composeInvoiceSubject,
  findStatusesInBothLists,
  formatAmountCents,
  getInvoiceStatusClassification,
  getInvoiceSubjectTemplate,
  isUnpaidInvoice,
  parseAmountToCents,
  parseStatusList,
  selectableInvoiceStatuses,
} from './member-invoice-rules'

const classification = {
  unpaid: ['En attente', 'Relance 1'],
  settled: ['Payée'],
}

describe('parseStatusList — un statut par ligne', () => {
  it('retire les espaces de bord, ignore les lignes vides et les doublons', () => {
    expect(
      parseStatusList('  En attente \n\n Relance 1\r\nEn attente\n   \n')
    ).toEqual(['En attente', 'Relance 1'])
  })

  it('une valeur absente ou vide ne donne aucun statut', () => {
    expect(parseStatusList('')).toEqual([])
    expect(parseStatusList(null)).toEqual([])
    expect(parseStatusList(undefined)).toEqual([])
  })

  it('respecte la casse : deux graphies sont deux statuts', () => {
    expect(parseStatusList('Payée\npayée')).toEqual(['Payée', 'payée'])
  })
})

describe('classifyInvoiceStatus — trois états, jamais deux', () => {
  it('un statut de la liste « impayé » est impayé', () => {
    expect(classifyInvoiceStatus('Relance 1', classification)).toBe('unpaid')
  })

  it('un statut de la liste « réglé » est réglé', () => {
    expect(classifyInvoiceStatus('Payée', classification)).toBe('settled')
  })

  it('un statut inconnu est à classer, jamais réglé', () => {
    expect(classifyInvoiceStatus('Partiellement payée', classification)).toBe(
      'unclassified'
    )
  })

  it('compare après suppression des espaces de bord, casse respectée', () => {
    expect(classifyInvoiceStatus('  Payée ', classification)).toBe('settled')
    expect(classifyInvoiceStatus('payée', classification)).toBe('unclassified')
  })

  it('sans configuration, tout statut est à classer', () => {
    expect(classifyInvoiceStatus('Payée', {unpaid: [], settled: []})).toBe(
      'unclassified'
    )
  })
})

describe('isUnpaidInvoice — le prédicat que consomment s21, s27 et s29', () => {
  it('seul un statut « impayé » est impayé', () => {
    expect(isUnpaidInvoice('En attente', classification)).toBe(true)
    expect(isUnpaidInvoice('Payée', classification)).toBe(false)
  })

  it('un statut à classer n’est pas impayé : il reste hors des relances', () => {
    expect(isUnpaidInvoice('Statut jamais vu', classification)).toBe(false)
  })
})

describe('getInvoiceStatusClassification — lu des réglages du tenant', () => {
  it('lit les deux listes, vides par défaut', () => {
    expect(
      getInvoiceStatusClassification(
        resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [])
      )
    ).toEqual({unpaid: [], settled: []})
  })

  it('découpe les deux réglages multilignes', () => {
    expect(
      getInvoiceStatusClassification(
        resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
          {key: BILLING_UNPAID_STATUSES_SETTING_KEY, value: 'A\nB'},
          {key: BILLING_SETTLED_STATUSES_SETTING_KEY, value: 'C'},
        ])
      )
    ).toEqual({unpaid: ['A', 'B'], settled: ['C']})
  })
})

describe('findStatusesInBothLists', () => {
  it('rend les statuts présents dans les deux listes', () => {
    expect(
      findStatusesInBothLists({unpaid: ['A', 'B'], settled: ['B', 'C']})
    ).toEqual(['B'])
    expect(findStatusesInBothLists(classification)).toEqual([])
  })
})

describe('selectableInvoiceStatuses — statuts proposés à la saisie', () => {
  it('est l’union des deux listes, sans doublon', () => {
    expect(selectableInvoiceStatuses(classification)).toEqual([
      'En attente',
      'Relance 1',
      'Payée',
    ])
  })
})

describe('composeInvoiceSubject — objet composé par le site', () => {
  it('remplace {année} par l’année de la facture', () => {
    expect(composeInvoiceSubject('Cotisation et eau {année}', 2026)).toBe(
      'Cotisation et eau 2026'
    )
  })

  it('remplace chaque occurrence, laisse un modèle sans balise tel quel', () => {
    expect(composeInvoiceSubject('{année} — {année}', 2025)).toBe('2025 — 2025')
    expect(composeInvoiceSubject('Cotisation', 2025)).toBe('Cotisation')
  })

  it('le modèle vient du réglage, « Facture {année} » par défaut', () => {
    expect(
      getInvoiceSubjectTemplate(
        resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [])
      )
    ).toBe('Facture {année}')
    expect(
      getInvoiceSubjectTemplate(
        resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
          {
            key: BILLING_INVOICE_SUBJECT_SETTING_KEY,
            value: 'Cotisation et eau {année}',
          },
        ])
      )
    ).toBe('Cotisation et eau {année}')
  })
})

describe('montant en centimes', () => {
  it('formate en euros à la française', () => {
    expect(formatAmountCents(41250)).toBe('412,50')
    expect(formatAmountCents(5)).toBe('0,05')
    expect(formatAmountCents(100)).toBe('1,00')
    expect(formatAmountCents(123456789)).toBe('1 234 567,89')
  })

  it.each([
    ['412,50', 41250],
    ['412,5', 41250],
    ['412', 41200],
    ['412.50', 41250],
    [' 1 234,50 ', 123450],
    ['1 234,50', 123450],
    ['0,01', 1],
  ])('lit « %s » en %i centimes', (raw, cents) => {
    expect(parseAmountToCents(raw)).toBe(cents)
  })

  it.each(['', '0', '0,00', '-5', '412,505', 'abc', '12,', ',5', '1,2,3'])(
    'refuse « %s »',
    (raw) => {
      expect(parseAmountToCents(raw)).toBeUndefined()
    }
  )

  it('aller-retour exact', () => {
    for (const cents of [1, 99, 41250, 123450]) {
      expect(parseAmountToCents(formatAmountCents(cents))).toBe(cents)
    }
  })
})
