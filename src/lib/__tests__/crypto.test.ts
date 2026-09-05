import {describe, expect, it} from 'vitest'

import {generateSalt, hashPassword, verifyPassword} from '../crypto'

describe('Crypto Utils', () => {
  const testPassword = 'monMotDePasse123!'

  describe('hashPassword', () => {
    it('devrait générer un hash différent pour le même mot de passe', async () => {
      const hash1 = await hashPassword(testPassword)
      const hash2 = await hashPassword(testPassword)

      expect(hash1).toBeDefined()
      expect(hash2).toBeDefined()
      expect(hash1).not.toBe(hash2) // Les hashes devraient être différents à cause du salt unique
    })

    it('devrait générer un hash de longueur valide', async () => {
      const hash = await hashPassword(testPassword)
      expect(hash.length).toBeGreaterThan(0)
    })
  })

  describe('verifyPassword', () => {
    it('devrait vérifier correctement un mot de passe valide', async () => {
      const hash = await hashPassword(testPassword)
      const isValid = await verifyPassword(testPassword, hash)
      expect(isValid).toBe(true)
    })

    it('devrait rejeter un mot de passe invalide', async () => {
      const hash = await hashPassword(testPassword)
      const isValid = await verifyPassword('mauvaisMotDePasse', hash)
      expect(isValid).toBe(false)
    })
  })

  describe('generateSalt', () => {
    it('devrait générer des salts différents', async () => {
      const salt1 = await generateSalt()
      const salt2 = await generateSalt()

      expect(salt1).toBeDefined()
      expect(salt2).toBeDefined()
      expect(salt1).not.toBe(salt2)
    })

    it('devrait accepter un nombre de rounds personnalisé', async () => {
      const salt = await generateSalt(10)
      expect(salt).toBeDefined()
    })
  })
})
