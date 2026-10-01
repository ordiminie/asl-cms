import {useTranslations} from 'next-intl'

type SearchPreviewProps = {
  /** Domaine de l'association, sans protocole. */
  host: string
  /** Segments de l'adresse, sans prefixe de locale. */
  path: readonly string[]
  /** Titre tel qu'il s'appliquera : saisi, sinon sa valeur de repli. */
  title: string
  /** Description telle qu'elle s'appliquera ; absente, Google choisit. */
  description?: string
}

/**
 * Apercu « Dans Google » (s11, design ecran 2) : un encadre `muted`, sans logo
 * ni couleur de marque. Il montre **toujours** la valeur qui s'appliquera,
 * repli compris — jamais un champ vide.
 */
export function SearchPreview({
  host,
  path,
  title,
  description,
}: SearchPreviewProps) {
  const t = useTranslations('SearchPreview')

  return (
    <section
      aria-label={t('label')}
      className="bg-muted flex flex-col gap-1 rounded-md p-4"
    >
      <p className="text-muted-foreground text-[13px] font-medium">
        {t('label')}
      </p>
      <p className="text-muted-foreground truncate text-[14px]">
        {t('address', {host, path: path.join(' › ')})}
      </p>
      <p className="text-link line-clamp-2 text-[20px] leading-snug">{title}</p>
      <p className="text-foreground line-clamp-2 text-[15px]">
        {description ?? t('noDescription')}
      </p>
      <p className="text-muted-foreground mt-1 text-[13px]">
        {t('disclaimer')}
      </p>
    </section>
  )
}
