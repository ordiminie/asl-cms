import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', async () => {
  const actual =
    await vi.importActual<typeof import('next-intl/server')>('next-intl/server')

  return {...actual, setRequestLocale: vi.fn()}
})
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/site-alert-dal', () => ({
  canManageCurrentSiteAlertDal: vi.fn(),
  getSiteAlertForBureauDal: vi.fn(),
  siteAlertTag: (organizationId: string) => `site-alert:${organizationId}`,
}))
vi.mock('./actions', () => ({
  saveSiteAlertAction: vi.fn(),
  removeSiteAlertAction: vi.fn(),
}))

import {render, screen} from '@/__tests__/customRender'
import {
  canManageCurrentSiteAlertDal,
  getSiteAlertForBureauDal,
} from '@/app/dal/site-alert-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'

import BureauAlertPage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const MESSAGE = 'Coupure d’eau rue des Pins, jeudi de 8 h à 12 h.'

/** Le composant de page est asynchrone : on resout son arbre avant de rendre. */
const renderPage = async () => {
  const element = (await BureauAlertPage({
    params: Promise.resolve({locale: 'fr'}),
  })) as ReactElement<{children: ReactElement}>
  const section = element.props.children
  const type = section.type as (props: unknown) => Promise<ReactElement>

  render(await type(section.props))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(getSiteAlertForBureauDal).mockResolvedValue({
    message: MESSAGE,
    active: false,
  })
})

describe('/bureau/alerte — acces par role', () => {
  it('laisse le bureau editer le bandeau, message conserve compris', async () => {
    vi.mocked(canManageCurrentSiteAlertDal).mockResolvedValue(true)

    await renderPage()

    expect(
      screen.getByRole('heading', {level: 1, name: 'Bandeau d’alerte'})
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Message de l’alerte')).toHaveValue(MESSAGE)
    expect(getSiteAlertForBureauDal).toHaveBeenCalledWith(TENANT_ID)
  })

  it('refuse un membre hors du bureau, sans lire le bandeau', async () => {
    vi.mocked(canManageCurrentSiteAlertDal).mockResolvedValue(false)

    await renderPage()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: "Cette page est réservée au bureau de l'association",
      })
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Message de l’alerte')).toBeNull()
    expect(getSiteAlertForBureauDal).not.toHaveBeenCalled()
  })
})
