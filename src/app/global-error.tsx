'use client' // Une error boundary est forcément un Client Component

import * as Sentry from '@sentry/nextjs'
import {useEffect} from 'react'

/**
 * Dernier filet : cette boundary attrape les erreurs du layout racine, que
 * `error.tsx` ne peut pas capturer puisqu'il vit à l'intérieur de ce layout.
 *
 * Elle remplace tout le document — d'où les balises html/body — et ne peut donc
 * s'appuyer sur aucun style ni provider de l'application. Elle reste
 * volontairement autonome et minimale.
 *
 * Conséquence : ses textes sont **volontairement en dur**. `NextIntlClientProvider`
 * vit dans le layout de `[locale]`, celui-là même qui vient d'échouer ; un
 * `useTranslations` ici jetterait à son tour et on perdrait le dernier filet.
 * C'est le seul écran de l'application qui n'est pas traduit, et c'est assumé.
 */
export default function GlobalError({
  error,
}: {
  error: Error & {digest?: string}
}) {
  useEffect(() => {
    // Sans DSN configuré, le SDK n'est pas initialisé et cet appel ne fait rien.
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="fr">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          margin: 0,
          padding: '1.5rem',
        }}
      >
        <div style={{maxWidth: '28rem', textAlign: 'center'}}>
          <h1 style={{fontSize: '1.5rem', marginBottom: '0.75rem'}}>
            Une erreur est survenue
          </h1>
          <p style={{color: '#555', lineHeight: 1.6, marginBottom: '1.5rem'}}>
            La page n&apos;a pas pu s&apos;afficher. Rechargez la page ; si le
            problème persiste, il a été signalé et sera corrigé.
          </p>
          {/* Volontairement une ancre native et non next/link : le layout
              racine vient d'échouer, on veut un rechargement complet du
              document plutôt qu'une navigation client dans une application
              dont l'arbre est cassé. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              display: 'inline-block',
              padding: '0.6rem 1.1rem',
              borderRadius: '6px',
              background: '#111',
              color: '#fff',
              textDecoration: 'none',
            }}
          >
            Retour à l&apos;accueil
          </a>
        </div>
      </body>
    </html>
  )
}
