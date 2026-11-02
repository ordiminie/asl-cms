import {CircleCheck, Clock} from 'lucide-react'
import {useTranslations} from 'next-intl'

import {Alert, AlertDescription} from '@/components/ui/alert'

/**
 * Alertes neutres de fin de session a la place d'un compte (s48, ecran 4) :
 * retour explicite sur l'ecran des membres (`?retour=1`), expiration sur la
 * connexion prestataire (`?session=terminee`). Sans nom : aucune donnee
 * personnelle dans une URL (D5).
 */
export function ImpersonationNotice({kind}: {kind: 'returned' | 'expired'}) {
  const t = useTranslations('Impersonation')
  const Icon = kind === 'returned' ? CircleCheck : Clock

  return (
    <Alert role="status" className="[&>svg]:size-5">
      <Icon aria-hidden="true" />
      <AlertDescription className="text-foreground text-base">
        {kind === 'returned' ? t('table.returned') : t('login.expired')}
      </AlertDescription>
    </Alert>
  )
}
