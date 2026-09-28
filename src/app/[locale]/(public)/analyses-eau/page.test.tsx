import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
vi.mock('next-intl/server', async () => {
  const messages = (await import('../../../../../messages/fr.json')).default

  return {
    getTranslations:
      async (namespace: string) =>
      (key: string, values?: Record<string, string | number>) => {
        const message = [
          ...namespace.split('.'),
          ...key.split('.'),
        ].reduce<unknown>(
          (node, part) => (node as Record<string, unknown>)?.[part],
          messages
        )

        return Object.entries(values ?? {}).reduce<string>(
          (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
          message as string
        )
      },
    setRequestLocale: vi.fn(),
  }
})
vi.mock('@/app/dal/tenant-dal', () => ({
  requireCurrentTenantDal: vi.fn(async () => ({id: 'org-1'})),
}))
vi.mock('@/app/dal/water-analysis-dal', () => ({
  getPublicWaterAnalysesPageDal: vi.fn(),
  getPublicWaterAnalysisPageCountDal: vi.fn(),
  waterAnalysisFileUrl: (key: string) => `/api/files/${key}`,
}))

import {render, screen, within} from '@/__tests__/customRender'
import {
  getPublicWaterAnalysesPageDal,
  getPublicWaterAnalysisPageCountDal,
} from '@/app/dal/water-analysis-dal'
import {
  WaterAnalysisDTO,
  WaterAnalysisListPageDTO,
} from '@/services/types/domain/water-analysis-types'

import PublicWaterAnalysisPage from './page'

const analysisOf = (
  overrides: Partial<WaterAnalysisDTO> = {}
): WaterAnalysisDTO => ({
  id: 'a1',
  organizationId: 'org-1',
  sampledOn: '2026-09-02',
  posterKey: 'org-1/water-analysis/a1/poster-abc.png',
  reportKey: 'org-1/water-analysis/a1/report-abc.pdf',
  reportBytes: 327_680,
  content: 'Eau conforme aux limites de qualité.',
  createdAt: new Date('2026-09-02'),
  updatedAt: new Date('2026-09-02'),
  ...overrides,
})

const listOf = (
  items: WaterAnalysisDTO[],
  overrides: Partial<WaterAnalysisListPageDTO> = {}
): WaterAnalysisListPageDTO => ({
  items,
  page: 1,
  pageSize: 10,
  total: items.length,
  totalPages: 1,
  ...overrides,
})

const renderPage = async (page?: string) =>
  render(
    await PublicWaterAnalysisPage({
      params: Promise.resolve({locale: 'fr'}),
      searchParams: Promise.resolve(page === undefined ? {} : {page}),
    })
  )

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getPublicWaterAnalysisPageCountDal).mockResolvedValue(1)
})

describe('/analyses-eau — liste publique', () => {
  it('rend les analyses dans l’ordre reçu, sous un titre sans chapeau', async () => {
    vi.mocked(getPublicWaterAnalysesPageDal).mockResolvedValue(
      listOf([
        analysisOf({id: 'a1', sampledOn: '2026-09-02'}),
        analysisOf({id: 'a2', sampledOn: '2026-08-04'}),
        analysisOf({id: 'a3', sampledOn: '2026-07-07'}),
      ])
    )

    await renderPage()

    expect(
      screen.getByRole('heading', {level: 1, name: "Analyses d'eau"})
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole('heading', {level: 2}).map((h) => h.textContent)
    ).toEqual([
      'Prélèvement du 2 septembre 2026',
      'Prélèvement du 4 août 2026',
      'Prélèvement du 7 juillet 2026',
    ])
    expect(getPublicWaterAnalysesPageDal).toHaveBeenCalledWith('org-1', 1)
  })

  it('propose le PDF au téléchargement, nommé et pesé', async () => {
    vi.mocked(getPublicWaterAnalysesPageDal).mockResolvedValue(
      listOf([analysisOf()])
    )

    await renderPage()

    const link = screen.getByRole('link', {
      name: /Résultat complet du 2 septembre 2026 \(PDF, 320 Ko\)/,
    })
    expect(link).toHaveAttribute(
      'href',
      '/api/files/org-1/water-analysis/a1/report-abc.pdf'
    )
    expect(link).toHaveAttribute('download', 'analyse-eau-2026-09-02.pdf')
    expect(within(link).getByText('Télécharger')).toHaveClass('sr-only')
  })

  it('dérive le texte alternatif de l’affiche de la date enregistrée', async () => {
    vi.mocked(getPublicWaterAnalysesPageDal).mockResolvedValue(
      listOf([analysisOf()])
    )

    await renderPage()

    const poster = screen.getByRole('img', {
      name: "Affiche de l'analyse d'eau du 2 septembre 2026.",
    })
    expect(poster).toHaveAttribute(
      'src',
      '/api/files/org-1/water-analysis/a1/poster-abc.png'
    )
    expect(poster).toHaveAttribute('loading', 'lazy')
    expect(poster.closest('figure')?.querySelector('figcaption')).toBeNull()
  })

  it('affiche le texte quand il existe', async () => {
    vi.mocked(getPublicWaterAnalysesPageDal).mockResolvedValue(
      listOf([analysisOf()])
    )

    await renderPage()

    expect(
      screen.getByText('Eau conforme aux limites de qualité.')
    ).toBeInTheDocument()
  })

  it('sans texte : ni bloc vide ni libellé orphelin (critère 3)', async () => {
    vi.mocked(getPublicWaterAnalysesPageDal).mockResolvedValue(
      listOf([analysisOf({content: ''})])
    )

    await renderPage()

    const item = screen.getByRole('listitem')
    expect(item.querySelector('[data-slot="water-analysis-text"]')).toBeNull()
    expect(
      [...item.querySelectorAll('p, div')].filter(
        (element) => element.childElementCount === 0 && !element.textContent
      )
    ).toEqual([])
    expect(within(item).getAllByRole('link')).toHaveLength(1)
    expect(within(item).getByRole('img')).toBeInTheDocument()
    expect(within(item).getByRole('heading', {level: 2})).toBeInTheDocument()
  })

  it("n'a aucun bouton principal", async () => {
    vi.mocked(getPublicWaterAnalysesPageDal).mockResolvedValue(
      listOf([analysisOf()])
    )

    await renderPage()

    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('/analyses-eau — pagination', () => {
  it('rend la page 1 vide avec son état vide, sans action', async () => {
    vi.mocked(getPublicWaterAnalysesPageDal).mockResolvedValue(listOf([]))

    await renderPage()

    expect(
      screen.getByText("Aucune analyse d'eau publiée pour l'instant.")
    ).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('refuse une page hors bornes avant de lire la liste', async () => {
    vi.mocked(getPublicWaterAnalysisPageCountDal).mockResolvedValue(2)

    await expect(renderPage('3')).rejects.toThrow('NEXT_NOT_FOUND')
    expect(getPublicWaterAnalysesPageDal).not.toHaveBeenCalled()
  })

  it.each(['0', 'abc', '2abc'])('refuse le numéro « %s »', async (page) => {
    await expect(renderPage(page)).rejects.toThrow('NEXT_NOT_FOUND')
    expect(getPublicWaterAnalysesPageDal).not.toHaveBeenCalled()
  })

  it('page 2 : « Précédent » actif, « Suivant » annoncé désactivé', async () => {
    vi.mocked(getPublicWaterAnalysisPageCountDal).mockResolvedValue(2)
    vi.mocked(getPublicWaterAnalysesPageDal).mockResolvedValue(
      listOf([analysisOf()], {page: 2, total: 11, totalPages: 2})
    )

    await renderPage('2')

    expect(screen.getByRole('link', {name: '← Précédent'})).toHaveAttribute(
      'href',
      '/analyses-eau?page=1'
    )
    expect(screen.getByText('Suivant →')).toHaveAttribute(
      'aria-disabled',
      'true'
    )
    expect(screen.getByText('Page 2 sur 2')).toBeInTheDocument()
  })
})
