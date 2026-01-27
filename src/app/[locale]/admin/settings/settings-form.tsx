'use client'

import {Loader2, Mail, Settings} from 'lucide-react'
import {useState} from 'react'
import {toast} from 'sonner'

import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Switch} from '@/components/ui/switch'
import {Textarea} from '@/components/ui/textarea'
import {
  AppSettingsGroupedByCategory,
  SettingCategory,
} from '@/services/types/domain/app-settings-types'

import {updateSettingsAction} from './actions'

interface SettingsFormProps {
  settingsGrouped: AppSettingsGroupedByCategory
}

const categoryConfig: Record<
  SettingCategory,
  {
    title: string
    description: string
    icon: React.ComponentType<{className?: string}>
  }
> = {
  email: {
    title: 'Email Settings',
    description: "Configure l'envoi d'emails depuis l'application",
    icon: Mail,
  },
  general: {
    title: 'General Settings',
    description: "Paramètres généraux de l'application",
    icon: Settings,
  },
}

export default function SettingsForm({settingsGrouped}: SettingsFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [formValues, setFormValues] = useState<Record<string, string>>(() => {
    const values: Record<string, string> = {}
    for (const category of Object.keys(settingsGrouped) as SettingCategory[]) {
      for (const setting of settingsGrouped[category]) {
        values[setting.key] = setting.value
      }
    }
    return values
  })

  const handleChange = (key: string, value: string) => {
    setFormValues((prev) => ({...prev, [key]: value}))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const settings = Object.entries(formValues).map(([key, value]) => ({
        key,
        value,
      }))

      const result = await updateSettingsAction(settings)

      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error('Erreur lors de la mise à jour des paramètres')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const renderSettingInput = (
    setting: AppSettingsGroupedByCategory[SettingCategory][number]
  ) => {
    const value = formValues[setting.key] ?? setting.value

    switch (setting.type) {
      case 'boolean':
        return (
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor={setting.key} className="text-base font-medium">
                {setting.label || setting.key}
              </Label>
              {setting.description && (
                <p className="text-muted-foreground text-sm">
                  {setting.description}
                </p>
              )}
            </div>
            <Switch
              id={setting.key}
              checked={value === 'true'}
              onCheckedChange={(checked) =>
                handleChange(setting.key, checked ? 'true' : 'false')
              }
            />
          </div>
        )

      case 'number':
        return (
          <div className="space-y-2">
            <Label htmlFor={setting.key}>{setting.label || setting.key}</Label>
            {setting.description && (
              <p className="text-muted-foreground text-sm">
                {setting.description}
              </p>
            )}
            <Input
              id={setting.key}
              type="number"
              value={value}
              onChange={(e) => handleChange(setting.key, e.target.value)}
            />
          </div>
        )

      case 'json':
        return (
          <div className="space-y-2">
            <Label htmlFor={setting.key}>{setting.label || setting.key}</Label>
            {setting.description && (
              <p className="text-muted-foreground text-sm">
                {setting.description}
              </p>
            )}
            <Textarea
              id={setting.key}
              value={value}
              onChange={(e) => handleChange(setting.key, e.target.value)}
              className="font-mono"
              rows={4}
            />
          </div>
        )

      default:
        return (
          <div className="space-y-2">
            <Label htmlFor={setting.key}>{setting.label || setting.key}</Label>
            {setting.description && (
              <p className="text-muted-foreground text-sm">
                {setting.description}
              </p>
            )}
            <Input
              id={setting.key}
              type="text"
              value={value}
              onChange={(e) => handleChange(setting.key, e.target.value)}
            />
          </div>
        )
    }
  }

  const categories = Object.keys(settingsGrouped) as SettingCategory[]

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {categories.map((category) => {
        const settings = settingsGrouped[category]
        if (settings.length === 0) return null

        const config = categoryConfig[category]
        const Icon = config.icon

        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className="h-5 w-5" />
                {config.title}
              </CardTitle>
              <CardDescription>{config.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings.map((setting) => (
                <div key={setting.key}>{renderSettingInput(setting)}</div>
              ))}
            </CardContent>
          </Card>
        )
      })}

      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Enregistrer les paramètres
        </Button>
      </div>
    </form>
  )
}
