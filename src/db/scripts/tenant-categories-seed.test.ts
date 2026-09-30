import {describe, expect, it} from 'vitest'

import {
  CATEGORY_DOMAINS,
  CATEGORY_NAME_MAX_LENGTH,
  MAX_CATEGORIES_PER_DOMAIN,
} from '@/services/types/domain/association-category-types'

import {TEST_TENANT_CATEGORIES} from './tenant-categories-seed'

const categoriesOf = (slug: string) =>
  TEST_TENANT_CATEGORIES.filter((row) => row.organizationSlug === slug)

describe('TEST_TENANT_CATEGORIES — catégories des tenants de test (s10, ADR 028)', () => {
  it('donne à chaque tenant de test ses propres catégories', () => {
    const a = categoriesOf('techcorp-solutions').map((row) => row.name)
    const b = categoriesOf('marketing-pro').map((row) => row.name)

    expect(a).toEqual([
      "Fuite d'eau",
      'Voirie et chemins',
      'Éclairage',
      'Nuisance',
    ])
    expect(b.length).toBeGreaterThan(0)
    expect(b.filter((name) => a.includes(name))).toEqual([])
  })

  it('porte l’adresse du responsable forage sur « Fuite d’eau », et rien ailleurs chez TechCorp', () => {
    const routed = categoriesOf('techcorp-solutions').filter(
      (row) => row.routingEmail !== null
    )

    expect(routed).toEqual([
      expect.objectContaining({
        name: "Fuite d'eau",
        routingEmail: 'forage@techcorp-solutions.test',
      }),
    ])
  })

  it('reste dans les règles du modèle : domaine connu, nom court et unique, plafond tenu, adresses fictives', () => {
    for (const slug of ['techcorp-solutions', 'marketing-pro']) {
      const rows = categoriesOf(slug)
      const names = rows.map((row) => row.name.toLowerCase())

      expect(rows.length, slug).toBeLessThanOrEqual(MAX_CATEGORIES_PER_DOMAIN)
      expect(new Set(names).size, slug).toBe(names.length)
      for (const row of rows) {
        expect(CATEGORY_DOMAINS).toContain(row.domain)
        expect(row.name.trim()).toBe(row.name)
        expect(row.name.length).toBeLessThanOrEqual(CATEGORY_NAME_MAX_LENGTH)
        if (row.routingEmail !== null) {
          expect(row.routingEmail).toMatch(/@[a-z0-9-]+\.test$/)
        }
      }
    }
  })
})
