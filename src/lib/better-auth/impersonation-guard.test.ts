import {describe, expect, it} from 'vitest'

import {
  IMPERSONATION_DISABLED_HTTP_PATHS,
  IMPERSONATION_GUARD_ID,
  impersonationGuard,
  isSensitiveAccountPath,
} from './impersonation-guard'

/** s48, ADR 041 : un seul chemin d'ouverture, refus des écritures sensibles. */
describe('impersonationGuard', () => {
  it('ferme les deux routes HTTP d’imitation du plugin admin', () => {
    expect([...IMPERSONATION_DISABLED_HTTP_PATHS].sort()).toEqual([
      '/admin/impersonate-user',
      '/admin/stop-impersonating',
    ])
  })

  it('porte un identifiant de plugin stable', () => {
    expect(impersonationGuard().id).toBe(IMPERSONATION_GUARD_ID)
  })

  it.each([
    '/change-password',
    '/change-email',
    '/two-factor/enable',
    '/two-factor/disable',
    '/two-factor/generate-backup-codes',
    '/two-factor/verify-totp',
    '/delete-user',
    '/link-social',
    '/unlink-account',
  ])('vise le chemin sensible %s', (path) => {
    expect(isSensitiveAccountPath(path)).toBe(true)
  })

  it.each(['/update-user', '/get-session', '/sign-out', '/list-sessions'])(
    'laisse passer %s',
    (path) => {
      expect(isSensitiveAccountPath(path)).toBe(false)
    }
  )
})
