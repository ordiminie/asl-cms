import {render, screen} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    `${key}:${values?.name ?? ''}`,
}))

import {AssociationMark} from './association-mark'

const VERSION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

describe('AssociationMark', () => {
  it('affiche le logo servi par la route versionnee, avec le nom a cote', () => {
    render(
      <AssociationMark
        name="ASL Les Pins"
        logoVersion={VERSION}
        size="public"
      />
    )

    const logo = screen.getByRole('img', {name: 'logoAlt:ASL Les Pins'})
    expect(logo).toHaveAttribute('src', `/api/identity/logo?v=${VERSION}`)
    expect(screen.getByText('ASL Les Pins')).toBeInTheDocument()
    expect(screen.queryByText('LP')).not.toBeInTheDocument()
  })

  it('sans logo, affiche le monogramme de l association, le nom restant ecrit', () => {
    render(<AssociationMark name="ASL Les Pins" size="public" />)

    const monogram = screen.getByRole('img', {
      name: 'monogramLabel:ASL Les Pins',
    })
    expect(monogram).toHaveTextContent('LP')
    expect(screen.getByText('ASL Les Pins')).toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()
  })

  it('occupe un carre de 44 px sur le site public, logo ou monogramme', () => {
    const {container, rerender} = render(
      <AssociationMark name="La Fourche" logoVersion={VERSION} size="public" />
    )
    expect(
      container.querySelector('[data-slot="association-mark-square"]')
    ).toHaveClass('size-11')

    rerender(<AssociationMark name="La Fourche" size="public" />)
    expect(
      container.querySelector('[data-slot="association-mark-square"]')
    ).toHaveClass('size-11')
  })

  it('occupe un carre de 34 px au back-office, logo ou monogramme', () => {
    const {container, rerender} = render(
      <AssociationMark
        name="La Fourche"
        logoVersion={VERSION}
        size="backoffice"
      />
    )
    expect(
      container.querySelector('[data-slot="association-mark-square"]')
    ).toHaveClass('size-8.5')

    rerender(<AssociationMark name="La Fourche" size="backoffice" />)
    expect(
      container.querySelector('[data-slot="association-mark-square"]')
    ).toHaveClass('size-8.5')
  })

  it('le logo est inscrit dans le carre, sans rognage', () => {
    render(
      <AssociationMark name="La Fourche" logoVersion={VERSION} size="public" />
    )

    expect(screen.getByRole('img')).toHaveClass('object-contain')
  })
})
