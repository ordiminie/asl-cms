import {
  SubscriptionAddModel,
  SubscriptionModel,
  SubscriptionPlanAddModel,
  SubscriptionPlanModel,
} from '@/db/models/subscription-model'

// Types de domaine découplés des types Drizzle - Aligned with Better Auth
export type Subscription = SubscriptionModel
export type SubscriptionPlan = 'pro' | 'enterprise' | 'lifetime' | 'free'

// Types pour les plans de subscription - Compatible avec StripePlan
export type Plan = SubscriptionPlanModel

// Types JSON souples pour flexibilité maximale
export type PlanLimits = Record<string, unknown> // Plus flexible que des types stricts
export type PlanFreeTrial = Record<string, unknown> // Plus flexible que des types stricts

// Types pour les opérations sur les plans
export type CreatePlan = Pick<
  SubscriptionPlanAddModel,
  'code' | 'priceId' | 'planName'
> & {
  annualDiscountPriceId?: string
  limits?: PlanLimits
  freeTrial?: PlanFreeTrial
  features?: unknown[] // Array JSON flexible
  description?: string
  price?: string // Décimal en string comme Drizzle
  yearlyPrice?: string // Décimal en string comme Drizzle
  currency?: string
  isRecurring?: boolean
  displayOrder?: number
}

export type UpdatePlan = {
  id: string
} & Partial<Omit<SubscriptionPlanAddModel, 'id'>>

// DTO pour la présentation côté client
export type PlanDTO = {
  id: string
  name: string
  code: string
  planName: string
  priceId: string
  annualDiscountPriceId?: string
  limits?: PlanLimits
  freeTrial?: PlanFreeTrial
  features?: unknown[]
  description?: string
  price?: string // Décimal en string comme Drizzle
  yearlyPrice?: string // Décimal en string comme Drizzle
  currency: string
  isRecurring: boolean
  status: string
  displayOrder: number
}

// Constantes pour les rôles globaux
export const PlanConst = {
  PRO: 'pro' as SubscriptionPlan,
  ENTREPRISE: 'enterprise' as SubscriptionPlan,
  LIFETIME: 'lifetime' as SubscriptionPlan,
  FREE: 'free' as SubscriptionPlan,
} as const

// Types pour les limites d'abonnement.
// `projects` et `credits` sont partis avec l'ADR 009 : le mecanisme de limites
// reste, ses cles suivent le perimetre reel.
export type LimitType = 'storage' | 'users'

// Constantes pour les limites
export const LimitTypeConst = {
  STORAGE: 'storage' as LimitType,
  USERS: 'users' as LimitType,
} as const

// Type pour la configuration d'une limite
export type LimitConfig = {
  key: LimitType
  label: string
  unit: string
  icon: string
  description?: string
}

// Configuration des limites disponibles
export const AVAILABLE_LIMITS: LimitConfig[] = [
  {
    key: 'storage',
    label: 'Stockage',
    unit: 'GB',
    icon: '💾',
    description: 'Espace de stockage total',
  },
] as const

// Types pour les opérations
export type CreateSubscription = Pick<
  SubscriptionAddModel,
  'referenceId' | 'plan' | 'status'
> & {
  periodStart?: Date
  periodEnd?: Date
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  cancelAtPeriodEnd?: boolean
  seats?: number
  trialStart?: Date
  trialEnd?: Date
}

export type UpdateSubscription = {
  id: string
} & Partial<Omit<SubscriptionAddModel, 'id'>>

// DTO = Data Transfer Object pour la présentation
export type SubscriptionDTO = {
  id: string
  plan: string
  referenceId: string
  status: string
  periodStart?: Date
  periodEnd?: Date
  seats?: number
  trialStart?: Date
  trialEnd?: Date
}

export enum StripeWebhooks {
  Completed = 'checkout.session.completed',
  PaymentSuccess = 'payment_intent.succeeded',
  PaymentFailed = 'payment_intent.payment_failed',
  SubscriptionDeleted = 'customer.subscription.deleted',
  SubscriptionUpdated = 'customer.subscription.updated',
}

// Billing Configuration

// Billing modes
export const BillingModes = {
  USER: 'user',
  ORGANIZATION: 'organization',
} as const

export type BillingMode = (typeof BillingModes)[keyof typeof BillingModes]

// ========================================
// TYPES MRR ET DASHBOARD ADMIN
// ========================================

export type SubscriptionMRRData = {
  subscriptionId: string
  stripeSubscriptionId: string
  planName: string
  planCode: string
  amount: number // en centimes
  currency: string
  quantity: number
  status: string
  interval: 'month' | 'year'
  intervalCount: number
  currentPeriodStart: Date
  currentPeriodEnd: Date
  createdAt: Date
  referenceId: string
}

export type PlanBreakdown = {
  planCode: string
  planName: string
  subscriptionCount: number
  totalMRR: number // en centimes
  averageAmount: number // en centimes
  currency: string
}

export type MRRStats = {
  totalMRR: number // en centimes
  currency: string
  totalActiveSubscriptions: number
  newSubscriptionsThisMonth: number
  subscriptionGrowthPercent: number // croissance en pourcentage
  subscriptionGrowth: {month: string; count: number}[] // croissance par mois
  planBreakdowns: PlanBreakdown[]
  monthlyMRR: number // en centimes (seulement les abonnements mensuels)
  yearlyMRR: number // en centimes (abonnements annuels divisés par 12)
  averageRevenuePerUser: number // en centimes
}
