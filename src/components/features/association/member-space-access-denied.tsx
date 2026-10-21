import {ArrowLeft} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'

import {Button} from '@/components/ui/button'

/**
 * Ecran C4 du design s12d : un proprietaire (role `member`) qui ouvre une page
 * du back-office, par exemple la fiche d'un autre membre. Ni nom, ni parcelle,
 * ni code d'erreur, ni marqueur personnel : seulement le chemin du retour vers
 * son espace. Le layout ne connait pas la page visee : la phrase dit a qui
 * elle est reservee.
 */
export function MemberSpaceAccessDenied() {
  const t = useTranslations('MemberSpacePage.denied')

  return (
    <div className="mx-auto flex w-full max-w-190 flex-col items-start gap-4 px-4 py-12 sm:px-8">
      <h1 className="font-serif text-[34px] leading-tight font-semibold text-pretty">
        {t('title')}
      </h1>
      <p className="text-muted-foreground text-[17px]">{t('description')}</p>
      <Button asChild className="h-14 w-full sm:h-12 sm:w-auto">
        <Link href="/dashboard">
          <ArrowLeft aria-hidden="true" className="size-5" />
          {t('back')}
        </Link>
      </Button>
    </div>
  )
}
