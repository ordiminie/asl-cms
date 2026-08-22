'use client'

import {useTranslations} from 'next-intl'
import {useState} from 'react'
import {toast} from 'sonner'

import {createPlanAction} from '@/app/[locale]/admin/plans/actions'
import {Input} from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {CreatePlanDialog} from './create-plan-dialog'

interface Props {
  onSearch: (search: string) => void
  initialSearch: string
  totalPlans: number
  onPerPageChange: (limit: string) => void
  perPage: string
  permissions: {
    canCreate: boolean
    canUpdate: boolean
    canDelete: boolean
    canView: boolean
  }
}

export function PlansToolbar({
  onSearch,
  initialSearch,
  totalPlans,
  onPerPageChange,
  perPage,
  permissions,
}: Props) {
  const t = useTranslations('AdminPlans')
  const [searchValue, setSearchValue] = useState(initialSearch)

  const handleSearchChange = (value: string) => {
    setSearchValue(value)
    onSearch(value)
  }

  return (
    <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-2">
        <Input
          placeholder={t('management.searchPlaceholder')}
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="max-w-sm"
        />
        <div className="text-muted-foreground text-sm">
          {totalPlans} plan{totalPlans !== 1 ? 's' : ''}
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

        {permissions.canCreate && (
          <CreatePlanDialog
            onSave={async (data) => {
              const result = await createPlanAction(data)

              if (result.success) {
                toast.success(result.message)
              } else {
                toast.error(result.message)
              }
            }}
          />
        )}
      </div>
    </div>
  )
}
