import {Metadata} from 'next'

import {withAuthAdmin} from '@/components/features/auth/with-auth'

import EmailsContent from './emails-content'

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
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
