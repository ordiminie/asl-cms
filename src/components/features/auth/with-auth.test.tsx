import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  forbidden: vi.fn(),
}))
vi.mock('@/services/authentication/auth-service', () => ({
  getAuthUser: vi.fn(),
  getSessionAuth: vi.fn(async () => null),
}))

import {forbidden, redirect} from 'next/navigation'

import {
  getAuthUser,
  getSessionAuth,
} from '@/services/authentication/auth-service'

import withAuth, {withAuthAdmin} from './with-auth'

const account = (role: string) => ({id: `${role}-1`, role}) as never

const AdminConsole = () => <p>console</p>
const GuardedConsole = withAuthAdmin(AdminConsole)

beforeEach(() => {
  vi.clearAllMocks()
})

/** s47, critère 1 : la console `/admin` est réservée au SuperAdmin. */
describe('withAuthAdmin', () => {
  it('[USER] un compte user déclenche forbidden()', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(account('user'))

    await GuardedConsole({})

    expect(forbidden).toHaveBeenCalledTimes(1)
  })

  it('[ADMIN retiré] un rôle global retiré déclenche forbidden()', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(account('admin'))

    await GuardedConsole({})

    expect(forbidden).toHaveBeenCalledTimes(1)
  })

  it('[SUPER_ADMIN] le SuperAdmin passe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(account('super_admin'))

    await GuardedConsole({})

    expect(forbidden).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('[PUBLIC] sans session, renvoie vers /login', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(undefined)

    await GuardedConsole({})

    expect(redirect).toHaveBeenCalledWith('/login')
  })
})

/** s12d, ADR 038 : un accès fermé avec une session ouverte n'est pas « sans session ». */
describe('withAuth — accès fermé', () => {
  const MemberSpace = () => <p>espace</p>
  const GuardedSpace = withAuth(MemberSpace)

  it('[PUBLIC] sans session, renvoie vers /login', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(undefined)
    vi.mocked(getSessionAuth).mockResolvedValue(null)

    await GuardedSpace({})

    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('[ACCÈS FERMÉ] session présente mais compte refusé ici : vers /login/acces-ferme', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(undefined)
    vi.mocked(getSessionAuth).mockResolvedValue({
      session: {userId: 'user-1'},
      user: {id: 'user-1'},
    } as never)

    await GuardedSpace({})

    expect(redirect).toHaveBeenCalledWith('/login/acces-ferme')
    expect(redirect).not.toHaveBeenCalledWith('/login')
  })

  it('[USER] un compte accepté voit la page', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(account('user'))

    await GuardedSpace({})

    expect(redirect).not.toHaveBeenCalled()
    expect(forbidden).not.toHaveBeenCalled()
  })
})
