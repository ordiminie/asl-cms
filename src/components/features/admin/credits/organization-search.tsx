'use client'

import {Building2, Mail, Search, X} from 'lucide-react'
import {useState, useTransition} from 'react'
import {useDebounce} from 'react-use'

import {searchOrganizationsAction} from '@/app/[locale]/admin/credits/actions'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {OrganizationSearchResult} from '@/services/types/domain/organization-types'

interface OrganizationSearchProps {
  onSelect: (organizationId: string, organizationName: string) => void
  selectedOrganizationId?: string
  selectedOrganizationName?: string
}

export function OrganizationSearch({
  onSelect,
  selectedOrganizationId,
  selectedOrganizationName,
}: OrganizationSearchProps) {
  const [searchValue, setSearchValue] = useState('')
  const [results, setResults] = useState<OrganizationSearchResult[]>([])
  const [isPending, startTransition] = useTransition()
  const [showResults, setShowResults] = useState(false)

  useDebounce(
    () => {
      if (searchValue.trim().length >= 2) {
        startTransition(async () => {
          const orgs = await searchOrganizationsAction(searchValue)
          setResults(orgs)
          setShowResults(true)
        })
      } else {
        setResults([])
        setShowResults(false)
      }
    },
    300,
    [searchValue]
  )

  const handleSelectOrganization = (org: OrganizationSearchResult) => {
    onSelect(org.id, org.name)
    setSearchValue('')
    setResults([])
    setShowResults(false)
  }

  const handleClear = () => {
    onSelect('', '')
    setSearchValue('')
    setResults([])
    setShowResults(false)
  }

  if (selectedOrganizationId && selectedOrganizationName) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
        <div className="flex items-center space-x-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <Building2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="font-medium text-green-900 dark:text-green-100">
              {selectedOrganizationName}
            </p>
            <p className="font-mono text-xs text-green-700 dark:text-green-300">
              {selectedOrganizationId}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="text-green-700 hover:text-green-900 dark:text-green-300 dark:hover:text-green-100"
        >
          Changer
        </Button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          type="text"
          placeholder="Rechercher par nom ou email..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="pr-9 pl-9"
        />
        {isPending && (
          <div className="absolute top-1/2 right-3 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
          </div>
        )}
        {searchValue && !isPending && (
          <button
            type="button"
            onClick={() => {
              setSearchValue('')
              setResults([])
              setShowResults(false)
            }}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="bg-background absolute z-10 mt-2 max-h-64 w-full overflow-auto rounded-lg border shadow-lg">
          <ul className="divide-y">
            {results.map((org) => (
              <li
                key={org.id}
                className="hover:bg-accent cursor-pointer p-3 transition-colors"
                onClick={() => handleSelectOrganization(org)}
              >
                <div className="flex items-start gap-3">
                  <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                    <Building2 className="text-muted-foreground h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{org.name}</p>
                    {org.memberEmails.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {org.memberEmails.slice(0, 3).map((email) => (
                          <span
                            key={email}
                            className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
                          >
                            <Mail className="h-3 w-3" />
                            {email}
                          </span>
                        ))}
                        {org.memberEmails.length > 3 && (
                          <span className="text-muted-foreground text-xs">
                            +{org.memberEmails.length - 3} autres
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showResults &&
        results.length === 0 &&
        !isPending &&
        searchValue.trim().length >= 2 && (
          <div className="bg-background absolute z-10 mt-2 w-full rounded-lg border p-4 text-center shadow-lg">
            <p className="text-muted-foreground text-sm">
              Aucune organisation trouvée
            </p>
          </div>
        )}
    </div>
  )
}
