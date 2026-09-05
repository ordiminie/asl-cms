import {Metadata} from 'next'

import {withAuthAdmin} from '@/components/features/auth/with-auth'

import EmailsContent from './emails-content'

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
