import {useTranslations} from 'next-intl'

import {cn} from '@/lib/utils'
import {getAssociationMonogram} from '@/services/types/domain/association-identity-types'

export type AssociationMarkSize = 'public' | 'backoffice'

type AssociationMarkProps = {
  name: string
  /** Version du logo tiree de sa cle ; absente, le monogramme s'affiche. */
  logoVersion?: string
  size: AssociationMarkSize
  className?: string
}

const SQUARE_CLASSES: Record<AssociationMarkSize, string> = {
  public: 'size-11 text-lg',
  backoffice: 'size-8.5 text-[15px]',
}

const NAME_CLASSES: Record<AssociationMarkSize, string> = {
  public: 'text-xl',
  backoffice: 'text-lg',
}

/**
 * L'identite d'une association : son logo, ou son monogramme quand elle n'en a
 * pas, le nom toujours ecrit a cote (design system §1.8, s01b). Le carre a la
 * meme taille dans les deux cas : aucun ecran ne change de mise en page.
 */
export function AssociationMark({
  name,
  logoVersion,
  size,
  className,
}: AssociationMarkProps) {
  const t = useTranslations('AssociationMark')
  const squareClass = cn(
    'flex shrink-0 items-center justify-center rounded-lg',
    SQUARE_CLASSES[size]
  )

  return (
    <span className={cn('flex items-center gap-3', className)}>
      {logoVersion ? (
        <span data-slot="association-mark-square" className={squareClass}>
          {/* Route dynamique propre au domaine appele : l'optimiseur de next/image la resoudrait hors du tenant. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/identity/logo?v=${encodeURIComponent(logoVersion)}`}
            alt={t('logoAlt', {name})}
            className="size-full object-contain"
          />
        </span>
      ) : (
        <span
          data-slot="association-mark-square"
          role="img"
          aria-label={t('monogramLabel', {name})}
          className={cn(
            squareClass,
            'bg-accent-solid text-primary-foreground font-serif leading-none font-semibold tracking-[0.02em]'
          )}
        >
          {getAssociationMonogram(name)}
        </span>
      )}
      <span
        className={cn(
          'text-foreground font-serif leading-tight font-semibold',
          NAME_CLASSES[size]
        )}
      >
        {name}
      </span>
    </span>
  )
}
