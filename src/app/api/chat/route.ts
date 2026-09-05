import {NextRequest, NextResponse} from 'next/server'

import {env} from '@/env'
import {withUserAuth} from '@/lib/api-auth'
import {
  getChatProvider,
  parseStreamChunk,
  validateChatMessage,
} from '@/services/facades/chat-service-facade'

export const POST = withUserAuth(async (request: NextRequest, authUser) => {
  try {
    const body = await request.json()

    // Validation des données selon les règles
    const validatedMessage = validateChatMessage(body)

    // Log pour audit (utilisateur authentifié utilise le chat)
    console.log(`Chat request from user ${authUser.id} (${authUser.email})`)

    // Obtenir le provider configuré
    const provider = getChatProvider()

    // Obtenir le stream du provider
    const aiStream = await provider.sendMessage(
      validatedMessage.content,
      validatedMessage.model
    )

    // Créer un ReadableStream transformé pour le client
    const transformStream = new ReadableStream({
      start(controller) {
        const reader = aiStream.getReader()
        const decoder = new TextDecoder()

        function pump(): Promise<void> {
          return reader
            .read()
            .then(({done, value}) => {
              if (done) {
                controller.enqueue(
                  new TextEncoder().encode(
                    `data: ${JSON.stringify({content: '', done: true})}\n\n`
                  )
                )
                controller.close()
                return
              }

              const chunk = decoder.decode(value, {stream: true})
              const lines = chunk.split('\n').filter((line) => line.trim())

              for (const line of lines) {
                try {
                  const parsed = parseStreamChunk(line, env.CHAT_PROVIDER)
                  if (parsed.content) {
                    controller.enqueue(
                      new TextEncoder().encode(
                        `data: ${JSON.stringify({content: parsed.content, done: parsed.done})}\n\n`
                      )
                    )
                  }
                  if (parsed.done) {
                    controller.enqueue(
                      new TextEncoder().encode(
                        `data: ${JSON.stringify({content: '', done: true})}\n\n`
                      )
                    )
                    controller.close()
                    return
                  }
                } catch (error) {
                  console.warn('Erreur parsing ligne:', error)
                }
              }

              return pump()
            })
            .catch((error) => {
              console.error('Erreur stream:', error)
              controller.error(error)
            })
        }

        return pump()
      },
    })

    return new NextResponse(transformStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  } catch (error) {
    console.error('Erreur API chat:', error)

    // Gestion des erreurs selon les règles
    if (error instanceof Error) {
      // Erreurs de validation ou de configuration
      if (
        error.message.includes('invalide') ||
        error.message.includes('configurée')
      ) {
        return NextResponse.json({error: error.message}, {status: 400})
      }

      // Erreurs des providers externes
      if (error.message.includes('Erreur')) {
        return NextResponse.json(
          {error: 'Service de chat temporairement indisponible'},
          {status: 503}
        )
      }
    }

    return NextResponse.json(
      {error: 'Erreur interne du serveur'},
      {status: 500}
    )
  }
})
