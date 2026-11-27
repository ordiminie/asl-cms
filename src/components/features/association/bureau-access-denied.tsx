import Link from 'next/link'
import {useTranslations} from 'next-intl'

import {Button} from '@/components/ui/button'

type BureauAccessDeniedProps = {
  /**
   * Le texte du refus : celui de l'espace bureau par defaut ; celui d'une
   * page reservee, rendue avec la barre laterale (s56, 1f).
   */
  namespace?: 'BureauIdentityPage.denied' | 'BureauMemberAnnualImport.denied'
  /** Le lien de retour : l'accueil par defaut. */
  backHref?: string
}

/**
 * Ecran B du design s01b : l'espace bureau refuse a qui n'est pas au bureau de
 * l'association du domaine appele. Sans barre laterale d'administration. Une
 * page reservee a un role (s56, 1f) passe son texte et son lien de retour.
 */
export function BureauAccessDenied({
  namespace = 'BureauIdentityPage.denied',
  backHref = '/',
}: BureauAccessDeniedProps = {}) {
  const t = useTranslations(namespace)

  return (
    <div className="mx-auto flex w-full max-w-190 flex-col items-start gap-4 px-4 py-12 sm:px-8">
      <h1 className="font-serif text-[34px] leading-tight font-semibold text-pretty">
        {t('title')}
      </h1>
      <p className="text-muted-foreground text-[17px]">{t('description')}</p>
      <Button
        asChild
        variant="outline"
        className="h-14 w-full sm:h-12 sm:w-auto"
      >
        <Link href={backHref}>{t('back')}</Link>
      </Button>
    </div>
  )
}
