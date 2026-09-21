import {describe, expect, it} from 'vitest'

import {render, screen} from '@/__tests__/customRender'

import {PreviewBar, PreviewBarStatus} from './preview-bar'

const STATUSES: PreviewBarStatus[] = [
  'draft',
  'dirty',
  'live',
  'publishing',
  'error',
  'unpublished',
]

const bar = (status: PreviewBarStatus) =>
  render(
    <PreviewBar
      status={status}
      title="Qualité de l'eau"
      back={<button type="button">Toutes les pages</button>}
      actions={<button type="button">Publier la page</button>}
    />
  )

describe('PreviewBar', () => {
  it('ecrit le libelle de chacun des six statuts, jamais la couleur seule', () => {
    const labels: Record<PreviewBarStatus, string> = {
      draft: 'Brouillon',
      dirty: 'Modifications non enregistrées',
      live: 'En ligne',
      publishing: 'Publication en cours…',
      error: 'Échec de la dernière action',
      unpublished: 'Dépubliée',
    }

    for (const status of STATUSES) {
      const {unmount} = bar(status)
      expect(screen.getByText(labels[status])).toBeInTheDocument()
      unmount()
    }
  })

  it('colore la pastille avec un token du design system, jamais une couleur choisie a la main', () => {
    const expected: Record<PreviewBarStatus, string> = {
      draft: 'bg-muted-foreground',
      dirty: 'bg-warning-border',
      live: 'bg-accent-solid',
      publishing: 'bg-warning-border',
      error: 'bg-destructive',
      unpublished: 'bg-warning-border',
    }

    for (const status of STATUSES) {
      const {container, unmount} = bar(status)
      const dot = container.querySelector('[aria-hidden="true"]')

      expect(dot?.className).toContain(expected[status])
      expect(dot?.className).not.toContain('oklch')
      unmount()
    }
  })
})
