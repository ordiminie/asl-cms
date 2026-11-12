'use client'

import {useRouter} from 'next/navigation'
import {useTranslations} from 'next-intl'
import {useId} from 'react'

import {Label} from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CAMPAIGN_RECIPIENT_FILTERS,
  type CampaignRecipientFilter,
} from '@/services/types/domain/campaign-types'

import {campaignRecipientsPathOf} from './campaign-paths'

type CampaignRecipientFilterProps = {
  campaignId: string
  filter: CampaignRecipientFilter
  counts: Record<CampaignRecipientFilter, number>
}

/**
 * « Afficher » (gap 1 du design s26) : le decompte dans chaque option ;
 * changer de filtre revient a la page 1.
 */
export function CampaignRecipientFilterSelect({
  campaignId,
  filter,
  counts,
}: CampaignRecipientFilterProps) {
  const t = useTranslations('CampaignsBureau.recipients')
  const router = useRouter()
  const selectId = useId()

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={selectId} className="text-[16px]">
        {t('filterLabel')}
      </Label>
      <Select
        value={filter}
        onValueChange={(next) =>
          router.push(
            campaignRecipientsPathOf(
              campaignId,
              next as CampaignRecipientFilter
            )
          )
        }
      >
        <SelectTrigger
          id={selectId}
          aria-label={t('filterLabel')}
          className="h-14 w-full text-[17px] sm:h-12 sm:max-w-xs"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CAMPAIGN_RECIPIENT_FILTERS.map((option) => (
            <SelectItem key={option} value={option}>
              {t(`filters.${option}`, {count: counts[option]})}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
