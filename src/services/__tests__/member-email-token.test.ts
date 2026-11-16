import {createHash} from 'node:crypto'

import {describe, expect, it} from 'vitest'

import {
  hashConfirmationToken,
  isConfirmationTokenShaped,
  newConfirmationToken,
} from '../member-email-token'

describe('jeton de confirmation d’une adresse (s54, ADR 056 §5)', () => {
  it('est aléatoire, 32 octets en base64url', () => {
    const first = newConfirmationToken()
    const second = newConfirmationToken()

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(second).not.toBe(first)
    expect(isConfirmationTokenShaped(first)).toBe(true)
  })

  it('se stocke haché en SHA-256, jamais en clair', () => {
    const token = newConfirmationToken()

    expect(hashConfirmationToken(token)).toBe(
      createHash('sha256').update(token).digest('hex')
    )
    expect(hashConfirmationToken(token)).not.toContain(token)
  })

  it('refuse une forme qui n’est pas celle d’un jeton', () => {
    expect(isConfirmationTokenShaped('court')).toBe(false)
    expect(isConfirmationTokenShaped(`${'A'.repeat(42)}!`)).toBe(false)
  })
})
