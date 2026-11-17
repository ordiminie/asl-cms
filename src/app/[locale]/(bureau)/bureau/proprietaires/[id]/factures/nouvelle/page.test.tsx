import {ReactElement} from 'react'
import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'

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
  getMemberParcelsForBureauDal: vi.fn(),
  getMemberProfileForBureauDal: vi.fn(),
}))
vi.mock('@/app/dal/member-invoice-dal', () => ({
  canManageCurrentMemberInvoicesDal: vi.fn(),
  getMemberInvoicesForBureauDal: vi.fn(),
}))
vi.mock('@/app/dal/association-settings-dal', () => ({
  getAssociationSettingsDal: vi.fn(),
}))
vi.mock('../../actions', () => ({
  createMemberInvoiceAction: vi.fn(),
  updateMemberInvoiceAction: vi.fn(),
}))

import {render, screen, userEvent} from '@/__tests__/customRender'
import {getAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {
  canManageCurrentMemberInvoicesDal,
  getMemberInvoicesForBureauDal,
} from '@/app/dal/member-invoice-dal'
import {
  getMemberParcelsForBureauDal,
  getMemberProfileForBureauDal,
} from '@/app/dal/member-profile-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  BILLING_INVOICE_SUBJECT_SETTING_KEY,
  BILLING_SETTLED_STATUSES_SETTING_KEY,
  BILLING_UNPAID_STATUSES_SETTING_KEY,
  resolveSettings,
} from '@/services/types/domain/association-settings-types'
import type {MemberProfileDTO} from '@/services/types/domain/member-profile-types'

import NewMemberInvoicePage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'

const renderPage = async () => {
  const element = (await NewMemberInvoicePage({
    params: Promise.resolve({locale: 'fr', id: PROFILE_ID}),
  })) as ReactElement<{children: ReactElement}>
  const section = element.props.children
  const type = section.type as (props: unknown) => Promise<ReactElement>

  render(await type(section.props))
}

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(canManageCurrentMemberInvoicesDal).mockResolvedValue(true)
  vi.mocked(getMemberProfileForBureauDal).mockResolvedValue({
    id: PROFILE_ID,
    name: 'Bernard Lefèvre',
  } as MemberProfileDTO)
  vi.mocked(getMemberInvoicesForBureauDal).mockResolvedValue({
    canWrite: true,
    invoices: [],
  })
  vi.mocked(getMemberParcelsForBureauDal).mockResolvedValue({
    current: [{parcelId: 'p12', number: '12', startsOn: '1998-02-03'}],
    former: [],
  })
  vi.mocked(getAssociationSettingsDal).mockResolvedValue(
    resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
      {
        key: BILLING_INVOICE_SUBJECT_SETTING_KEY,
        value: 'Cotisation et eau {année}',
      },
      {key: BILLING_UNPAID_STATUSES_SETTING_KEY, value: 'En attente'},
      {key: BILLING_SETTLED_STATUSES_SETTING_KEY, value: 'Payée'},
    ])
  )
})

describe('/bureau/proprietaires/[id]/factures/nouvelle (s19, écran 3)', () => {
  it('rend le formulaire : objet composé du réglage, statuts des réglages', async () => {
    const user = userEvent.setup()
    await renderPage()

    expect(
      screen.getByRole('heading', {level: 1, name: 'Ajouter une facture'})
    ).toBeInTheDocument()
    expect(screen.getByText(/Objet affiché au membre/)).toHaveTextContent(
      'Cotisation et eau'
    )
    await user.click(screen.getByRole('combobox', {name: /Statut/}))
    expect(
      screen.getAllByRole('option').map((option) => option.textContent)
    ).toEqual(['En attente', 'Payée'])
    expect(getMemberParcelsForBureauDal).toHaveBeenCalledWith(
      TENANT_ID,
      PROFILE_ID
    )
  })

  it('refuse un compte qui ne gère pas les factures, sans rien lire', async () => {
    vi.mocked(canManageCurrentMemberInvoicesDal).mockResolvedValue(false)

    await renderPage()

    expect(getMemberProfileForBureauDal).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('button', {name: 'Enregistrer la facture'})
    ).toBeNull()
  })

  it('introuvable pour une fiche absente — celle d’une autre association comprise', async () => {
    vi.mocked(getMemberProfileForBureauDal).mockResolvedValue(undefined)

    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('introuvable quand le fournisseur de l’association ne permet pas la saisie', async () => {
    vi.mocked(getMemberInvoicesForBureauDal).mockResolvedValue({
      canWrite: false,
      invoices: [],
    })

    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
