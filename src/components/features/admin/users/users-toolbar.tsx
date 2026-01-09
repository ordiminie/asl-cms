'use client'

import {Search, X} from 'lucide-react'
import React, {useEffect, useRef, useState} from 'react'
import {useDebounce} from 'react-use'

import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface UsersToolbarProps {
  onSearch?: (search: string) => void
  initialSearch?: string
  totalUsers: number
  onPerPageChange?: (perPage: string) => void
  perPage: string
  showPerPageSelector?: boolean
}

export function UsersToolbar({
  onSearch,
  initialSearch = '',
  totalUsers,
  onPerPageChange,
  perPage,
  showPerPageSelector = true,
}: UsersToolbarProps) {
  const [searchValue, setSearchValue] = useState(initialSearch)
  const isUserTyping = useRef(false)

  // Synchroniser avec les changements externes (pagination)
  useEffect(() => {
    if (!isUserTyping.current && initialSearch !== searchValue) {
      setSearchValue(initialSearch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSearch])

  useDebounce(
    () => {
      if (onSearch && isUserTyping.current) {
        onSearch(searchValue)
        isUserTyping.current = false
      }
    },
    300,
    [searchValue]
  )

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchValue(value)
    isUserTyping.current = true
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearch) {
      isUserTyping.current = false
      onSearch(searchValue)
    }
  }

  const handleClearSearch = () => {
    setSearchValue('')
    isUserTyping.current = true
  }

  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2">
        {onSearch && (
          <div className="relative flex w-[300px] items-center">
            <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
            <Input
              placeholder="Rechercher par nom ou email..."
              className="pr-8 pl-8"
              value={searchValue}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
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
          {totalUsers} utilisateur{totalUsers > 1 ? 's' : ''} trouvé
          {totalUsers > 1 ? 's' : ''}
        </span>
      </div>

      {showPerPageSelector && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Afficher</span>
          <Select value={perPage} onValueChange={onPerPageChange}>
            <SelectTrigger className="w-[70px]">
              <SelectValue placeholder="20" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-sm">par page</span>
        </div>
      )}
    </div>
  )
}
