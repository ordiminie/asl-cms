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
  getMemberParcelsForBureauDal: vi.fn(),
  getMemberProfileForBureauDal: vi.fn(),
}))
vi.mock('@/app/dal/member-note-dal', () => ({
  getMemberNotesForBureauDal: vi.fn(),
}))
vi.mock('@/app/dal/unsubscribe-dal', () => ({
  getMemberUnsubscribeForBureauDal: vi.fn(),
}))
vi.mock('../notes-actions', () => ({
  addMemberNoteAction: vi.fn(),
  addMemberExchangeAction: vi.fn(),
  updateMemberNoteAction: vi.fn(),
  deleteMemberNoteAction: vi.fn(),
}))
vi.mock('../actions', () => ({
  attachParcelAction: vi.fn(),
  changeMemberRoleAction: vi.fn(),
  updateMemberProfileContactAction: vi.fn(),
}))

import {render, screen} from '@/__tests__/customRender'
import {getMemberNotesForBureauDal} from '@/app/dal/member-note-dal'
import {
  canManageCurrentMemberProfilesDal,
  getMemberParcelsForBureauDal,
  getMemberProfileForBureauDal,
} from '@/app/dal/member-profile-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {getMemberUnsubscribeForBureauDal} from '@/app/dal/unsubscribe-dal'

import BureauMemberProfilePage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'

const profile = {
  id: PROFILE_ID,
  organizationId: TENANT_ID,
  name: 'Hélène Roy',
  email: null,
  phone: null,
  addressLine: '8 chemin des Pins',
  addressComplement: null,
  postalCode: '33680',
  city: 'Lacanau',
  mailOnly: true,
  incomplete: false,
  account: {status: 'mail_only' as const},
  roleCard: {
    reading: 'no_account' as const,
    canEdit: false,
    notice: null,
    options: [],
    self: false,
  },
}

/** Le composant de page est asynchrone : on resout son arbre avant de rendre. */
const renderPage = async (
  searchParams: {cree?: string; vente?: string; notes?: string} = {}
) => {
  const element = (await BureauMemberProfilePage({
    params: Promise.resolve({locale: 'fr', id: PROFILE_ID}),
    searchParams: Promise.resolve(searchParams),
  })) as ReactElement<{children: ReactElement}>
  const section = element.props.children
  const type = section.type as (props: unknown) => Promise<ReactElement>

  render(await type(section.props))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(getMemberProfileForBureauDal).mockResolvedValue(profile)
  vi.mocked(getMemberParcelsForBureauDal).mockResolvedValue({
    current: [],
    former: [],
  })
  vi.mocked(getMemberNotesForBureauDal).mockReturnValue(new Promise(() => {}))
  vi.mocked(getMemberUnsubscribeForBureauDal).mockReturnValue(
    new Promise(() => {})
  )
})

describe('/bureau/proprietaires/[id] — accès par rôle', () => {
  it('montre la fiche et ses parcelles au bureau', async () => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(true)

    await renderPage()

    expect(
      screen.getByRole('heading', {level: 1, name: 'Hélène Roy'})
    ).toBeInTheDocument()
    expect(getMemberProfileForBureauDal).toHaveBeenCalledWith(
      TENANT_ID,
      PROFILE_ID
    )
    expect(getMemberParcelsForBureauDal).toHaveBeenCalledWith(
      TENANT_ID,
      PROFILE_ID
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('dit « Propriétaire enregistré. » à l’arrivée depuis la création', async () => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(true)

    await renderPage({cree: '1'})

    expect(screen.getByRole('status')).toHaveTextContent(
      'Propriétaire enregistré.'
    )
  })

  it('dit la vente enregistrée au retour de l’écran de vente', async () => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(true)
    vi.mocked(getMemberParcelsForBureauDal).mockResolvedValue({
      current: [],
      former: [
        {
          parcelId: 'parcel-47',
          number: '47',
          startsOn: '1998-02-03',
          endsOn: '2026-06-15',
          soldTo: {memberProfileId: 'ferrand', name: 'Paul Ferrand'},
        },
      ],
    })

    await renderPage({vente: 'parcel-47'})

    expect(screen.getByRole('status')).toHaveTextContent(
      'Vente enregistrée. La parcelle 47 est à Paul Ferrand depuis le 15/06/2026.'
    )
  })

  it('refuse un membre simple, sans lire la fiche', async () => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(false)

    await renderPage()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: "Cette page est réservée au bureau de l'association",
      })
    ).toBeInTheDocument()
    expect(getMemberProfileForBureauDal).not.toHaveBeenCalled()
    expect(getMemberParcelsForBureauDal).not.toHaveBeenCalled()
  })

  it('rend la page introuvable pour une fiche absente — celle d’une autre association comprise', async () => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(true)
    vi.mocked(getMemberProfileForBureauDal).mockResolvedValue(undefined)

    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(getMemberParcelsForBureauDal).not.toHaveBeenCalled()
  })
})

describe('/bureau/proprietaires/[id] — notes et échanges (s24)', () => {
  beforeEach(() => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(true)
  })

  it('lit le fil de la fiche pour le tenant courant, page 1 par défaut, sans l’attendre', async () => {
    await renderPage()

    expect(getMemberNotesForBureauDal).toHaveBeenCalledWith(
      TENANT_ID,
      PROFILE_ID,
      1
    )
    expect(
      screen.getByRole('heading', {level: 2, name: 'Notes et échanges'})
    ).toBeInTheDocument()
  })

  it('lit la page demandée par ?notes=', async () => {
    await renderPage({notes: '2'})

    expect(getMemberNotesForBureauDal).toHaveBeenCalledWith(
      TENANT_ID,
      PROFILE_ID,
      2
    )
  })

  it.each(['0', '-3', 'abc', '1.5'])(
    'ramène un paramètre ?notes=%s invalide à la page 1',
    async (notes) => {
      await renderPage({notes})

      expect(getMemberNotesForBureauDal).toHaveBeenCalledWith(
        TENANT_ID,
        PROFILE_ID,
        1
      )
    }
  )

  it('ne lit aucune note pour un membre simple', async () => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(false)

    await renderPage()

    expect(getMemberNotesForBureauDal).not.toHaveBeenCalled()
  })

  it('ne lit aucune note pour une fiche introuvable', async () => {
    vi.mocked(getMemberProfileForBureauDal).mockResolvedValue(undefined)

    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(getMemberNotesForBureauDal).not.toHaveBeenCalled()
  })
})

describe('/bureau/proprietaires/[id] — désinscription des campagnes (s25)', () => {
  beforeEach(() => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(true)
  })

  it('lit le refus de la fiche pour le tenant courant, sans l’attendre', async () => {
    await renderPage()

    expect(getMemberUnsubscribeForBureauDal).toHaveBeenCalledWith(
      TENANT_ID,
      PROFILE_ID
    )
    expect(
      screen.getByRole('heading', {level: 1, name: 'Hélène Roy'})
    ).toBeInTheDocument()
  })

  it('ne lit aucun refus pour un membre simple', async () => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(false)

    await renderPage()

    expect(getMemberUnsubscribeForBureauDal).not.toHaveBeenCalled()
  })
})
