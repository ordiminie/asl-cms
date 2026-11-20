import {Suspense} from 'react'
import {describe, expect, it, vi} from 'vitest'

import {act, render, screen, within} from '@/__tests__/customRender'
import type {
  MyContactDTO,
  MyInvoicesDTO,
  MyLandDTO,
  MyLandsDTO,
} from '@/services/types/domain/member-space-types'

import {MemberSpace, MemberSpaceLoading} from './member-space'

const CONTACT: MyContactDTO = {
  phone: null,
  homeAddressLine: null,
  homeAddressComplement: null,
  homePostalCode: null,
  homeCity: null,
  landCount: 1,
  divergent: false,
  groups: [],
}

/** Un seul terrain : le cas de s12d. */
const oneLand = (land: MyLandDTO): MyLandsDTO => ({
  accountName: 'Lucie Fictive',
  lands: [land],
})

/** `use()` deroule les promesses : le rendu se termine dans un `act` async. */
const renderSpace = async (
  lands: MyLandsDTO,
  /** `null` : un compte sans fiche, la lecture ne rend rien. */
  invoices: MyInvoicesDTO | null = {
    landCount: 1,
    invoices: [],
    syncedFromPennylane: false,
    syncedAt: null,
    lastSyncFailed: false,
    unlinked: false,
  }
) => {
  const parcelsPromise = Promise.resolve(lands)
  const contactPromise = Promise.resolve({
    ...CONTACT,
    landCount: lands.lands.length,
  })
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <MemberSpace
          landsPromise={parcelsPromise}
          contactPromise={contactPromise}
          contactAction={vi.fn()}
          emailsPromise={Promise.resolve(undefined)}
          emailActions={{
            addEmailAction: vi.fn(),
            updateEmailAction: vi.fn(),
            correctEmailAction: vi.fn(),
            cancelEmailAction: vi.fn(),
          }}
          reportsPromise={Promise.resolve([])}
          reportSent={false}
          invoicesPromise={Promise.resolve(invoices ?? undefined)}
          openInvoicePdfAction={vi.fn()}
        />
      </Suspense>
    )
  })
}

describe('MemberSpace — parcelle importée (s13, date sentinelle)', () => {
  it('écrit « avant l’import » à la place de la date sentinelle', async () => {
    await renderSpace(
      oneLand({
        name: 'Lucie Fictive',
        current: [
          {number: 'ZZ 101', startsOn: '1900-01-01', meterNumber: null},
        ],
        former: [],
      })
    )

    expect(
      await screen.findByText('Propriétaire depuis avant l’import')
    ).toBeInTheDocument()
    expect(screen.queryByText(/1900/)).toBeNull()
  })

  it('écrit la date pour toute autre valeur', async () => {
    await renderSpace(
      oneLand({
        name: 'Lucie Fictive',
        current: [
          {number: 'ZZ 101', startsOn: '2009-09-11', meterNumber: null},
        ],
        former: [],
      })
    )

    expect(
      await screen.findByText(/Propriétaire depuis le .*2009/)
    ).toBeInTheDocument()
  })
})

const myLands = () => screen.getByRole('region', {name: 'Mes terrains'})

/** Bernard Lefevre, trois fiches (design s53). */
const THREE_LANDS: MyLandsDTO = {
  accountName: 'Bernard Lefèvre',
  lands: [
    {
      name: 'Bernard Lefèvre',
      current: [{number: '12', startsOn: '1998-02-03', meterNumber: '0045821'}],
      former: [],
    },
    {
      name: 'Bernard Lefèvre',
      current: [{number: '27', startsOn: '2004-06-01', meterNumber: '0051207'}],
      former: [],
    },
    {
      name: 'SCI Les Pins',
      current: [{number: '31', startsOn: '2011-04-02', meterNumber: null}],
      former: [{number: '8', startsOn: '2001-01-01', endsOn: '2010-01-01'}],
    },
  ],
}

describe('MemberSpace — « Mes terrains » (s53, écran 1)', () => {
  it('1b : un seul terrain garde l’écran de s12d, plus le compteur', async () => {
    await renderSpace(
      oneLand({
        name: 'Lucie Moreau',
        current: [
          {number: '21', startsOn: '2011-04-02', meterNumber: '0045821'},
        ],
        former: [],
      })
    )

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Bonjour Lucie Moreau',
      })
    ).toBeInTheDocument()
    expect(screen.getByText('· Parcelle 21')).toBeInTheDocument()
    expect(myLands()).toHaveTextContent('Compteur 0045821')
    expect(myLands()).toHaveTextContent('Une erreur ? Écrivez au bureau.')
    expect(myLands()).not.toHaveTextContent('terrains sont réunis')
    expect(myLands()).not.toHaveTextContent('Au nom de')
  })

  it('1a : trois terrains, un groupe par fiche, au nom du compte', async () => {
    await renderSpace(THREE_LANDS)

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Bonjour Bernard Lefèvre',
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText('· 3 terrains · Parcelles 12, 27 et 31')
    ).toBeInTheDocument()
    expect(myLands()).toHaveTextContent(
      'Vos 3 terrains sont réunis ici : vous vous connectez une seule fois.'
    )
    const groups = within(myLands()).getAllByTestId('my-land')
    expect(groups).toHaveLength(3)
    expect(groups[0]).toHaveTextContent('Parcelle 12')
    expect(groups[0]).toHaveTextContent('Au nom de Bernard Lefèvre')
    expect(groups[0]).toHaveTextContent('Compteur 0045821')
    expect(groups[2]).toHaveTextContent('Au nom de SCI Les Pins')
    expect(groups[2]).toHaveTextContent('Compteur non renseigné')
    expect(
      within(groups[2]).getByRole('heading', {
        level: 3,
        name: 'Anciennes parcelles',
      })
    ).toBeInTheDocument()
    expect(within(groups[0]).queryByText('Anciennes parcelles')).toBeNull()
    expect(myLands()).toHaveTextContent(
      'Un terrain manque, ou n’est pas à vous ? Écrivez au bureau.'
    )
  })

  it('titre « Ancienne parcelle 8 » un terrain sans parcelle actuelle, et dit depuis quand', async () => {
    await renderSpace({
      accountName: 'Bernard Lefèvre',
      lands: [
        THREE_LANDS.lands[0],
        {
          name: 'SCI Les Pins',
          current: [],
          former: [{number: '8', startsOn: '2001-01-01', endsOn: '2010-01-01'}],
        },
      ],
    })

    const groups = await screen.findAllByTestId('my-land')
    expect(groups[1]).toHaveTextContent('Ancienne parcelle 8')
    expect(groups[1]).toHaveTextContent(
      /Vous n’êtes plus propriétaire d’une parcelle du domaine depuis le/
    )
  })

  it('n’écrit aucun identifiant de fiche dans un lien', async () => {
    await renderSpace(THREE_LANDS)
    await screen.findAllByTestId('my-land')

    for (const link of within(myLands()).getAllByRole('link')) {
      expect(link).toHaveAttribute('href', '/contact')
    }
  })

  it('1c : chargement, trois lignes en attente, sans marqueur', () => {
    render(<MemberSpaceLoading name="Bernard Lefèvre" />)

    const region = screen.getByRole('region', {name: 'Mes terrains'})
    expect(region).toHaveAttribute('aria-busy', 'true')
    expect(region.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3)
    expect(screen.queryByText('Espace personnel')).toBeNull()
  })
})

describe('MemberSpace — « Mes coordonnées » (s55)', () => {
  it('nomme l’adresse du membre « Adresse de domicile », sans terrain', async () => {
    await renderSpace(
      oneLand({
        name: 'Lucie Moreau',
        current: [{number: '21', startsOn: '2011-04-02', meterNumber: null}],
        former: [],
      })
    )

    const card = await screen.findByRole('region', {name: 'Mes coordonnées'})
    expect(card).toHaveTextContent('Adresse de domicile')
    expect(card).toHaveTextContent(
      'L’association vous écrit par courrier à votre adresse de domicile.'
    )
    expect(card).not.toHaveTextContent('Adresse postale')
    expect(card).not.toHaveTextContent('Adresse du terrain')
  })
})

describe('MemberSpace — « Mes factures » (s19, écran 1)', () => {
  const INVOICES: MyInvoicesDTO = {
    landCount: 3,
    syncedFromPennylane: false,
    syncedAt: null,
    lastSyncFailed: false,
    unlinked: false,
    invoices: [
      {
        issuedOn: '2026-03-15',
        subject: 'Cotisation et eau 2026',
        parcelNumbers: ['31'],
        meterNumber: null,
        holderName: 'SCI Les Pins',
        amountCents: 41250,
        dueOn: '2026-04-15',
        status: 'Relance 1',
        statusLabel: 'Relance 1',
        statusClass: 'unpaid',
        hasPdf: false,
        pdfRef: null,
        payment: null,
      },
    ],
  }

  it('critère 10 : rend les factures reçues, quel que soit le fournisseur, juste après « Mes terrains »', async () => {
    await renderSpace(THREE_LANDS, INVOICES)

    const invoices = await screen.findByRole('region', {name: 'Mes factures'})
    expect(within(invoices).getAllByText('Relance 1').length).toBeGreaterThan(0)
    const contact = screen.getByRole('region', {name: 'Mes coordonnées'})
    const follows = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(follows(myLands(), invoices)).toBe(true)
    expect(follows(invoices, contact)).toBe(true)
  })

  it('un compte sans fiche : la carte n’est pas rendue', async () => {
    await renderSpace(THREE_LANDS, null)

    expect(screen.queryByRole('region', {name: 'Mes factures'})).toBeNull()
  })
})
