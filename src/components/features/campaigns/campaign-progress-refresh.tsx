'use client'

import {useRouter} from 'next/navigation'
import {useEffect} from 'react'

import {CAMPAIGN_PROGRESS_REFRESH_MS} from '@/services/types/domain/campaign-types'

/**
 * Relit la page d'une campagne `sending` a intervalle regulier : la livraison
 * continue cote serveur (ADR 051), l'avancement se lit dans `sent_count`. Le
 * composant n'est monte que tant que l'envoi est en cours.
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
