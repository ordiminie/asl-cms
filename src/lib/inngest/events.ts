import {inngest} from './inngest'

/**
 * Constantes pour les noms d'événements Inngest
 */
export const INNGEST_EVENTS = {
  USER_REGISTERED: 'user/registered',
  TEST_HELLO_WORLD: 'test/hello.world',
} as const

/**
 * Type pour les noms d'événements
 */
export type InngestEventName =
  (typeof INNGEST_EVENTS)[keyof typeof INNGEST_EVENTS]

/**
 * Déclenche l'envoi d'un email de suivi 24h après l'inscription
 */
export const triggerInngestWelcomeFollowUpEmail = async ({
  userId,
  userName,
  userEmail,
  language = 'fr',
}: {
  userId: string
  userName: string
  userEmail: string
  language?: 'fr' | 'en' | 'es'
}) => {
  console.log(
    'triggerWelcomeFollowUpEmail',
    userId,
    userName,
    userEmail,
    language
  )
  return await inngest.send({
    name: INNGEST_EVENTS.USER_REGISTERED,
    data: {
      userId,
      userName,
      userEmail,
      language,
    },
  })
}
