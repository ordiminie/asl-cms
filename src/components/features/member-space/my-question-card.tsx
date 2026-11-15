import {CircleCheck} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {useId} from 'react'

import {Alert, AlertDescription} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'

/** Le formulaire « Poser une question au bureau » de l'espace membre (s23). */
export const MY_QUESTION_PATH = '/dashboard/question'

/**
 * « Une question pour le bureau ? » (s23, ecran A) : une phrase et un bouton
 * `outline`. Apres l'envoi, l'alerte de succes s'affiche une fois dans la
 * carte (A2). Aucune liste des questions envoyees (hors perimetre).
 */
export function MyQuestionCard({sent}: {sent: boolean}) {
  const t = useTranslations('MemberSpacePage.question')
  const titleId = useId()

  return (
    <section aria-labelledby={titleId}>
      <Card className="gap-5 px-4 py-6 shadow-none sm:px-6">
        <h2 id={titleId} className="font-serif text-xl font-semibold">
          {t('title')}
        </h2>
        {sent ? (
          <Alert role="status" className="[&>svg]:size-5">
            <CircleCheck aria-hidden="true" className="text-primary" />
            <AlertDescription className="text-foreground text-base">
              {t('sent')}
            </AlertDescription>
          </Alert>
        ) : (
          <p className="text-[17px]">{t('description')}</p>
        )}
        <Button
          asChild
          variant="outline"
          className="h-14 w-full text-base sm:h-12 sm:w-auto sm:self-start"
        >
          <Link href={MY_QUESTION_PATH}>
            {sent ? t('askAnother') : t('ask')}
          </Link>
        </Button>
      </Card>
    </section>
  )
}
