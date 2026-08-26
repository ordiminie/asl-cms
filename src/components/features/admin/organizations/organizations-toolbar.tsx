'use client'

import {Search, X} from 'lucide-react'
import {useTranslations} from 'next-intl'
import React, {useState} from 'react'

import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface OrganizationsToolbarProps {
  onSearch?: (search: string) => void
  initialSearch?: string
  totalOrganizations: number
  onPerPageChange?: (perPage: string) => void
  perPage: string
}

export function OrganizationsToolbar({
  onSearch,
  initialSearch = '',
  totalOrganizations,
  onPerPageChange,
  perPage,
}: OrganizationsToolbarProps) {
  const t = useTranslations('AdminOrganizations')
  const [searchValue, setSearchValue] = useState(initialSearch)

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchValue(value)
    if (onSearch) {
      onSearch(value)
    }
  }

  const handleClearSearch = () => {
    setSearchValue('')
    if (onSearch) {
      onSearch('')
    }
  }

  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2">
        {onSearch && (
          <div className="relative flex w-[300px] items-center">
            <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
            <Input
              placeholder={t('searchPlaceholder')}
              className="pr-8 pl-8"
              value={searchValue}
              onChange={handleSearchChange}
            />
            {searchValue && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 h-7 w-7"
                onClick={handleClearSearch}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
        <span className="text-muted-foreground text-sm">
          {totalOrganizations} organisation{totalOrganizations > 1 ? 's' : ''}{' '}
          trouvée
          {totalOrganizations > 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm">{t('show')}</span>
        <Select value={perPage} onValueChange={onPerPageChange}>
          <SelectTrigger className="w-[70px]">
            <SelectValue placeholder="20" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2">2</SelectItem>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-muted-foreground text-sm">par page</span>
      </div>
    </div>
  )
}
