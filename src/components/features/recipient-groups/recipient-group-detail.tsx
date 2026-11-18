import Link from 'next/link'
import {useTranslations} from 'next-intl'
import type {ReactNode} from 'react'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {Card} from '@/components/ui/card'
import {Skeleton} from '@/components/ui/skeleton'
import type {RecipientGroupDetailDTO} from '@/services/types/domain/recipient-group-types'

import {memberProfilesListPathOf} from '../member-profile/member-profile-paths'
import {
  type DeleteRecipientGroupAction,
  DeleteRecipientGroupDialog,
} from './delete-recipient-group-dialog'
import {
  type RecipientGroupNameAction,
  RecipientGroupNameDialog,
} from './recipient-group-name-dialog'
import {RECIPIENT_GROUPS_PATH} from './recipient-group-paths'

type RecipientGroupDetailProps = {
  group: RecipientGroupDetailDTO
  renameAction: RecipientGroupNameAction
  deleteAction: DeleteRecipientGroupAction
}

/**
 * Un groupe ouvert (ecran 3 de s27) : sa composition, comptee comme la cible
 * d'une campagne (critere 5) — en fiches, puis en adresses —, le lien vers
 * la liste des proprietaires filtree, puis « Renommer » et « Supprimer ».
 */
export function RecipientGroupDetail({
  group,
  renameAction,
  deleteAction,
}: RecipientGroupDetailProps) {
  const t = useTranslations('RecipientGroupsBureau')
  const {counts} = group

  return (
    <div className="mx-auto flex w-full max-w-180 flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={RECIPIENT_GROUPS_PATH}>{t('breadcrumb')}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{group.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <h1 className="font-serif text-[34px] leading-tight font-semibold">
        {group.name}
      </h1>

      <DetailCard title={t('composition.title')}>
        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-[17px]">
          <dt>{t('composition.profilesWithEmail')}</dt>
          <dd className="text-right font-semibold tabular-nums">
            {counts.profilesWithEmail}
          </dd>
          <dt>{t('composition.profilesWithoutEmail')}</dt>
          <dd className="text-right font-semibold tabular-nums">
            {counts.profilesWithoutEmail}
          </dd>
          <div className="border-border col-span-2 border-t" />
          <dt>{t('composition.profiles')}</dt>
          <dd className="text-right font-semibold tabular-nums">
            {counts.profiles}
          </dd>
        </dl>
        <p className="text-muted-foreground text-[15px]">
          {t('composition.recipients', {count: counts.recipients})}
        </p>
        <Link
          href={memberProfilesListPathOf({groupId: group.id})}
          className="text-primary text-[17px] underline"
        >
          {t('composition.editProfiles')}
        </Link>
      </DetailCard>

      <DetailCard title={t('manage.title')}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
          <RecipientGroupNameDialog
            mode="rename"
            action={renameAction}
            triggerLabel={t('manage.rename')}
            triggerVariant="outline"
            groupId={group.id}
            defaultName={group.name}
          />
          <div className="flex flex-col gap-2">
            <DeleteRecipientGroupDialog
              groupId={group.id}
              name={group.name}
              profileCount={counts.profiles}
              action={deleteAction}
            />
            <p className="text-muted-foreground text-[15px]">
              {t('manage.deleteHelp')}
            </p>
          </div>
        </div>
      </DetailCard>
    </div>
  )
}

function DetailCard({title, children}: {title: string; children: ReactNode}) {
  return (
    <Card className="gap-4 px-4 py-6 shadow-none sm:px-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </Card>
  )
}

/** Un groupe en chargement : les nombres en `skeleton`. */
export function RecipientGroupDetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-180 flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <Skeleton className="h-5 w-56" />
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-48 w-full" />
    </div>
  )
}
