import {Metadata} from 'next'
import Image from 'next/image'
import {getTranslations, setRequestLocale} from 'next-intl/server'

import {getAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {
  boardMemberPhotoUrl,
  getPublicBoardMembersDal,
} from '@/app/dal/board-member-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {Separator} from '@/components/ui/separator'
import {ASSOCIATION_MEMBER_COUNT_SETTING_KEY} from '@/services/types/domain/association-settings-types'
import {
  BoardMemberDTO,
  buildPortraitAlt,
  getPersonInitials,
  PORTRAIT_RENDERED_SIZE,
} from '@/services/types/domain/board-member-types'

type BoardPageParams = {params: Promise<{locale: string}>}

export async function generateMetadata({
  params,
}: BoardPageParams): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'PublicBoardPage'})

  return {title: t('metadata.title')}
}

/**
 * Page publique « Le bureau » (ecran 3 du design s06), servie a `/le-bureau` —
 * segment reserve aux slugs de page (ADR 020).
 *
 * Le tenant vient du domaine appele : les fiches d'une association ne
 * paraissent jamais sur le site d'une autre (garanti par la RLS).
 *
 * Rendu **entierement serveur** : aucun composant client, donc aucun
 * clignotement du repli d'initiales dans une page cachee. Ni etat de
 * chargement ni etat d'erreur — la page ne montre jamais son propre echec au
 * visiteur ; une photo absente donne les initiales.
 */
export default async function PublicBoardPage({params}: BoardPageParams) {
  const {locale} = await params
  setRequestLocale(locale)

  const [tenant, t] = await Promise.all([
    requireCurrentTenantDal(),
    getTranslations('PublicBoardPage'),
  ])

  const [members, settings] = await Promise.all([
    getPublicBoardMembersDal(tenant.id),
    getAssociationSettingsDal(tenant.id),
  ])

  const memberCount = settings[ASSOCIATION_MEMBER_COUNT_SETTING_KEY]?.value

  return (
    <div className="mx-auto flex w-full max-w-[68ch] flex-col gap-8 px-4 pt-8 pb-16 sm:px-6">
      <h1 className="font-serif text-[34px] leading-tight font-semibold">
        {t('title')}
      </h1>

      <div className="flex flex-col gap-3">
        {/* Non renseigne, la phrase est omise : jamais « 0 membres ». */}
        {typeof memberCount === 'number' && (
          <p className="text-[18px] leading-[1.65]">
            {t('memberCount', {count: memberCount})}
          </p>
        )}
        <p className="text-[18px] leading-[1.65]">{t('composition')}</p>
      </div>

      {members.length === 0 ? (
        <p className="text-[18px] leading-[1.65]">{t('empty')}</p>
      ) : (
        <ol className="divide-border flex list-none flex-col divide-y p-0">
          {members.map((member) => (
            <li key={member.id} className="flex gap-4 py-8 first:pt-0 sm:gap-6">
              <BoardMemberPortrait member={member} />
              <div className="flex min-w-0 flex-col gap-2">
                <h2 className="font-serif text-[26px] leading-tight font-semibold">
                  {member.name}
                </h2>
                {/* `body-strong-public` du design system §1.9 : Public Sans
                    18 px / 600 / 1,5, ecrit en utilitaires comme toute la
                    typographie du produit. */}
                <p className="text-[18px] leading-[1.5] font-semibold">
                  {member.roleLabel}
                </p>
                {member.biography !== '' && (
                  <p className="text-[18px] leading-[1.65]">
                    {member.biography}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <Separator />
      <p className="text-muted-foreground text-[15px] leading-[1.6]">
        {t('privacy')}
      </p>
    </div>
  )
}

/**
 * Photo carree, ou **initiales** de la personne (design system §3.9) : jamais
 * une image cassee, jamais une silhouette. Sous 640 px, le portrait ne passe
 * pas en pleine largeur — exception « portrait de personne » de §3.9.
 */
function BoardMemberPortrait({member}: {member: BoardMemberDTO}) {
  if (!member.photoKey) {
    return (
      <span
        aria-hidden="true"
        className="bg-muted text-muted-foreground flex size-24 shrink-0 items-center justify-center rounded-lg font-serif text-[36px] font-semibold sm:size-32 sm:text-[48px]"
      >
        {getPersonInitials(member.name)}
      </span>
    )
  }

  return (
    <Image
      src={boardMemberPhotoUrl(member.photoKey)}
      alt={buildPortraitAlt(member.name)}
      width={PORTRAIT_RENDERED_SIZE}
      height={PORTRAIT_RENDERED_SIZE}
      unoptimized
      className="size-24 shrink-0 rounded-lg object-cover sm:size-32"
    />
  )
}
