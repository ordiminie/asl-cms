import {Clock} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {ReactNode} from 'react'

import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {MAGIC_LINK_EXPIRES_IN_MINUTES} from '@/lib/better-auth/magic-link-constants'

/**
 * Lien expire ou deja utilise (s03, ecran C) : Better Auth renvoie la meme
 * erreur dans les deux cas, un seul ecran les couvre. Aucun code d'erreur.
 */
export function InvalidMagicLink() {
  const t = useTranslations('Auth.InvalidMagicLink')

  return (
    <Card className="gap-5 px-4 py-4 shadow-none sm:px-8 sm:py-8">
      <Clock
        aria-hidden="true"
        className="text-primary size-6"
        strokeWidth={1.75}
      />
      <h1 className="font-serif text-2xl leading-tight font-semibold">
        {t('title')}
      </h1>
      <p className="text-base">
        {t.rich('reassurance', {
          strong: (chunks: ReactNode) => <strong>{chunks}</strong>,
        })}
      </p>
      <p className="text-base">
        {t('explanation', {minutes: MAGIC_LINK_EXPIRES_IN_MINUTES})}
      </p>
      <Button asChild className="h-14 w-full text-base sm:h-12">
        <Link href="/login">{t('action')}</Link>
      </Button>
      <p className="text-base">{t('help')}</p>
    </Card>
  )
}
