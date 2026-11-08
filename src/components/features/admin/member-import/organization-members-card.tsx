import {Upload} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'

import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'

import {memberImportPathOf} from './member-import-paths'

/**
 * Ecran 0 du design s13 : la carte « Membres » de la fiche d'une association,
 * d'ou le SuperAdmin ouvre l'import avec l'association deja choisie.
 */
export function OrganizationMembersCard({
  organizationId,
  memberCount,
}: {
  organizationId: string
  memberCount: number
}) {
  const t = useTranslations('AdminMemberImport.organizationCard')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-[20px]">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p
          className={
            memberCount === 0
              ? 'text-[17px]'
              : 'text-muted-foreground text-[17px]'
          }
        >
          {memberCount === 0 ? t('empty') : t('count', {count: memberCount})}
        </p>
        <Button
          asChild
          variant="outline"
          className="h-14 w-full sm:h-12 sm:w-auto sm:self-start"
        >
          <Link href={memberImportPathOf(organizationId)}>
            <Upload aria-hidden="true" />
            {t('import')}
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
