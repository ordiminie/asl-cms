import {getTableConfig} from 'drizzle-orm/pg-core'
import {describe, expect, it} from 'vitest'

import {verification} from './models/auth-model'

/**
 * Verrou de Better Auth (s12d) : `reserveVerificationValue` insere un `id`
 * impose, un SHA-256 en base64url de 43 caracteres, pas un UUID. Une colonne
 * `uuid` le refuse et casse la connexion d'un compte non verifie. Vit hors de
 * `src/db/models/` : un fichier de test dans ce dossier casse drizzle-kit.
 */
describe('verification.id', () => {
  const column = getTableConfig(verification).columns.find(
    (c) => c.name === 'id'
  )

  it('est une colonne texte, pour accepter un identifiant non UUID', () => {
    expect(column?.getSQLType()).toBe('text')
  })

  it('reste la cle primaire, avec un defaut genere par la base', () => {
    expect(column?.primary).toBe(true)
    expect(column?.hasDefault).toBe(true)
  })
})
