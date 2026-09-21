'use client'

import {AlertCircle} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {useState, useTransition} from 'react'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {cn} from '@/lib/utils'
import {PageDTO} from '@/services/types/domain/page-types'

/**
 * Statut -> token du design system (§1.1), jamais une couleur choisie a la
 * main. La correspondance est celle du mockup de la story
 * (`docs/designs/s04-pages-cms.html`, ecran 1) :
 *
 * - brouillon -> `muted-foreground` : rien n'est en ligne, etat neutre ;
 * - publiee -> `accent-solid` : la seule couleur vive de la liste ;
 * - depubliee -> `warning-border` : un retrait volontaire, a remarquer.
 *
 * Il n'existe pas de token « succes » ni de vert dans ce systeme (§5) : le vert
 * de la premiere version etait une invention.
 */
const STATUS_DOT_CLASS: Record<PageDTO['status'], string> = {
  draft: 'bg-muted-foreground',
  published: 'bg-accent-solid',
  unpublished: 'bg-warning-border',
}

/** Un `redirect()` de Next voyage avec un `digest` prefixe `NEXT_REDIRECT`. */
const isNavigationSignal = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'digest' in error &&
  String((error as {digest: unknown}).digest).startsWith('NEXT_REDIRECT')

/**
 * Liste des pages du bureau (ecran 1 du design s04) : une seule action en
 * clair par ligne, et un statut qui se lit a son point **et** a son libelle
 * ecrit, jamais a la couleur seule.
 */
export function PagesList({
  pages,
  createAction,
}: {
  pages: PageDTO[]
  createAction: () => Promise<void>
}) {
  const t = useTranslations('BureauPagesPage')
  const [isPending, startTransition] = useTransition()
  const [createError, setCreateError] = useState<string>()

  /**
   * `createPageAction` peut echouer (au-dela de 50 slugs pris, elle leve).
   * Sans ce rattrapage, l'echec partait en rejet non gere et le bouton restait
   * muet : l'erreur s'ecrit dans la page, ancree, jamais en toast (§5).
   *
   * Le succes, lui, se termine par un `redirect()` vers l'editeur. La
   * navigation est prise en charge par le routeur, mais si elle remontait ici
   * sous forme d'erreur, ce n'est pas un echec : rien a afficher.
   */
  const create = () => {
    setCreateError(undefined)
    startTransition(async () => {
      try {
        await createAction()
      } catch (error) {
        if (isNavigationSignal(error)) return
        setCreateError(t('errors.createFailed'))
      }
    })
  }

  return (
    <div className="flex w-full flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-[34px] leading-tight font-semibold">
          {t('title')}
        </h1>
        <Button
          type="button"
          className="h-14 w-full sm:h-11 sm:w-auto"
          disabled={isPending}
          onClick={create}
        >
          {t('newPage.action')}
        </Button>
      </div>

      {createError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>{t('errors.createFailedTitle')}</AlertTitle>
          <AlertDescription>{createError}</AlertDescription>
        </Alert>
      )}

      <Card className="border-0 sm:border">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle>{t('tableTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {pages.length === 0 ? (
            <p className="text-muted-foreground text-[17px]">{t('empty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.title')}</TableHead>
                  <TableHead>{t('columns.status')}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t('columns.updatedAt')}
                  </TableHead>
                  <TableHead>{t('columns.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((page) => (
                  <TableRow key={page.id}>
                    <TableCell>
                      <div className="font-medium">{page.title}</div>
                      <div className="text-muted-foreground text-sm">
                        /{page.slug}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-2">
                        <span
                          aria-hidden="true"
                          className={cn(
                            'size-2 rounded-full',
                            STATUS_DOT_CLASS[page.status]
                          )}
                        />
                        {t(`status.${page.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {page.updatedAt.toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell>
                      <Button
                        asChild
                        variant="outline"
                        className="h-14 w-full sm:h-11 sm:w-auto"
                      >
                        <Link href={`/bureau/pages/${page.id}`}>
                          {t('edit')}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
