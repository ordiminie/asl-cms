'use client'

import dynamic from 'next/dynamic'
import {useTheme} from 'next-themes'
import {Toaster as Sonner, ToasterProps} from 'sonner'

const SonnerToaster = ({...props}: ToasterProps) => {
  const {theme = 'system'} = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
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
