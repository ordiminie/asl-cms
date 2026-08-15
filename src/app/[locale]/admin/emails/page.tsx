import {Metadata} from 'next'

import {withAuthAdmin} from '@/components/features/auth/with-auth'

import EmailsContent from './emails-content'

// Route authentifiée, pas encore migrée. Le layout fait un `await` sur la session à son
// niveau supérieur, ce qui bloque tout le segment. Le pattern officiel existe :
// https://nextjs.org/docs/app/guides/authentication-with-cache-components
// (session en 'use cache: private', promesse passée au provider, use() derrière Suspense).
// Voir D17 dans docs/plans/cache-components-migration.md.
export const instant = false

export const metadata: Metadata = {
  title: 'Email Testing',
  description: 'Test email templates',
}

function EmailsPage() {
  return (
    <div className="bg-background">
      <EmailsContent />
    </div>
  )
}

export default withAuthAdmin(EmailsPage)
