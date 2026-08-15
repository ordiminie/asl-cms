import {Metadata} from 'next'

import {withAuthAdmin} from '@/components/features/auth/with-auth'

import EmailsContent from './emails-content'

// Route authentifiée : le layout lit la session via getAuthUser() -> headers() et la
// passe à AuthProvider, qui enveloppe tout l'arbre. Aucun enfant à isoler dans un
// <Suspense> — c'est le cas que la doc Next appelle « no child to wrap ». Lever cet
// opt-out demande de revoir comment AuthProvider obtient l'utilisateur (D16).
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
