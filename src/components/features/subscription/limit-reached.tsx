import {AlertTriangle, ArrowRight, Zap} from 'lucide-react'
import Link from 'next/link'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Progress} from '@/components/ui/progress'
import {SubscriptionLimit} from '@/services/subscription-service'
import {
  AVAILABLE_LIMITS,
  LimitType,
  PlanConst,
  SubscriptionPlan,
} from '@/services/types/domain/subscription-types'

interface LimitReachedProps {
  limits: SubscriptionLimit
}

export function LimitReached({limits}: LimitReachedProps) {
  const progressPercentage =
    limits.limit > 0 ? (limits.usage / limits.limit) * 100 : 0

  // Fonction pour formater le nom du plan
  const formatPlanName = (plan: SubscriptionPlan) => {
    switch (plan.toLowerCase()) {
      case PlanConst.FREE:
        return 'Gratuit'
      case PlanConst.PRO:
        return 'Pro'
      case PlanConst.ENTREPRISE:
        return 'Enterprise'
      case PlanConst.LIFETIME:
        return 'Lifetime'
      default:
        return plan.charAt(0).toUpperCase() + plan.slice(1)
    }
  }

  // Fonction pour obtenir la configuration de la limite
  const getLimitConfig = (limitType: LimitType) => {
    return (
      AVAILABLE_LIMITS.find((limit) => limit.key === limitType) || {
        key: limitType,
        label: limitType.charAt(0).toUpperCase() + limitType.slice(1),
        unit: limitType,
        icon: '📊',
        description: `Limite de ${limitType}`,
      }
    )
  }

  const limitConfig = getLimitConfig(limits.limitType)

  return (
    <div className="container mx-auto py-8">
      <div className="mx-auto max-w-2xl">
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-destructive/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                  <AlertTriangle className="text-destructive h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-destructive">
                    Limite de {limitConfig.label.toLowerCase()} atteinte
                  </CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Vous avez atteint votre limite de{' '}
                    {limitConfig.label.toLowerCase()}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="border-muted-foreground/50">
                Plan {formatPlanName(limits.plan as SubscriptionPlan)}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Informations sur l'usage */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Utilisation actuelle
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {limits.usage} / {limits.limit} {limitConfig.unit}
                  </Badge>
                </div>
              </div>
              <Progress value={progressPercentage} className="h-2" />
              <div className="text-muted-foreground flex justify-between text-xs">
                <span>0 {limitConfig.unit}</span>
                <span>
                  {limits.limit} {limitConfig.unit} maximum
                </span>
              </div>
            </div>

            {/* Message explicatif */}
            <Alert>
              <Zap className="h-4 w-4" />
              <AlertTitle>Mise à niveau nécessaire</AlertTitle>
              <AlertDescription>
                Pour créer plus de {limitConfig.label.toLowerCase()}, vous devez
                mettre à niveau votre abonnement.
                {limits.hasSubscription
                  ? " Consultez les options disponibles sur votre page d'abonnement."
                  : ' Souscrivez à un plan pour débloquer plus de fonctionnalités.'}
              </AlertDescription>
            </Alert>

            {/* Actions */}
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button asChild className="flex-1">
                <Link
                  href="/account/billing/subscription"
                  className="flex items-center gap-2"
                >
                  <Zap className="h-4 w-4" />
                  {limits.hasSubscription
                    ? 'Gérer mon abonnement'
                    : 'Choisir un plan'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            {/* Statistiques supplémentaires */}
            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              <div className="text-center">
                <div className="text-primary text-2xl font-bold">
                  {limits.usage}
                </div>
                <div className="text-muted-foreground text-xs">
                  {limitConfig.label} créés
                </div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground text-2xl font-bold">
                  {limits.remaining}
                </div>
                <div className="text-muted-foreground text-xs">
                  {limitConfig.label} restants
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
