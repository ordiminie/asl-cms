import {Metadata} from 'next'
import {useTranslations} from 'next-intl'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {getQuestionCategoriesForBureauDal} from '@/app/dal/association-category-dal'
import {getAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {canManageCurrentMemberQuestionsDal} from '@/app/dal/member-question-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {ReportCategoriesManager} from '@/components/features/incident-report/report-categories-manager'
import {MEMBER_QUESTIONS_PATH} from '@/components/features/member-question/member-question-paths'
import {Skeleton} from '@/components/ui/skeleton'
import {CONTACT_EMAIL_SETTING_KEY} from '@/services/types/domain/association-settings-types'

import {
  createQuestionCategoryAction,
  deleteQuestionCategoryAction,
  updateQuestionCategoryAction,
} from './actions'

type QuestionCategoriesPageProps = {params: Promise<{locale: string}>}

export async function generateMetadata({
  params,
}: QuestionCategoriesPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({
    locale,
    namespace: 'BureauQuestionCategoriesPage',
  })

  return {title: t('metadata.title')}
}

/**
 * Sujets des questions des membres (s23, ecran D, critere 3) : l'ecran des
 * categories de signalement, parametre pour le domaine `question`. La phrase
 * d'en-tete dit le routage **exclusif** : l'adresse du sujet, sinon l'adresse
 * de contact des Reglages. Le controle d'acces est repete ici.
 */
export default async function BureauQuestionCategoriesPage({
  params,
}: QuestionCategoriesPageProps) {
  const {locale} = await params
  setRequestLocale(locale)

  return (
    <Suspense fallback={<CategoriesSkeleton />}>
      <CategoriesSection />
    </Suspense>
  )
}

async function CategoriesSection() {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentMemberQuestionsDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const [list, settings] = await Promise.all([
    getQuestionCategoriesForBureauDal(tenant.id),
    getAssociationSettingsDal(tenant.id),
  ])
  const contactEmail = settings[CONTACT_EMAIL_SETTING_KEY]?.value

  return (
    <ReportCategoriesManager
      list={list}
      labels="BureauQuestionCategoriesPage"
      backHref={MEMBER_QUESTIONS_PATH}
      intro={
        <RoutingIntro
          contactEmail={contactEmail ? String(contactEmail) : undefined}
        />
      }
      showUsageCount
      createAction={createQuestionCategoryAction}
      updateAction={updateQuestionCategoryAction}
      deleteAction={deleteQuestionCategoryAction}
    />
  )
}

/** Le routage exclusif, avec l'adresse de contact des Reglages (D1). */
function RoutingIntro({contactEmail}: {contactEmail?: string}) {
  const t = useTranslations('BureauQuestionCategoriesPage')

  return contactEmail
    ? t('intro', {email: contactEmail})
    : t('introWithoutContact')
}

function CategoriesSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4 px-4 pt-6 pb-12 sm:px-8">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}
