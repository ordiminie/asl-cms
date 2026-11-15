import {ArrowLeft} from 'lucide-react'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import {getTranslations} from 'next-intl/server'

import {
  getMyQuestionCategoriesDal,
  getMyQuestionIdentityDal,
} from '@/app/dal/member-question-dal'
import withAuth from '@/components/features/auth/with-auth'
import {MyQuestionForm} from '@/components/features/member-space/my-question-form'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'

import {submitMyQuestionAction} from './actions'

/**
 * « Poser une question au bureau » depuis l'espace membre (s23, ecran B).
 * Les sujets sont ceux de l'association du domaine appele ; l'identite
 * transmise au bureau est celle de la fiche du compte connecte, lue sans
 * cache. Sans aucun sujet ouvert, pas de formulaire : un renvoi vers la page
 * Contact (B4). Un compte sans fiche dans l'association n'a pas cette page.
 */
async function Page() {
  const t = await getTranslations('MemberQuestionPage')

  const [categories, identity] = await Promise.all([
    getMyQuestionCategoriesDal(),
    getMyQuestionIdentityDal(),
  ])
  if (!identity || !categories) notFound()

  return (
    <div className="mx-auto flex w-full max-w-[68ch] flex-col gap-6">
      <Link
        href="/dashboard"
        className="text-primary focus-visible:outline-ring inline-flex h-12 items-center gap-2 self-start font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ArrowLeft className="size-5" aria-hidden="true" />
        {t('back')}
      </Link>
      <h1 className="font-serif text-[34px] leading-tight font-semibold">
        {t('title')}
      </h1>
      {categories.length === 0 ? (
        <Card className="items-start gap-5 px-4 py-6 shadow-none sm:px-8">
          <p className="text-[17px]">{t('noCategories.text')}</p>
          <Button
            asChild
            variant="outline"
            className="h-14 w-full text-base sm:h-12 sm:w-auto"
          >
            <Link href="/contact">{t('noCategories.action')}</Link>
          </Button>
        </Card>
      ) : (
        <MyQuestionForm
          categories={categories}
          identity={identity}
          action={submitMyQuestionAction}
        />
      )}
    </div>
  )
}

export default withAuth(Page)
