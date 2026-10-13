'use client'

import dynamic from 'next/dynamic'
import {Toaster as Sonner, ToasterProps} from 'sonner'

// Clair seul (ADR 033) : le thème des notifications est fixe.
const SonnerToaster = ({...props}: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

// Lazy load to avoid context issues during prerendering
const Toaster = dynamic(() => Promise.resolve(SonnerToaster), {
  ssr: false,
})

export {Toaster}
