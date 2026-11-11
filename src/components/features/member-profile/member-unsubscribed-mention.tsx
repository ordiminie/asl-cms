'use client'

import {useTranslations} from 'next-intl'
import {use} from 'react'

import {sentAtPartsOf} from '@/components/features/campaigns/campaign-format'
import {Badge} from '@/components/ui/badge'
import type {MemberUnsubscribeDTO} from '@/services/types/domain/campaign-types'

/**
 * « Desinscrit des campagnes » sous les badges de la fiche (ecran 5 du
 * design s25) : un badge `outline` et une phrase datee, **sans action de
 * levee** (V1). La promesse est deroulee ici, derriere un `<Suspense>` : la
 * fiche s'affiche sans l'attendre. Aucun refus, rien.
 */
export function MemberUnsubscribedMention({
  promise,
}: {
  promise: Promise<MemberUnsubscribeDTO | null>
}) {
  const t = useTranslations('BureauMemberProfilesPage.detail.unsubscribed')
  const unsubscribe = use(promise)
  if (!unsubscribe) return null

  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant="outline">{t('badge')}</Badge>
      <p className="text-muted-foreground text-[15px]">
        {t('since', {date: sentAtPartsOf(unsubscribe.createdAt).date})}
      </p>
    </div>
  )
}
