import {
  CreditLedgerAddModel,
  CreditLedgerModel,
} from '@/db/models/credit-ledger-model'

// Types de domaine découplés des types Drizzle
export type CreditEntry = CreditLedgerModel
export type CreditSource = 'plan' | 'admin_grant' | 'usage' | 'pack'

// Constantes pour les sources de crédits
export const CreditSourceConst = {
  PLAN: 'plan' as CreditSource,
  ADMIN_GRANT: 'admin_grant' as CreditSource,
  USAGE: 'usage' as CreditSource,
  PACK: 'pack' as CreditSource,
} as const

// Types pour les opérations
export type CreateCreditEntry = Pick<
  CreditLedgerAddModel,
  'organizationId' | 'amount' | 'source'
> & {
  sourceId?: string
  reason?: string
  periodStart?: Date
  periodEnd?: Date
  expiresAt?: Date
}

// Type pour la consommation de crédits
export type ConsumeCredits = {
  organizationId: string
  amount: number
  reason: string
}

// Type pour l'octroi de crédits par admin
export type GrantCreditsOptions = {
  reason?: string
  expiresAt?: Date | null
}

// Type pour l'allocation mensuelle depuis Stripe
export type SubscriptionAllocationData = {
  stripeSubscriptionId: string
  organizationId: string
  periodStart: Date
  periodEnd: Date
  monthlyCredits: number
  overrideCredits?: number
}

// ========================================
// DTOs pour la présentation
// ========================================

export type CreditBalanceDTO = {
  available: number
  usedThisPeriod: number
  periodStart: Date | null
  periodEnd: Date | null
  monthlyAllocation: number
}

// Alias pour la compatibilité avec la couche présentation
export type CreditBalanceDetails = CreditBalanceDTO & {
  balance: number // Alias pour available
}

export type CreditUsageDay = {
  day: string // YYYY-MM-DD
  creditsUsed: number
}

export type CreditActivityItem = {
  id: string
  amount: number
  source: CreditSource
  reason: string | null
  createdAt: Date
}

// ========================================
// Types pour les packs de crédits
// ========================================

export type CreditPackConfig = {
  id: string
  name: string
  credits: number
  price: number // en centimes
  pricePerCredit: number // calculé
  stripePriceId: string
  popular?: boolean
  expiresInDays?: number | null // null = pas d'expiration
}

export type CreditPackPurchase = {
  organizationId: string
  packId: string
  credits: number
  stripeSessionId: string
  expiresAt: Date | null
}

// ========================================
// Configuration des packs par défaut
// ========================================

export const DEFAULT_CREDIT_PACKS: CreditPackConfig[] = [
  {
    id: 'pack_10',
    name: '10 Credits',
    credits: 10,
    price: 500, // 5€
    pricePerCredit: 50,
    stripePriceId: '', // À configurer dans Stripe
  },
  {
    id: 'pack_50',
    name: '50 Credits',
    credits: 50,
    price: 2000, // 20€
    pricePerCredit: 40,
    stripePriceId: '',
    popular: true,
  },
  {
    id: 'pack_150',
    name: '150 Credits',
    credits: 150,
    price: 5000, // 50€
    pricePerCredit: 33,
    stripePriceId: '',
  },
]

// ========================================
// Types pour les réponses du service
// ========================================

export type CreditBalanceResponse = {
  balance: number
  canConsume: boolean
  requiredAmount?: number
}

export type CreditCheckoutResponse = {
  checkoutUrl: string
  sessionId: string
}
