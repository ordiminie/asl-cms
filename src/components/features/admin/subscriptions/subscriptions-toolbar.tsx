'use client'

import {useTranslations} from 'next-intl'
import {useState} from 'react'

import {Input} from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SubscriptionsToolbarProps {
  onSearch: (search: string) => void
  initialSearch: string
  totalSubscriptions: number
  onPerPageChange: (limit: string) => void
  perPage: string
  permissions: {
    canView: boolean
    canCancel: boolean
    canReactivate: boolean
  }
}

export function SubscriptionsToolbar({
  onSearch,
  initialSearch,
  totalSubscriptions,
  onPerPageChange,
  perPage,
}: SubscriptionsToolbarProps) {
  const t = useTranslations('AdminPages')
  const [searchValue, setSearchValue] = useState(initialSearch)

  const handleSearchChange = (value: string) => {
    setSearchValue(value)
    onSearch(value)
  }

  return (
    <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-2">
        <Input
          placeholder={t('subscriptionSearchPlaceholder')}
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="max-w-sm"
        />
        <div className="text-muted-foreground text-sm">
          {totalSubscriptions} abonnement{totalSubscriptions !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Select value={perPage} onValueChange={onPerPageChange}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
