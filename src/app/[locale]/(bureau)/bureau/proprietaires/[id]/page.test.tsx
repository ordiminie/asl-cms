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
vi.mock('@/app/dal/member-invoice-dal', () => ({
  getMemberInvoicesForBureauDal: vi.fn(),
}))
vi.mock('@/app/dal/member-document-dal', () => ({
  getMemberDocumentsOfProfileForBureauDal: vi.fn(),
}))
vi.mock('../../documents-nominatifs/actions', () => ({
  removeMemberDocumentAction: vi.fn(),
}))
vi.mock('@/app/dal/association-settings-dal', () => ({
  getAssociationSettingsDal: vi.fn(),
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
  inviteMemberProfileAction: vi.fn(),
  updateMemberProfileContactAction: vi.fn(),
}))
vi.mock('./actions', () => ({
  addMemberProfileEmailAction: vi.fn(),
  designateMemberProfileHolderAction: vi.fn(),
  removeMemberProfileEmailAction: vi.fn(),
  updateMemberProfileEmailAction: vi.fn(),
  updateMemberProfilePennylaneIdAction: vi.fn(),
}))

import {render, screen, userEvent, within} from '@/__tests__/customRender'
import {getAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {getMemberDocumentsOfProfileForBureauDal} from '@/app/dal/member-document-dal'
import {getMemberInvoicesForBureauDal} from '@/app/dal/member-invoice-dal'
import {getMemberNotesForBureauDal} from '@/app/dal/member-note-dal'
import {
  canManageCurrentMemberProfilesDal,
  getMemberParcelsForBureauDal,
  getMemberProfileForBureauDal,
} from '@/app/dal/member-profile-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {getMemberUnsubscribeForBureauDal} from '@/app/dal/unsubscribe-dal'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  resolveSettings,
} from '@/services/types/domain/association-settings-types'

import BureauMemberProfilePage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'

const profile = {
  id: PROFILE_ID,
  organizationId: TENANT_ID,
  name: 'Hélène Roy',
  email: null,
  phone: null,
  homeAddressLine: '8 chemin des Pins',
  homeAddressComplement: null,
  homePostalCode: '33680',
  homeCity: 'Lacanau',
  landAddressLine: null,
  landAddressComplement: null,
  landPostalCode: null,
  landCity: null,
  companyName: 'Épicerie du Clos' as string | null,
  mailOnly: true,
  incomplete: false,
  emails: [],
  account: {status: 'mail_only' as const},
  pennylaneCustomerId: null,
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
  searchParams: {
    cree?: string
    vente?: string
    notes?: string
    facture?: string
    documents?: string
    document?: string
  } = {}
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
  vi.mocked(getMemberInvoicesForBureauDal).mockReturnValue(
    new Promise(() => {})
  )
  vi.mocked(getMemberDocumentsOfProfileForBureauDal).mockReturnValue(
    new Promise(() => {})
  )
  vi.mocked(getAssociationSettingsDal).mockResolvedValue(
    resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [])
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

  it('montre le domicile, le nom de l’entreprise, et un terrain absent « Non renseignée » (s55)', async () => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(true)

    await renderPage()

    const contact = screen.getByRole('region', {name: 'Coordonnées'})
    const valueOf = (label: string) =>
      within(contact).getByText(label).nextElementSibling
    expect(valueOf('Adresse de domicile')).toHaveTextContent(
      '8 chemin des Pins33680 Lacanau'
    )
    expect(valueOf('Adresse du terrain')).toHaveTextContent(/^Non renseignée$/)
    expect(valueOf('Nom de l’entreprise')).toHaveTextContent(
      /^Épicerie du Clos/
    )
  })

  it('nomme le groupe dans le message d’un code postal du terrain refusé (s55, état 1e)', async () => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(true)

    await renderPage()
    await userEvent.click(
      screen.getByRole('button', {name: 'Modifier les coordonnées'})
    )
    const land = screen.getByRole('group', {name: /Adresse du terrain/})
    await userEvent.type(within(land).getByLabelText('Code postal'), '123')
    await userEvent.click(
      screen.getByRole('button', {name: 'Enregistrer les coordonnées'})
    )

    expect(
      within(land).getByText('Terrain : le code postal compte cinq chiffres.')
    ).toBeInTheDocument()
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

describe('/bureau/proprietaires/[id] — carte « Factures » (s19, écran 2)', () => {
  const INVOICE_ID = '66666666-6666-4666-8666-666666666666'
  const invoices = (canWrite: boolean) => ({
    canWrite,
    syncedFromPennylane: false,
    syncedAt: null,
    invoices: [
      {
        id: INVOICE_ID,
        memberProfileId: PROFILE_ID,
        parcelId: 'p12',
        parcelNumber: '12',
        meterNumber: null,
        source: 'pennylane' as const,
        year: 2026,
        issuedOn: '2026-03-15',
        dueOn: '2026-04-15',
        amountCents: 41250,
        status: 'En attente',
        hasPdf: false,
        subject: 'Cotisation et eau 2026',
        statusClass: 'unpaid' as const,
      },
    ],
  })

  beforeEach(() => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(true)
  })

  it('lit les factures de la fiche pour le tenant courant, sans les attendre', async () => {
    await renderPage()

    expect(getMemberInvoicesForBureauDal).toHaveBeenCalledWith(
      TENANT_ID,
      PROFILE_ID
    )
    expect(
      screen.getByRole('heading', {level: 1, name: 'Hélène Roy'})
    ).toBeInTheDocument()
  })

  it('une facture Pennylane : aucune action « Modifier » ; l’ajout existe si le fournisseur permet la saisie', async () => {
    vi.mocked(getMemberInvoicesForBureauDal).mockResolvedValue(invoices(true))

    await renderPage()

    const card = await screen.findByRole('region', {name: 'Factures'})
    expect(within(card).queryByRole('link', {name: /Modifier/})).toBeNull()
    expect(
      within(card).getByRole('link', {name: 'Ajouter une facture'})
    ).toBeInTheDocument()
  })

  it('fournisseur en lecture seule : pas de bouton « Ajouter une facture »', async () => {
    vi.mocked(getMemberInvoicesForBureauDal).mockResolvedValue(invoices(false))

    await renderPage()

    const card = await screen.findByRole('region', {name: 'Factures'})
    expect(
      within(card).queryByRole('link', {name: 'Ajouter une facture'})
    ).toBeNull()
  })

  it('un compte qui ne gère pas les factures : la carte n’est pas rendue', async () => {
    vi.mocked(getMemberInvoicesForBureauDal).mockResolvedValue(undefined)

    await renderPage()

    await screen.findByRole('region', {name: 'Parcelles'})
    expect(screen.queryByRole('region', {name: 'Factures'})).toBeNull()
  })

  it('3c : ?facture=enregistree dit l’enregistrement dans la carte', async () => {
    vi.mocked(getMemberInvoicesForBureauDal).mockResolvedValue(invoices(true))

    await renderPage({facture: 'enregistree'})

    const card = await screen.findByRole('region', {name: 'Factures'})
    expect(within(card).getByRole('status')).toHaveTextContent(
      'Facture enregistrée. Hélène Roy la voit dès maintenant'
    )
  })

  it('ne lit aucune facture pour un membre simple', async () => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(false)

    await renderPage()

    expect(getMemberInvoicesForBureauDal).not.toHaveBeenCalled()
  })
})

describe('/bureau/proprietaires/[id] — invitation (s42a, écran 2)', () => {
  const invitable = {
    ...profile,
    mailOnly: false,
    emails: [
      {
        id: 'email-1',
        email: 'helene@exemple.fr',
        role: 'holder' as const,
        status: 'active' as const,
        origin: 'site' as const,
        addedByName: null,
        expiresAt: null,
        replacesEmailId: null,
        boardRole: null,
        otherProfiles: [],
        invitation: {state: 'never' as const, at: null},
      },
    ],
  }

  it('dit la durée du lien lue dans les réglages de l’association du domaine', async () => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(true)
    vi.mocked(getMemberProfileForBureauDal).mockResolvedValue(invitable)
    vi.mocked(getAssociationSettingsDal).mockResolvedValue(
      resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
        {key: 'invitation.link_days', value: '12'},
      ])
    )

    await renderPage()

    expect(getAssociationSettingsDal).toHaveBeenCalledWith(TENANT_ID)
    const card = screen.getByRole('region', {name: 'Accès à l’espace membre'})
    expect(
      within(card).getByRole('button', {name: 'Envoyer l’invitation'})
    ).toBeInTheDocument()
    expect(card).toHaveTextContent('valable 12 jours')
  })
})

describe('/bureau/proprietaires/[id] — section « Documents » (s32)', () => {
  const DOCUMENT_ID = '55555555-5555-4555-8555-555555555555'
  const documents = [
    {
      id: DOCUMENT_ID,
      title: 'Facture 2026',
      categoryId: '44444444-4444-4444-8444-444444444444',
      categoryName: 'Facture',
      documentDate: '2026-03-15',
      fileBytes: 1024,
      createdAt: new Date(),
      memberProfileId: PROFILE_ID,
      memberProfileName: 'Hélène Roy',
    },
  ]

  beforeEach(() => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(true)
  })

  it('lit les documents de la fiche pour le tenant courant et les montre après les factures', async () => {
    vi.mocked(getMemberDocumentsOfProfileForBureauDal).mockResolvedValue(
      documents
    )

    await renderPage()

    expect(getMemberDocumentsOfProfileForBureauDal).toHaveBeenCalledWith(
      TENANT_ID,
      PROFILE_ID
    )
    const card = await screen.findByRole('region', {name: 'Documents'})
    expect(card).toHaveTextContent('Facture 2026')
    expect(card).toHaveTextContent('Cette fiche n’est reliée à aucun compte')
  })

  it('un compte qui ne gère pas les documents : la section n’est pas rendue', async () => {
    vi.mocked(getMemberDocumentsOfProfileForBureauDal).mockResolvedValue(
      undefined
    )

    await renderPage()

    await screen.findByRole('region', {name: 'Parcelles'})
    expect(screen.queryByRole('region', {name: 'Documents'})).toBeNull()
  })

  it('2e : ?documents=depose&document= dit le dépôt avec le titre', async () => {
    vi.mocked(getMemberDocumentsOfProfileForBureauDal).mockResolvedValue(
      documents
    )

    await renderPage({documents: 'depose', document: DOCUMENT_ID})

    const card = await screen.findByRole('region', {name: 'Documents'})
    expect(within(card).getByRole('status')).toHaveTextContent(
      'Document déposé. « Facture 2026 »'
    )
  })
})
