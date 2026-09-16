import {describe, expect, it} from 'vitest'

import {resolveMigrationUrl} from './db-url'

describe('resolveMigrationUrl', () => {
  it("retourne l'URL de migration quand elle est fournie", () => {
    expect(
      resolveMigrationUrl({
        DATABASE_MIGRATION_URL: 'postgres://owner@db:5432/asl_cms',
        DATABASE_URL: 'postgres://app@db:5432/asl_cms',
      })
    ).toBe('postgres://owner@db:5432/asl_cms')
  })

  it("retombe sur DATABASE_URL quand l'URL de migration est absente", () => {
    expect(
      resolveMigrationUrl({DATABASE_URL: 'postgres://app@db:5432/asl_cms'})
    ).toBe('postgres://app@db:5432/asl_cms')
  })

  it('ignore une URL de migration vide', () => {
    expect(
      resolveMigrationUrl({
        DATABASE_MIGRATION_URL: '  ',
        DATABASE_URL: 'postgres://app@db:5432/asl_cms',
      })
    ).toBe('postgres://app@db:5432/asl_cms')
  })

  it('échoue explicitement quand aucune URL n est disponible', () => {
    expect(() => resolveMigrationUrl({})).toThrow(
      'DATABASE_MIGRATION_URL or DATABASE_URL must be defined'
    )
  })
})
