import {describe, expect, it, vi} from 'vitest'

vi.mock('better-auth/react', () => ({
  createAuthClient: vi.fn(() => ({})),
}))

import './auth-client'

import {createAuthClient} from 'better-auth/react'

describe('client Better Auth du navigateur', () => {
  it('n’est pas construit sur une adresse fixe : il suit le domaine de la page (ADR 022)', () => {
    expect(createAuthClient).toHaveBeenCalledTimes(1)
    const [options] = vi.mocked(createAuthClient).mock.calls[0] ?? []

    expect(options).toBeDefined()
    expect(options).not.toHaveProperty('baseURL')
  })
})
