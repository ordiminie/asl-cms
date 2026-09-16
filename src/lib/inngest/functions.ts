import {env} from '@/env'
import {INNGEST_EVENTS} from '@/lib/inngest/events'
import {inngest} from '@/lib/inngest/inngest'
import {sendWelcomeFollowUpEmailService} from '@/services/facades/email-service-facade'
import {SupportedLanguage} from '@/services/types/common-type'

const INNGEST_FUNCTION_IDS = {
  HELLO_WORLD: 'hello-world',
  SEND_WELCOME_FOLLOW_UP_EMAIL: 'send-welcome-follow-up-email',
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

export {helloWorld, sendWelcomeFollowUpEmail}
