'use client'

import {AlertCircle} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useState} from 'react'

import {updateOrganizationModulesAction} from '@/app/[locale]/admin/organizations/actions'
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Badge} from '@/components/ui/badge'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Label} from '@/components/ui/label'
import {Switch} from '@/components/ui/switch'
import {
  ORGANIZATION_MODULES,
  OrganizationModule,
} from '@/services/types/domain/organization-types'

/**
 * Ecran B de s01 : les drapeaux de modules d'une association.
 *
 * `switch` et non `checkbox` : ici l'effet est immediat. Le **libelle d'etat
 * est ecrit** (« Active » / « Desactive ») parce qu'une information ne doit
 * jamais tenir a la seule couleur — l'interrupteur ne fait que redoubler le
 * mot. Le libelle ne change qu'apres confirmation de l'enregistrement : en cas
 * d'echec, le curseur revient a l'etat que la base porte reellement.
 */
export function OrganizationModulesCard({
  organizationId,
  enabledModules,
}: {
  organizationId: string
  enabledModules: OrganizationModule[]
}) {
  const t = useTranslations('AdminOrganizations.modules')
  const [active, setActive] = useState<OrganizationModule[]>(enabledModules)
  const [pending, setPending] = useState<string | undefined>()
  const [failed, setFailed] = useState<string | undefined>()

  const onToggle = async (moduleKey: OrganizationModule, checked: boolean) => {
    const next = checked
      ? [...active, moduleKey]
      : active.filter((key) => key !== moduleKey)

    setPending(moduleKey)
    setFailed(undefined)

    const result = await updateOrganizationModulesAction(organizationId, next)

    setPending(undefined)
    if (result.success) {
      setActive(next)
      return
    }
    setFailed(moduleKey)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('cardTitle')}</CardTitle>
          <Badge variant="outline">
            {t('badge', {
              active: active.length,
              total: ORGANIZATION_MODULES.length,
            })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {failed && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>
              {t('errorTitle', {module: t(`keys.${failed}`)})}
            </AlertTitle>
            <AlertDescription>{t('errorBody')}</AlertDescription>
          </Alert>
        )}

        {ORGANIZATION_MODULES.map((moduleKey) => {
          const isActive = active.includes(moduleKey)
          return (
            <div
              key={moduleKey}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex flex-col">
                <Label htmlFor={`switch-${moduleKey}`}>
                  {t(`keys.${moduleKey}`)}
                </Label>
                <span className="text-muted-foreground text-sm">
                  {t(`descriptions.${moduleKey}`)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="text-sm"
                  data-testid={`module-state-${moduleKey}`}
                >
                  {pending === moduleKey
                    ? t('saving')
                    : isActive
                      ? t('enabled')
                      : t('disabled')}
                </span>
                <span className="flex size-11 items-center justify-center">
                  <Switch
                    id={`switch-${moduleKey}`}
                    checked={isActive}
                    disabled={pending !== undefined}
                    onCheckedChange={(checked) => onToggle(moduleKey, checked)}
                  />
                </span>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
