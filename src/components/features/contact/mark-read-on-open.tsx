'use client'

import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useRef,
} from 'react'

import type {ContactMessageReadActionResult} from './contact-message-detail'

const settledRead: RefObject<Promise<unknown>> = {current: Promise.resolve()}

const ReadOnOpenContext = createContext(settledRead)

/**
 * La promesse du marquage lu de l'ouverture, reglee (succes ou echec). Une
 * bascule vers « non lu » l'attend : sinon le marquage lu, parti en premier,
 * pourrait arriver apres elle et l'effacer.
 */
export const useReadOnOpenSettled = (): RefObject<Promise<unknown>> =>
  useContext(ReadOnOpenContext)

/**
 * Marque le message lu a l'ouverture (decision E du plan s08) : la page de
 * detail ne mute pas pendant son rendu, c'est ce composant, monte dans le
 * navigateur, qui appelle la Server Action idempotente — une seule fois. Il
 * enveloppe le detail pour lui donner la promesse de ce marquage.
 */
export function MarkReadOnOpen({
  messageId,
  markReadAction,
  children,
}: {
  messageId: string
  markReadAction: (id: string) => Promise<ContactMessageReadActionResult>
  children?: ReactNode
}) {
  const requested = useRef(false)
  const settled = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    if (requested.current) return
    requested.current = true
    settled.current = markReadAction(messageId).catch(() => undefined)
  }, [messageId, markReadAction])

  return (
    <ReadOnOpenContext.Provider value={settled}>
      {children}
    </ReadOnOpenContext.Provider>
  )
}
