import {isValidElement, ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

const cookieNames = vi.hoisted(() => ({current: [] as string[]}))

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: () => cookieNames.current.map((name) => ({name, value: 'x'})),
  })),
}))
vi.mock('next-intl/server', async () => {
  const messages = (await import('../../../../messages/fr.json')).default
  return {
    getTranslations: async (namespace: string) => (key: string) =>
      [...namespace.split('.'), ...key.split('.')].reduce<unknown>(
        (node, part) => (node as Record<string, unknown>)?.[part],
        messages
      ) as string,
  }
})
vi.mock('@/app/dal/impersonation-dal', () => ({
  getImpersonationBarDal: vi.fn(),
}))
vi.mock('@/app/[locale]/admin/organizations/actions', () => ({
  stopImpersonationAction: vi.fn(),
}))

import {stopImpersonationAction} from '@/app/[locale]/admin/organizations/actions'
import {getImpersonationBarDal} from '@/app/dal/impersonation-dal'

import {ImpersonationBar} from './impersonation-bar'
import {ImpersonationBarSlot} from './impersonation-bar-slot'

beforeEach(() => {
  vi.clearAllMocks()
  cookieNames.current = ['better-auth.session_token']
})

describe('ImpersonationBarSlot (s48)', () => {
  it('sans cookie admin_session : aucune lecture de session, rien rendu', async () => {
    expect(await ImpersonationBarSlot()).toBeNull()
    expect(getImpersonationBarDal).not.toHaveBeenCalled()
  })

  it('cookie présent mais pas d’imitation : rien rendu', async () => {
    cookieNames.current.push('__Secure-better-auth.admin_session')
    vi.mocked(getImpersonationBarDal).mockResolvedValue(null)

    expect(await ImpersonationBarSlot()).toBeNull()
    expect(getImpersonationBarDal).toHaveBeenCalledTimes(1)
  })

  it('pendant l’imitation : la barre, avec le rôle traduit et l’action de sortie', async () => {
    cookieNames.current.push('better-auth.admin_session')
    vi.mocked(getImpersonationBarDal).mockResolvedValue({
      subjectName: 'Claire Montel',
      role: 'owner',
      organizationName: 'Rives Vertes',
      expiresAt: '2026-11-02T15:42:00.000Z',
    })

    const element = (await ImpersonationBarSlot()) as ReactElement<
      Record<string, unknown>
    >

    expect(isValidElement(element)).toBe(true)
    expect(element.type).toBe(ImpersonationBar)
    expect(element.props).toEqual({
      subjectName: 'Claire Montel',
      roleLabel: 'Président(e)',
      organizationName: 'Rives Vertes',
      expiresAt: '2026-11-02T15:42:00.000Z',
      stopAction: stopImpersonationAction,
    })
  })
})
