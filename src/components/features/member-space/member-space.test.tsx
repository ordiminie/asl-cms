import {Suspense} from 'react'
import {describe, expect, it, vi} from 'vitest'

import {act, render, screen} from '@/__tests__/customRender'
import type {
  MyContactDTO,
  MyParcelsDTO,
} from '@/services/types/domain/member-space-types'

import {MemberSpace} from './member-space'

const CONTACT: MyContactDTO = {
  email: 'lucie@exemple.test',
  phone: null,
  addressLine: null,
  addressComplement: null,
  postalCode: null,
  city: null,
}

/** `use()` deroule les promesses : le rendu se termine dans un `act` async. */
const renderSpace = async (parcels: MyParcelsDTO) => {
  const parcelsPromise = Promise.resolve(parcels)
  const contactPromise = Promise.resolve(CONTACT)
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <MemberSpace
          parcelsPromise={parcelsPromise}
          contactPromise={contactPromise}
          contactAction={vi.fn()}
        />
      </Suspense>
    )
  })
}

describe('MemberSpace — parcelle importée (s13, date sentinelle)', () => {
  it('écrit « avant l’import » à la place de la date sentinelle', async () => {
    await renderSpace({
      name: 'Lucie Fictive',
      current: [{number: 'ZZ 101', startsOn: '1900-01-01'}],
      former: [],
    })

    expect(
      await screen.findByText('Propriétaire depuis avant l’import')
    ).toBeInTheDocument()
    expect(screen.queryByText(/1900/)).toBeNull()
  })

  it('écrit la date pour toute autre valeur', async () => {
    await renderSpace({
      name: 'Lucie Fictive',
      current: [{number: 'ZZ 101', startsOn: '2009-09-11'}],
      former: [],
    })

    expect(
      await screen.findByText(/Propriétaire depuis le .*2009/)
    ).toBeInTheDocument()
  })
})
