import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

const navigation = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  notFound: navigation.notFound,
  useRouter: () => ({push: vi.fn()}),
}))
vi.mock('next-intl/server', async () => {
  const actual =
    await vi.importActual<typeof import('next-intl/server')>('next-intl/server')

  return {...actual, setRequestLocale: vi.fn()}
})
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/member-profile-dal', () => ({
  canManageCurrentMemberProfilesDal: vi.fn(),
  getMemberProfileForBureauDal: vi.fn(),
  getSaleContextForBureauDal: vi.fn(),
}))
vi.mock('../../../actions', () => ({
  recordSaleAction: vi.fn(),
  searchBuyersAction: vi.fn(),
}))

import {render, screen} from '@/__tests__/customRender'
import {
  canManageCurrentMemberProfilesDal,
  getMemberProfileForBureauDal,
  getSaleContextForBureauDal,
} from '@/app/dal/member-profile-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'

import BureauSalePage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const SELLER_ID = '33333333-3333-4333-8333-333333333333'
const BUYER_ID = '44444444-4444-4444-8444-444444444444'
const PARCEL_ID = '66666666-6666-4666-8666-666666666666'

const saleContext = {
  parcelId: PARCEL_ID,
  parcelNumber: '47',
  seller: {memberProfileId: SELLER_ID, name: 'Jean et Odile Dubois'},
  periods: [
    {
      id: 'period-dubois',
      memberProfileId: SELLER_ID,
      memberName: 'Jean et Odile Dubois',
      startsOn: '1998-02-03',
      endsOn: null,
    },
  ],
}

/** Le composant de page est asynchrone : on resout son arbre avant de rendre. */
const renderPage = async (
  searchParams: {acquereur?: string; date?: string} = {}
) => {
  const element = (await BureauSalePage({
    params: Promise.resolve({locale: 'fr', id: SELLER_ID, parcelId: PARCEL_ID}),
    searchParams: Promise.resolve(searchParams),
  })) as ReactElement<{children: ReactElement}>
  const section = element.props.children
  const type = section.type as (props: unknown) => Promise<ReactElement>

  render(await type(section.props))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(true)
  vi.mocked(getSaleContextForBureauDal).mockResolvedValue(saleContext)
  vi.mocked(getMemberProfileForBureauDal).mockResolvedValue({
    id: BUYER_ID,
    organizationId: TENANT_ID,
    name: 'Paul Ferrand',
    email: null,
    phone: null,
    addressLine: null,
    addressComplement: null,
    postalCode: null,
    city: null,
    mailOnly: true,
    incomplete: true,
  })
})

describe('/bureau/proprietaires/[id]/vente/[parcelId]', () => {
  it('montre l’écran de vente de la parcelle au bureau', async () => {
    await renderPage()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Enregistrer la vente de la parcelle 47',
      })
    ).toBeInTheDocument()
    expect(getSaleContextForBureauDal).toHaveBeenCalledWith(
      TENANT_ID,
      SELLER_ID,
      PARCEL_ID
    )
    expect(getMemberProfileForBureauDal).not.toHaveBeenCalled()
  })

  it('présélectionne l’acquéreur et conserve la date au retour de sa création', async () => {
    await renderPage({acquereur: BUYER_ID, date: '2026-06-15'})

    expect(getMemberProfileForBureauDal).toHaveBeenCalledWith(
      TENANT_ID,
      BUYER_ID
    )
    expect(screen.getByLabelText('Date de la vente')).toHaveValue('15/06/2026')
    expect(screen.getByRole('combobox', {name: /Acquéreur/})).toHaveTextContent(
      'Paul Ferrand'
    )
  })

  it('ignore une date malformée et un acquéreur introuvable', async () => {
    vi.mocked(getMemberProfileForBureauDal).mockResolvedValue(undefined)

    await renderPage({acquereur: BUYER_ID, date: '2026-02-30'})

    expect(screen.getByLabelText('Date de la vente')).not.toHaveValue(
      '30/02/2026'
    )
    expect(screen.getByRole('combobox', {name: /Acquéreur/})).toHaveTextContent(
      'Rechercher un propriétaire par son nom'
    )
  })

  it('refuse un membre simple, sans rien lire', async () => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(false)

    await renderPage()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: "Cette page est réservée au bureau de l'association",
      })
    ).toBeInTheDocument()
    expect(getSaleContextForBureauDal).not.toHaveBeenCalled()
  })

  it('rend la page introuvable quand la fiche ne possède pas la parcelle', async () => {
    vi.mocked(getSaleContextForBureauDal).mockResolvedValue(undefined)

    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
