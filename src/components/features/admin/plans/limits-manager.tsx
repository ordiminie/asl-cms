'use client'

import {Minus, Plus} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useState} from 'react'

import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'

interface LimitsManagerProps {
  limits: Record<string, number>
  onChange: (limits: Record<string, number>) => void
  className?: string
}

export function LimitsManager({
  limits,
  onChange,
  className,
}: LimitsManagerProps) {
  const t = useTranslations('AdminPlans')
  const [newLimitKey, setNewLimitKey] = useState('')
  const [newLimitValue, setNewLimitValue] = useState(0)

  const handleAddLimit = () => {
    if (newLimitKey.trim() && !limits[newLimitKey]) {
      onChange({
        ...limits,
        [newLimitKey.trim()]: newLimitValue,
      })
      setNewLimitKey('')
      setNewLimitValue(0)
    }
  }

  const handleUpdateLimit = (key: string, value: number) => {
    onChange({
      ...limits,
      [key]: value,
    })
  }

  const handleRemoveLimit = (key: string) => {
    const newLimits = {...limits}
    delete newLimits[key]
    onChange(newLimits)
  }

  return (
    <div className={className}>
      <Label className="text-sm font-medium">{t('limits.title')}</Label>

      <div className="mt-2 space-y-3">
        {Object.entries(limits).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <Input
              value={key}
              onChange={(e) => {
                const newKey = e.target.value
                if (newKey !== key && !limits[newKey]) {
                  const newLimits = {...limits}
                  delete newLimits[key]
                  newLimits[newKey] = value
                  onChange(newLimits)
                }
              }}
              placeholder={t('limits.namePlaceholder')}
              className="flex-1"
            />
            <Input
              type="number"
              min="0"
              value={value}
              onChange={(e) => handleUpdateLimit(key, Number(e.target.value))}
              className="w-24"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleRemoveLimit(key)}
            >
              <Minus className="h-4 w-4" />
            </Button>
          </div>
        ))}

        <div className="flex items-center gap-2 border-t pt-2">
          <Input
            value={newLimitKey}
            onChange={(e) => setNewLimitKey(e.target.value)}
            placeholder={t('limits.namePlaceholder')}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddLimit()
              }
            }}
          />
          <Input
            type="number"
            min="0"
            value={newLimitValue}
            onChange={(e) => setNewLimitValue(Number(e.target.value))}
            className="w-24"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddLimit()
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddLimit}
            disabled={!newLimitKey.trim() || newLimitKey in limits}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="text-muted-foreground mt-2 text-xs">
        Appuyez sur Entrée ou cliquez sur + pour ajouter une limite
      </p>
    </div>
  )
}
