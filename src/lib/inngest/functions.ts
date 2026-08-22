import {env} from '@/env'
import {INNGEST_EVENTS} from '@/lib/inngest/events'
import {inngest} from '@/lib/inngest/inngest'
import {logger} from '@/lib/logger'
import {approveMaturedCommissionsService} from '@/services/facades/affiliate-service-facade'
import {reconcileNegativeBalancesService} from '@/services/facades/credit-service-facade'
import {sendWelcomeFollowUpEmailService} from '@/services/facades/email-service-facade'
import {SupportedLanguage} from '@/services/types/common-type'

const INNGEST_FUNCTION_IDS = {
  HELLO_WORLD: 'hello-world',
  SEND_WELCOME_FOLLOW_UP_EMAIL: 'send-welcome-follow-up-email',
  RECONCILE_NEGATIVE_CREDIT_BALANCES: 'reconcile-negative-credit-balances',
  APPROVE_MATURED_AFFILIATE_COMMISSIONS:
    'approve-matured-affiliate-commissions',
} as const

const helloWorld = inngest.createFunction(
  {
    id: INNGEST_FUNCTION_IDS.HELLO_WORLD,
    triggers: {event: INNGEST_EVENTS.TEST_HELLO_WORLD},
  },
  async ({event, step}) => {
    await step.sleep('wait-a-moment', '1s')
    return {message: `Hello ${event.data.email}!`}
  }
)

const sendWelcomeFollowUpEmail = inngest.createFunction(
  {
    id: INNGEST_FUNCTION_IDS.SEND_WELCOME_FOLLOW_UP_EMAIL,
    triggers: {event: INNGEST_EVENTS.USER_REGISTERED},
  },
  async ({event, step}) => {
    // Attendre 24 heures après l'inscription
    await step.sleep('wait-24-hours', '24h')

    // Récupérer les données utilisateur
    const userData = await step.run('get-user-data', async () => {
      return {
        id: event.data.userId,
        name: event.data.userName,
        email: event.data.userEmail,
        language: event.data.language || 'fr',
      }
    })

    // Envoyer l'email de suivi
    await step.run('send-follow-up-email', async () => {
      const appUrl = env.NEXT_PUBLIC_APP_URL

      return await sendWelcomeFollowUpEmailService({
        email: userData.email,
        userName: userData.name,
        appUrl,
        language: userData.language as SupportedLanguage,
      })
    })

    return {
      success: true,
      userId: userData.id,
      emailSent: true,
      sentAt: new Date().toISOString(),
    }
  }
)

/**
 * Cron de reconciliation : compense automatiquement chaque nuit les soldes
 * negatifs fantomes (annulations qui n'ont pas declenche le hook Better Auth,
 * downgrades de plan, pauses Stripe, comptes legacy avant le deploiement).
 *
 * Idempotent par jour via sourceId='reconcile:<orgId>:<YYYY-MM-DD>'.
 * Premier passage en prod = backfill automatique des comptes deja casses.
 *
 * Tourne quotidiennement a 4:00 UTC.
 */
const reconcileNegativeCreditBalances = inngest.createFunction(
  {
    id: INNGEST_FUNCTION_IDS.RECONCILE_NEGATIVE_CREDIT_BALANCES,
    retries: 2,
    triggers: {cron: '0 4 * * *'},
  },
  async ({step}) => {
    logger.info('🔄 [Inngest] reconcile-negative-credit-balances - start')

    const result = await step.run('reconcile', async () => {
      return await reconcileNegativeBalancesService()
    })

    logger.info('🔄 [Inngest] reconcile complete', result)

    return result
  }
)

/**
 * Fait mûrir chaque nuit les primes d'affiliation dont le délai de carence est
 * écoulé.
 *
 * La date d'échéance est figée à la création de la prime, jamais recalculée
 * ici : modifier le barème du programme ne doit pas réécrire l'historique.
 *
 * Tourne quotidiennement a 3:00 UTC, avant la reconciliation des crédits.
 */
const approveMaturedAffiliateCommissions = inngest.createFunction(
  {
    id: INNGEST_FUNCTION_IDS.APPROVE_MATURED_AFFILIATE_COMMISSIONS,
    retries: 2,
    triggers: {cron: '0 3 * * *'},
  },
  async ({step}) => {
    logger.info('🎁 [Inngest] approve-matured-affiliate-commissions - start')

    const result = await step.run('approve-matured', async () => {
      return await approveMaturedCommissionsService()
    })

    logger.info('🎁 [Inngest] approve-matured complete', result)

    return result
  }
)

export {
  approveMaturedAffiliateCommissions,
  helloWorld,
  reconcileNegativeCreditBalances,
  sendWelcomeFollowUpEmail,
}
