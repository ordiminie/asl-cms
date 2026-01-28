import {EMAIL_REGISTRY} from '@/lib/emails/email-registry'

import EmailsTestForm from './emails-test-form'

export default function EmailsContent() {
  return (
    <div className="container mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-3xl font-bold">Email Testing</h1>
        <p className="text-muted-foreground">
          Test email templates by sending them to a specific address
        </p>
      </div>
      <EmailsTestForm emailRegistry={EMAIL_REGISTRY} />
    </div>
  )
}
