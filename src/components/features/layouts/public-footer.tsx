import {getCurrentPublicSiteNavigationDal} from '@/app/dal/site-navigation-dal'
import {renderPageBlock} from '@/lib/cms/render-page-block'
import {PageBlockTypeConst} from '@/services/types/domain/page-block-types'

/**
 * Pied de page du site public (s04b, ecran 2) : le contenu unique ecrit par le
 * bureau, rendu avec **les memes regles que le bloc « texte riche » des pages**
 * (design system §4) — `renderPageBlock` est la seule porte de ce rendu, donc
 * pas de second jeu de balises autorisees a maintenir.
 *
 * La lecture est scopee au tenant et cachee dans le DAL, sous
 * `siteNavigationTag(organizationId)` : enregistrer le pied de page ou publier
 * une page fait tomber ce tag, et la modification parait sans delai (criteres
 * 3 et 5).
 *
 * Un contenu vide veut dire « aucun pied de page » : rien n'est rendu, pas une
 * bande vide.
 */
export default async function PublicFooter() {
  const {footerContent} = await getCurrentPublicSiteNavigationDal()

  const html = renderPageBlock({
    type: PageBlockTypeConst.TEXT,
    data: {markdown: footerContent},
  })
  if (!html) return null

  return (
    <footer className="border-border bg-background/80 mt-auto w-full border-t px-4 py-12 sm:px-6 md:px-8">
      <div
        className="page-block mx-auto w-full max-w-[52rem] text-[17px] leading-[1.65]"
        dangerouslySetInnerHTML={{__html: html}}
      />
    </footer>
  )
}
