import {Suspense, useState} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import {act, render, screen, waitFor} from '@/__tests__/customRender'
import type {CurrentUserContext} from '@/app/dal/user-dal'
import AuthProvider from '@/components/context/auth-provider'
import {
  OrganizationProvider,
  useOrganization,
} from '@/components/context/organization-provider'
import {OrganizationSync} from '@/components/context/organization-sync'
import {Organization} from '@/services/types/domain/organization-types'

const setActiveMock = vi.fn().mockResolvedValue(undefined)
const refreshMock = vi.fn()
// Objet stable : le vrai useRouter de Next l'est, et `setCurrentOrganization`
// le prend en dépendance de son useCallback.
const router = {refresh: refreshMock, push: vi.fn(), replace: vi.fn()}

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}))

vi.mock('@/lib/better-auth/auth-client', () => ({
  authClient: {
    organization: {
      setActive: (...args: unknown[]) => setActiveMock(...args),
    },
  },
}))

const buildOrganization = (id: string, slug: string) =>
  ({id, slug, name: slug}) as Organization

const techcorp = buildOrganization('org-1', 'techcorp')
const acme = buildOrganization('org-2', 'acme')

const buildSession = (
  activeOrganization: Organization | null,
  withOrganizations = true
): Promise<CurrentUserContext> =>
  Promise.resolve({
    user: {
      id: 'user-1',
      organizations: withOrganizations
        ? [{organization: techcorp}, {organization: acme}]
        : undefined,
    },
    activeOrganization,
  } as unknown as CurrentUserContext)

const renderWithSession = async (
  activeOrganization: Organization | null,
  children: React.ReactNode,
  withOrganizations = true
) => {
  await act(async () => {
    render(
      <AuthProvider
        userPromise={buildSession(activeOrganization, withOrganizations)}
      >
        <OrganizationProvider>
          <Suspense fallback={null}>{children}</Suspense>
        </OrganizationProvider>
      </AuthProvider>
    )
  })
}

const trackIdentities = () => {
  const seen: {organizations: unknown; setter: unknown}[] = []
  let rerender: () => void = () => {}

  function Probe() {
    const {organizations, setCurrentOrganization} = useOrganization()
    const [, setTick] = useState(0)
    rerender = () => setTick((tick) => tick + 1)
    seen.push({organizations, setter: setCurrentOrganization})
    return null
  }

  return {seen, forceRerender: () => rerender(), Probe}
}

beforeEach(() => {
  setActiveMock.mockClear()
  refreshMock.mockClear()
})

describe('useOrganization', () => {
  it('garde des identités stables entre deux rendus', async () => {
    const {seen, forceRerender, Probe} = trackIdentities()

    await renderWithSession(techcorp, <Probe />)
    await act(async () => forceRerender())

    expect(seen.length).toBeGreaterThanOrEqual(2)
    expect(seen[seen.length - 1].organizations).toBe(seen[0].organizations)
    expect(seen[seen.length - 1].setter).toBe(seen[0].setter)
  })

  it('garde des identités stables pour un utilisateur sans organisation', async () => {
    // C'est LE cas de la régression : `user?.organizations ?? []` recrée un
    // tableau à chaque rendu quand l'utilisateur n'a aucune organisation, et ce
    // tableau est une dépendance du useCallback du setter. Un consommateur qui
    // met les deux dans les dépendances d'un useEffect appelant le setter
    // boucle indéfiniment. Le useMemo du provider est ce qui l'empêche.
    const {seen, forceRerender, Probe} = trackIdentities()

    await renderWithSession(null, <Probe />, false)
    await act(async () => forceRerender())

    expect(seen.length).toBeGreaterThanOrEqual(2)
    expect(seen[seen.length - 1].organizations).toBe(seen[0].organizations)
    expect(seen[seen.length - 1].setter).toBe(seen[0].setter)
  })

  it("expose l'organisation active de la session", async () => {
    function Probe() {
      const {currentOrganization, organizations} = useOrganization()
      return (
        <span data-testid="current">
          {currentOrganization?.slug} / {organizations.length}
        </span>
      )
    }

    await renderWithSession(acme, <Probe />)

    expect(screen.getByTestId('current')).toHaveTextContent('acme / 2')
  })

  it('bascule sur le choix client, met la session à jour et la relit', async () => {
    function Probe() {
      const {currentOrganization, setCurrentOrganization} = useOrganization()
      return (
        <button onClick={() => setCurrentOrganization(acme.id)}>
          {currentOrganization?.slug}
        </button>
      )
    }

    await renderWithSession(techcorp, <Probe />)
    expect(screen.getByRole('button')).toHaveTextContent('techcorp')

    await act(async () => {
      screen.getByRole('button').click()
    })

    // Affichage immédiat, sans attendre le serveur
    expect(screen.getByRole('button')).toHaveTextContent('acme')
    expect(setActiveMock).toHaveBeenCalledWith({organizationId: acme.id})
    expect(refreshMock).toHaveBeenCalled()
  })

  it('ignore une bascule vers l’organisation déjà courante', async () => {
    function Probe() {
      const {setCurrentOrganization} = useOrganization()
      return (
        <button onClick={() => setCurrentOrganization(techcorp.id)}>go</button>
      )
    }

    await renderWithSession(techcorp, <Probe />)
    await act(async () => {
      screen.getByRole('button').click()
    })

    expect(setActiveMock).not.toHaveBeenCalled()
  })
})

describe('OrganizationSync', () => {
  it("active la première organisation quand la session n'en a aucune", async () => {
    await renderWithSession(null, <OrganizationSync />)

    await waitFor(() =>
      expect(setActiveMock).toHaveBeenCalledWith({organizationId: techcorp.id})
    )
  })

  it('ne touche à rien quand la session porte déjà une organisation active', async () => {
    await renderWithSession(techcorp, <OrganizationSync />)

    expect(setActiveMock).not.toHaveBeenCalled()
  })
})
