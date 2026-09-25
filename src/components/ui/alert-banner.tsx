import {AlertTriangle} from 'lucide-react'
import {useTranslations} from 'next-intl'

import {cn} from '@/lib/utils'

type AlertBannerProps = {
  /** Texte brut saisi par le bureau, rendu en entier et jamais interprete. */
  message: string
  className?: string
}

/**
 * Bandeau d'alerte de l'association (design system §2.3, un seul niveau).
 *
 * Pleine largeur, dans le flux : il pousse la page, il ne la recouvre pas —
 * donc aucun `z-index`. Une `region` etiquetee, **sans** `role="alert"` ni
 * `aria-live` : present sur toutes les pages, il serait sinon reannonce a
 * chaque chargement. Aucun element interactif, aucune fermeture.
 *
 * Le message est un nœud texte React : jamais de HTML injecte, c'est la
 * surface la plus large du produit (toutes les pages, back-office compris).
 */
export function AlertBanner({message, className}: AlertBannerProps) {
  const t = useTranslations('AlertBanner')

  return (
    <section
      role="region"
      aria-label={t('label')}
      className={cn(
        'bg-warning text-warning-foreground border-warning-border w-full border-b-2 print:hidden',
        className
      )}
    >
      <div className="mx-auto flex max-w-[1200px] items-start gap-2 px-4 py-3 sm:px-6 lg:px-8">
        <AlertTriangle
          aria-hidden="true"
          strokeWidth={1.75}
          className="mt-[0.2em] size-5 shrink-0"
        />
        <p className="text-[17px] leading-[1.6] text-pretty">
          <span className="font-semibold">{t('prefix')}</span>{' '}
          <span>{message}</span>
        </p>
      </div>
    </section>
  )
}
