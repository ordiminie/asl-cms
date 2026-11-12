'use client'

import {useRouter} from 'next/navigation'
import {useEffect} from 'react'

import {CAMPAIGN_PROGRESS_REFRESH_MS} from '@/services/types/domain/campaign-types'

/**
 * Relit la page d'une campagne a intervalle regulier pendant qu'une part est
 * en cours d'envoi : la livraison continue cote serveur (ADR 052). Le
 * composant n'est monte que tant qu'une part est `sending` ; une part
 * seulement programmee (demain) ne relit rien.
 */
export function CampaignProgressRefresh() {
  const router = useRouter()

  useEffect(() => {
    const timer = setInterval(
      () => router.refresh(),
      CAMPAIGN_PROGRESS_REFRESH_MS
    )
    return () => clearInterval(timer)
  }, [router])

  return <span data-testid="campaign-progress-refresh" hidden />
}
