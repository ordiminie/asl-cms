import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentCampaignsDal,
  getCampaignComposerContextDal,
} from '@/app/dal/campaign-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {
  CampaignComposer,
  CampaignComposerSkeleton,
  type CampaignTemplates,
} from '@/components/features/campaigns/campaign-composer'
import {CAMPAIGN_TEMPLATE_IDS} from '@/services/types/domain/campaign-types'

import {previewCampaignAction, sendCampaignAction} from '../actions'

type NewCampaignPageProps = {params: Promise<{locale: string}>}

export async function generateMetadata({
  params,
}: NewCampaignPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'CampaignsBureau'})

  return {title: t('metadata.newTitle')}
}

/**
 * Le composeur et son apercu (ecrans 2 et 3 du design s25), sur une seule
 * route : l'apercu est la deuxieme etape du meme ecran (ecart 1 du plan).
 * Le controle d'acces est repete ici ; le decompte n'est lu qu'apres lui.
 */
export default async function NewCampaignPage({params}: NewCampaignPageProps) {
  const {locale} = await params
  setRequestLocale(locale)

  return (
    <Suspense fallback={<CampaignComposerSkeleton />}>
      <ComposerSection />
    </Suspense>
  )
}

/**
 * Les quatre modeles, lus **bruts** : leurs `{nom}` `{parcelle}` `{date}` sont
 * des variables de campagne, pas des arguments de message a formater.
 */
const readTemplates = async (): Promise<CampaignTemplates> => {
  const t = await getTranslations('email.campaign.templates')
  const read = (id: keyof CampaignTemplates) =>
    t.raw(id) as CampaignTemplates[typeof id]

  return Object.fromEntries(
    CAMPAIGN_TEMPLATE_IDS.filter((id) => id !== 'free').map((id) => [
      id,
      read(id),
    ])
  ) as CampaignTemplates
}

async function ComposerSection() {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentCampaignsDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const [context, templates] = await Promise.all([
    getCampaignComposerContextDal(tenant.id),
    readTemplates(),
  ])

  return (
    <CampaignComposer
      context={context}
      templates={templates}
      previewAction={previewCampaignAction}
      sendAction={sendCampaignAction}
    />
  )
}
