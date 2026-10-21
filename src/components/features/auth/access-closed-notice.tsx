import {Info} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'

import {Alert, AlertDescription} from '@/components/ui/alert'

/**
 * Encadre de la connexion apres la fermeture d'un acces (s12d, ecran D) :
 * neutre, `role="status"`, icone `Info`. Meme texte que la session ait ete
 * coupee ou non.
 */
export function AccessClosedNotice() {
  const t = useTranslations('Auth.AccessClosedNotice')

  return (
    <Alert role="status">
      <Info aria-hidden="true" className="text-primary" strokeWidth={1.75} />
      <AlertDescription className="text-foreground text-base">
        <p className="font-semibold">{t('title')}</p>
        <p>
          {t('reopen')}{' '}
          <Link
            href="/contact"
            className="text-primary font-semibold underline underline-offset-4"
          >
            {t('contact')}
          </Link>
        </p>
      </AlertDescription>
    </Alert>
  )
}
