'use client'

import {useTranslations} from 'next-intl'

/**
 * Bloc d'un type que le code ne reconnait plus (critere 9) : lecture seule,
 * signale au bureau, ignore par le rendu public. Aucune edition possible — on
 * n'edite pas une forme qu'on ne sait pas interpreter ; seule la suppression
 * reste offerte, par l'action de la ligne.
 */
export function UnknownBlockCard({type}: {type: string}) {
  const t = useTranslations('PageBlocks.unknown')

  return (
    <div className="text-muted-foreground bg-muted rounded-md px-4 py-3">
      <p className="font-semibold">{t('title', {type})}</p>
      <p className="text-[15px]">{t('help')}</p>
    </div>
  )
}
