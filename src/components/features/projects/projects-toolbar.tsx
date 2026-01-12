'use client'

import {Search, X} from 'lucide-react'
import React, {useState} from 'react'
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

interface ProjectsToolbarProps {
  onSearch?: (search: string) => void
  initialSearch?: string
  totalProjects: number
  onPerPageChange?: (perPage: string) => void
  perPage: string
  showPerPageSelector?: boolean
}

export function ProjectsToolbar({
  onSearch,
  initialSearch = '',
  totalProjects,
  onPerPageChange,
  perPage,
  showPerPageSelector = true,
}: ProjectsToolbarProps) {
  const [searchValue, setSearchValue] = useState(initialSearch)

  useDebounce(
    () => {
      if (onSearch) {
        onSearch(searchValue)
      }
    },
    300,
    [searchValue]
  )

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchValue(value)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(searchValue)
    }
  }

  const handleClearSearch = () => {
    setSearchValue('')
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2">
        {onSearch && (
          <div className="relative flex w-[250px] items-center">
            <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
            <Input
              placeholder="Rechercher un projet..."
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
          {totalProjects} projet{totalProjects > 1 ? 's' : ''} trouvé
          {totalProjects > 1 ? 's' : ''}
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
              <SelectItem value="2">2</SelectItem>
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
