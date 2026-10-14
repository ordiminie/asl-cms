import {ArrowRight} from 'lucide-react'
import Link from 'next/link'
import {getTranslations} from 'next-intl/server'

import withAuth from '@/components/features/auth/with-auth'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/**
 * Espace membre (s46) : rien n'est lu du membre, l'ecran est le meme pour un
 * SuperAdmin ou un compte sans appartenance. s12d inserera « Mes parcelles »
 * au-dessus de la carte de securite.
 */
async function Page() {
  const t = await getTranslations('MemberSpacePage')

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">
        {t('title')}
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-xl">{t('security.title')}</h2>
          </CardTitle>
          <CardDescription className="text-base">
            {t('security.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/account"
            className="text-primary focus-visible:outline-ring inline-flex h-14 items-center gap-2 font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 sm:h-12"
          >
            {t('security.link')}
            <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

export default withAuth(Page)
