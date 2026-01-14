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

interface SubmissionsToolbarProps {
  onSearch?: (search: string) => void
  initialSearch?: string
  totalSubmissions: number
  onPerPageChange?: (perPage: string) => void
  perPage: string
  onTypeChange?: (type: string) => void
  typeFilter: string
  onReadChange?: (read: string) => void
  readFilter: string
}

export function SubmissionsToolbar({
  onSearch,
  initialSearch = '',
  totalSubmissions,
  onPerPageChange,
  perPage,
  onTypeChange,
  typeFilter,
  onReadChange,
  readFilter,
}: SubmissionsToolbarProps) {
  const [searchValue, setSearchValue] = useState(initialSearch)
  const isUserTyping = useRef(false)

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
    <div className="mb-6 flex flex-col gap-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {onSearch && (
            <div className="relative flex w-[250px] items-center">
              <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
              <Input
                placeholder="Rechercher..."
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

          <Select value={typeFilter} onValueChange={onTypeChange}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              <SelectItem value="contact">Contact</SelectItem>
              <SelectItem value="feedback">Feedback</SelectItem>
              <SelectItem value="support">Support</SelectItem>
            </SelectContent>
          </Select>

          <Select value={readFilter} onValueChange={onReadChange}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="false">Non lus</SelectItem>
              <SelectItem value="true">Lus</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-muted-foreground text-sm">
            {totalSubmissions} soumission{totalSubmissions > 1 ? 's' : ''}
          </span>
        </div>

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
      </div>
    </div>
  )
}
