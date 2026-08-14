'use client' // Error boundaries must be Client Components

import Link from 'next/link'
import React from 'react'
import {useEffect} from 'react'

function ErrorIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <circle cx="12" cy="16" r="1" />
    </svg>
  )
}

export default function Error({
  error,
  reset,
}: {
  error: Error & {digest?: string}
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md text-center">
        <ErrorIcon className="text-destructive mx-auto h-12 w-12" />
        <h1 className="text-foreground mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          Une erreur est survenue
        </h1>
        <p className="text-muted-foreground mt-4">
          Désol&eacute;, une erreur inattendue s&apos;est produite. Veuillez
          r&eacute;essayer ou contacter l&apos;administrateur si le
          probl&egrave;me persiste.
        </p>
        <pre className="bg-muted text-muted-foreground mt-6 max-h-40 overflow-x-auto rounded-md p-4 text-left text-xs">
          {error.message || error.digest || 'Erreur inconnue'}
        </pre>
        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary inline-flex items-center rounded-md px-4 py-2 text-sm font-medium shadow-sm transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
            onClick={() => reset()}
          >
            R&eacute;essayer
          </button>
          <Link
            href="/"
            className="text-muted-foreground hover:text-primary text-sm underline"
            prefetch={false}
          >
            Retour &agrave; l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  )
}
