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
  getMemberInvoiceForBureauDal: vi.fn(),
  getMemberInvoicesForBureauDal: vi.fn(),
}))
vi.mock('@/app/dal/association-settings-dal', () => ({
  getAssociationSettingsDal: vi.fn(),
}))
vi.mock('../../actions', () => ({
  createMemberInvoiceAction: vi.fn(),
  updateMemberInvoiceAction: vi.fn(),
}))

import {render, screen} from '@/__tests__/customRender'
import {getAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {
  canManageCurrentMemberInvoicesDal,
  getMemberInvoiceForBureauDal,
  getMemberInvoicesForBureauDal,
} from '@/app/dal/member-invoice-dal'
import {
  getMemberParcelsForBureauDal,
  getMemberProfileForBureauDal,
} from '@/app/dal/member-profile-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  BILLING_UNPAID_STATUSES_SETTING_KEY,
  resolveSettings,
} from '@/services/types/domain/association-settings-types'
import type {BoardInvoiceDTO} from '@/services/types/domain/member-invoice-types'
import type {MemberProfileDTO} from '@/services/types/domain/member-profile-types'

import MemberInvoicePage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const INVOICE_ID = '66666666-6666-4666-8666-666666666666'

const invoice = (
  overrides: Partial<BoardInvoiceDTO> = {}
): BoardInvoiceDTO => ({
  id: INVOICE_ID,
  memberProfileId: PROFILE_ID,
  parcelId: 'p12',
  parcelNumber: '12',
  meterNumber: null,
  source: 'site',
  year: 2026,
  issuedOn: '2026-03-15',
  dueOn: '2026-04-15',
  amountCents: 41250,
  status: 'En attente',
  hasPdf: false,
  subject: 'Cotisation et eau 2026',
  statusClass: 'unpaid',
  ...overrides,
})

const renderPage = async () => {
  const element = (await MemberInvoicePage({
    params: Promise.resolve({
      locale: 'fr',
      id: PROFILE_ID,
      invoiceId: INVOICE_ID,
    }),
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
  vi.mocked(getMemberInvoiceForBureauDal).mockResolvedValue(invoice())
  vi.mocked(getMemberInvoicesForBureauDal).mockResolvedValue({
    canWrite: true,
    syncedFromPennylane: false,
    syncedAt: null,
    invoices: [],
  })
  vi.mocked(getMemberParcelsForBureauDal).mockResolvedValue({
    current: [{parcelId: 'p12', number: '12', startsOn: '1998-02-03'}],
    former: [],
  })
  vi.mocked(getAssociationSettingsDal).mockResolvedValue(
    resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
      {key: BILLING_UNPAID_STATUSES_SETTING_KEY, value: 'En attente'},
    ])
  )
})

describe('/bureau/proprietaires/[id]/factures/[invoiceId] (s19, écran 3)', () => {
  it('une facture du site : le formulaire de correction, prérempli', async () => {
    await renderPage()

    expect(getMemberInvoiceForBureauDal).toHaveBeenCalledWith(
      TENANT_ID,
      PROFILE_ID,
      INVOICE_ID
    )
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Modifier la facture du 15/03/2026',
      })
    ).toBeInTheDocument()
    expect(screen.getByRole('textbox', {name: /Montant/})).toHaveValue('412,50')
  })

  it('3d, critère 9 : une facture Pennylane se lit, sans aucun formulaire', async () => {
    vi.mocked(getMemberInvoiceForBureauDal).mockResolvedValue(
      invoice({source: 'pennylane'})
    )

    await renderPage()

    expect(
      screen.getByText(
        'Cette facture vient de Pennylane. Elle se lit ici mais se corrige dans Pennylane.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(
      screen.queryByRole('button', {name: 'Enregistrer la facture'})
    ).toBeNull()
    expect(screen.getByText('412,50 €')).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Revenir à la fiche'})
    ).toHaveAttribute('href', `/bureau/proprietaires/${PROFILE_ID}`)
  })

  it('une facture Pennylane sans parcelle : la ligne « Parcelle » est omise (s20, ADR 062 §4)', async () => {
    vi.mocked(getMemberInvoiceForBureauDal).mockResolvedValue(
      invoice({source: 'pennylane', parcelId: null, parcelNumber: null})
    )

    await renderPage()

    expect(screen.queryByText('Terrain facturé')).toBeNull()
    expect(screen.getByText('412,50 €')).toBeInTheDocument()
  })

  it('fournisseur en lecture seule : la facture du site se lit, sans formulaire', async () => {
    vi.mocked(getMemberInvoicesForBureauDal).mockResolvedValue({
      canWrite: false,
      syncedFromPennylane: false,
      syncedAt: null,
      invoices: [],
    })

    await renderPage()

    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('identifiant forgé : introuvable', async () => {
    vi.mocked(getMemberInvoiceForBureauDal).mockResolvedValue(undefined)

    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('refuse un compte qui ne gère pas les factures, sans rien lire', async () => {
    vi.mocked(canManageCurrentMemberInvoicesDal).mockResolvedValue(false)

    await renderPage()

    expect(getMemberInvoiceForBureauDal).not.toHaveBeenCalled()
  })
})
