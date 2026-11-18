import {CircleCheck} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'

import {Alert, AlertTitle} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Card, CardContent} from '@/components/ui/card'
import {Skeleton} from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {RecipientGroupDTO} from '@/services/types/domain/recipient-group-types'

import {
  type RecipientGroupNameAction,
  RecipientGroupNameDialog,
} from './recipient-group-name-dialog'
import {recipientGroupPathOf} from './recipient-group-paths'

type RecipientGroupListProps = {
  groups: RecipientGroupDTO[]
  /** Le groupe qui vient d'etre supprime, pour l'alerte de succes. */
  deletedName?: string
  createAction: RecipientGroupNameAction
}

/**
 * « Groupes de destinataires » (ecran 3 de s27) : le tableau Nom · Fiches ·
 * « Ouvrir » en bureau, des cartes empilees sous 640 px (§3.5), et
 * « Creer un groupe ». Un groupe sert de cible a une campagne.
 */
export function RecipientGroupList({
  groups,
  deletedName,
  createAction,
}: RecipientGroupListProps) {
  const t = useTranslations('RecipientGroupsBureau')

  return (
    <div className="flex w-full flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-[34px] leading-tight font-semibold">
            {t('title')}
          </h1>
          <p className="text-muted-foreground text-[15px]">{t('intro')}</p>
        </div>
        <RecipientGroupNameDialog
          mode="create"
          action={createAction}
          triggerLabel={t('create')}
        />
      </div>

      {deletedName && (
        <Alert role="status">
          <CircleCheck aria-hidden="true" className="text-primary" />
          <AlertTitle className="text-[15px] whitespace-normal">
            {t('deleted', {name: deletedName})}
          </AlertTitle>
        </Alert>
      )}

      {groups.length === 0 ? (
        <Card className="items-start gap-3 px-4 py-6 shadow-none sm:px-6">
          <p className="text-muted-foreground text-[17px]">{t('empty')}</p>
          <RecipientGroupNameDialog
            mode="create"
            action={createAction}
            triggerLabel={t('createFirst')}
            triggerVariant="outline"
          />
        </Card>
      ) : (
        <>
          <Card className="hidden py-0 shadow-none sm:block">
            <CardContent className="px-0">
              <Table>
                <GroupsTableHeader />
                <TableBody>
                  {groups.map((group) => (
                    <TableRow key={group.id} className="h-14">
                      <TableCell className="px-4 text-[17px] font-semibold">
                        {group.name}
                      </TableCell>
                      <TableCell className="font-mono text-[17px] tabular-nums">
                        {group.profileCount}
                      </TableCell>
                      <TableCell>
                        <OpenGroup id={group.id} className="h-11" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <ul className="flex flex-col gap-4 sm:hidden">
            {groups.map((group) => (
              <li key={group.id}>
                <Card className="gap-3 px-4 py-4 shadow-none">
                  <h2 className="text-lg leading-snug font-semibold">
                    {group.name}
                  </h2>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 text-[17px]">
                    <dt className="text-muted-foreground">
                      {t('columns.profiles')}
                    </dt>
                    <dd className="font-mono tabular-nums">
                      {group.profileCount}
                    </dd>
                  </dl>
                  <OpenGroup id={group.id} className="h-14 w-full" />
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function OpenGroup({id, className}: {id: string; className?: string}) {
  const t = useTranslations('RecipientGroupsBureau')

  return (
    <Button asChild variant="outline" className={className}>
      <Link href={recipientGroupPathOf(id)}>{t('open')}</Link>
    </Button>
  )
}

const GROUP_COLUMNS = ['name', 'profiles', 'action'] as const

function GroupsTableHeader() {
  const t = useTranslations('RecipientGroupsBureau')

  return (
    <TableHeader>
      <TableRow>
        {GROUP_COLUMNS.map((column, index) => (
          <TableHead key={column} className={index === 0 ? 'px-4' : undefined}>
            {t(`columns.${column}`)}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  )
}

/** Chargement de la liste : l'en-tete est en place, les lignes en `skeleton`. */
export function RecipientGroupListSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <Skeleton className="h-10 w-72" />
      <Card className="gap-3 px-4 py-6 shadow-none sm:px-6">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-6 w-full" />
        ))}
      </Card>
    </div>
  )
}
