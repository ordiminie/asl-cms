'use client'

import {Search, X} from 'lucide-react'
import {useState} from 'react'

import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {CategoryDTO, POST_STATUS} from '@/services/types/domain/post-types'

interface PostsToolbarProps {
  onSearch?: (value: string) => void
  onStatusFilter?: (status: string) => void
  onCategoryFilter?: (categoryId: string) => void
  categories: CategoryDTO[]
  totalItems: number
  onPerPageChange?: (perPage: string) => void
  perPage: string
  initialSearch?: string
  initialStatus?: string
  initialCategory?: string
}

export function PostsToolbar({
  onSearch,
  onStatusFilter,
  onCategoryFilter,
  categories,
  totalItems,
  onPerPageChange,
  perPage,
  initialSearch = '',
  initialStatus = '',
  initialCategory = '',
}: PostsToolbarProps) {
  const [searchValue, setSearchValue] = useState(initialSearch)
  const [syncedSearch, setSyncedSearch] = useState(initialSearch)

  // Resynchroniser le champ quand la recherche vient de l'URL
  if (syncedSearch !== initialSearch) {
    setSyncedSearch(initialSearch)
    setSearchValue(initialSearch)
  }

  const handleSearchChange = (e: {target: {value: string}}) => {
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

  const handleStatusChange = (value: string) => {
    if (onStatusFilter) {
      onStatusFilter(value === 'all' ? '' : value)
    }
  }

  const handleCategoryChange = (value: string) => {
    if (onCategoryFilter) {
      onCategoryFilter(value === 'all' ? '' : value)
    }
  }

  return (
    <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Recherche */}
        <div className="relative flex w-full items-center sm:w-[250px]">
          <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
          <Input
            placeholder="Rechercher dans les titres..."
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

        {/* Filtre par statut */}
        <Select
          value={initialStatus || 'all'}
          onValueChange={handleStatusChange}
        >
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value={POST_STATUS.DRAFT}>Brouillon</SelectItem>
            <SelectItem value={POST_STATUS.PUBLISHED}>Publié</SelectItem>
            <SelectItem value={POST_STATUS.ARCHIVED}>Archivé</SelectItem>
          </SelectContent>
        </Select>

        {/* Filtre par catégorie */}
        <Select
          value={initialCategory || 'all'}
          onValueChange={handleCategoryChange}
        >
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-muted-foreground text-sm sm:whitespace-nowrap">
          {totalItems} post{totalItems > 1 ? 's' : ''} trouvé
          {totalItems > 1 ? 's' : ''}
        </span>
      </div>

      {/* Sélecteur de pagination */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm">Afficher</span>
        <Select value={perPage} onValueChange={onPerPageChange}>
          <SelectTrigger className="w-[70px]">
            <SelectValue placeholder="10" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">5</SelectItem>
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
