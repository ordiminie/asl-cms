import {AlertTriangle} from 'lucide-react'
import {useTranslations} from 'next-intl'

import {Badge} from '@/components/ui/badge'

/** « Courrier uniquement » : un etat de contact, en badge neutre. */
export function MailOnlyBadge() {
  const t = useTranslations('BureauMemberProfilesPage.badges')

  return <Badge variant="outline">{t('mailOnly')}</Badge>
}

/**
 * « Fiche incomplete » : palette `warning`, pas `destructive` — rien n'a
 * echoue. Le mot porte l'information, l'icone la souligne.
 */
export function IncompleteBadge() {
  const t = useTranslations('BureauMemberProfilesPage.badges')

  return (
    <Badge className="border-warning-border bg-warning text-warning-foreground">
      <AlertTriangle aria-hidden="true" strokeWidth={1.75} />
      {t('incomplete')}
    </Badge>
  )
}
