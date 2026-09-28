import {describe, expect, it} from 'vitest'

import {render, screen, within} from '@/__tests__/customRender'
import {
  WaterAnalysisDTO,
  WaterAnalysisListPageDTO,
} from '@/services/types/domain/water-analysis-types'

import {WaterAnalysisList} from './water-analysis-list'

const ORG_ID = '11111111-1111-4111-8111-111111111111'

const analysisOf = (
  id: string,
  sampledOn: string,
  reportBytes = 327_680
): WaterAnalysisDTO => ({
  id,
  organizationId: ORG_ID,
  sampledOn,
  posterKey: `${ORG_ID}/water-analysis/${id}/poster-abc.png`,
  reportKey: `${ORG_ID}/water-analysis/${id}/report-abc.pdf`,
  reportBytes,
  content: '',
  createdAt: new Date('2026-09-02'),
  updatedAt: new Date('2026-09-02'),
})

const listOf = (
  items: WaterAnalysisDTO[],
  overrides: Partial<WaterAnalysisListPageDTO> = {}
): WaterAnalysisListPageDTO => ({
  items,
  page: 1,
  pageSize: 25,
  total: items.length,
  totalPages: 1,
  ...overrides,
})

const A1 = '33333333-3333-4333-8333-333333333333'
const A2 = '44444444-4444-4444-8444-444444444444'

describe('WaterAnalysisList — liste du bureau', () => {
  it("rend l'état vide avec son lien vers la première publication", () => {
    render(<WaterAnalysisList list={listOf([])} />)

    expect(
      screen.getByText(/^Aucune analyse publiée pour l.instant\.$/)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: /Publier la première/})
    ).toHaveAttribute('href', '/bureau/analyses-eau/nouvelle')
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('un seul bouton principal pour publier', () => {
    render(<WaterAnalysisList list={listOf([analysisOf(A1, '2026-09-02')])} />)

    expect(
      screen.getByRole('link', {name: 'Publier une analyse'})
    ).toHaveAttribute('href', '/bureau/analyses-eau/nouvelle')
  })

  it('écrit la date au format court, le poids du PDF et jamais le nom du fichier', () => {
    render(
      <WaterAnalysisList
        list={listOf([
          analysisOf(A1, '2026-09-02', 327_680),
          analysisOf(A2, '2026-08-04', 4.2 * 1024 * 1024),
        ])}
      />
    )

    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('02/09/2026')).toBeInTheDocument()
    expect(within(rows[0]).getByText('320 Ko')).toBeInTheDocument()
    expect(within(rows[1]).getByText('4,2 Mo')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/report-|\.pdf/)
  })

  it('un seul lien « Modifier » par ligne, vers son analyse', () => {
    render(
      <WaterAnalysisList
        list={listOf([
          analysisOf(A1, '2026-09-02'),
          analysisOf(A2, '2026-08-04'),
        ])}
      />
    )

    const rows = screen.getAllByRole('row').slice(1)
    for (const [index, id] of [A1, A2].entries()) {
      const links = within(rows[index]).getAllByRole('link')
      expect(links).toHaveLength(1)
      expect(links[0]).toHaveTextContent('Modifier')
      expect(links[0]).toHaveAttribute('href', `/bureau/analyses-eau/${id}`)
    }
  })

  it('annonce la pagination désactivée, sans la cacher', () => {
    render(<WaterAnalysisList list={listOf([analysisOf(A1, '2026-09-02')])} />)

    expect(screen.getByText('Page 1 sur 1')).toBeInTheDocument()
    for (const label of ['Précédent', 'Suivant']) {
      const control = screen.getByRole('button', {name: label})
      expect(control).toHaveAttribute('aria-disabled', 'true')
    }
  })

  it('rend un lien de page quand une page suit', () => {
    render(
      <WaterAnalysisList
        list={listOf([analysisOf(A1, '2026-09-02')], {
          total: 30,
          totalPages: 2,
        })}
      />
    )

    expect(screen.getByRole('link', {name: 'Suivant'})).toHaveAttribute(
      'href',
      '/bureau/analyses-eau?page=2'
    )
  })

  it.each([
    ['published', /L.analyse est publiée/],
    ['saved', /Les modifications sont enregistrées/],
    ['deleted', /L.analyse est supprimée/],
  ] as const)(
    'confirme %s par un message ancré, annoncé poliment',
    (notice, text) => {
      render(
        <WaterAnalysisList
          list={listOf([analysisOf(A1, '2026-09-02')])}
          notice={notice}
        />
      )

      expect(screen.getByRole('status')).toHaveTextContent(text)
    }
  )
})
