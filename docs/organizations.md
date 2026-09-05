# Système d'Organisations avec Better Auth

## Vue d'ensemble

Ce document décrit le fonctionnement du système d'organisations implémenté avec le plugin **Organization** de Better Auth. Le système permet aux utilisateurs de créer et gérer des organisations, d'inviter des membres, et de collaborer au sein d'équipes structurées.

## Architecture

### Technologies utilisées

- **Better Auth** : Framework d'authentification principal
- **Plugin Organization** : Gestion native des organisations
- **Drizzle ORM** : Accès aux données avec PostgreSQL
- **Next.js 15** : Framework React avec App Router
- **TypeScript** : Typage strict pour la sécurité

### Configuration Better Auth

```typescript
// src/lib/better-auth/auth.ts
import {organization} from 'better-auth/plugins'

export const auth = betterAuth({
  plugins: [
    organization({
      async sendInvitationEmail(data) {
        const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/invitations/${data.id}`
        await sendOrganizationInvitationService({
          email: data.email,
          invitedByUsername: data.inviter.user.name,
          invitedByEmail: data.inviter.user.email,
          teamName: data.organization.name,
          inviteLink,
        })
      },
    }),
  ],
})
```

## Organisation Personnelle par Défaut

### Création automatique

Lors de l'inscription d'un utilisateur, une **organisation personnelle** est automatiquement créée :

```typescript
// src/services/user-service.ts
export const createOrganizationForUserService = async (email: string) => {
  const user = await getUserByEmailDao(email)
  const slug = await generateUniqueSlug(email.split('@')[0])

  const organizationData: CreateOrganization = {
    name: `${user.name} organization`,
    slug,
    description: `Organization for ${user.email}`,
  }

  return await createUserRoleAndOrganizationTxnDao(user.id, organizationData)
}
```

### Caractéristiques

- **Nom** : `{Nom de l'utilisateur} organization`
- **Slug** : Généré automatiquement à partir de l'email
- **Rôle** : L'utilisateur devient automatiquement **OWNER**
- **Description** : `Organization for {email}`

### Initialisation lors de l'inscription

```typescript
// src/app/[locale]/(auth)/action.ts
export async function registerCredentialAction() {
  // ... validation et création du compte

  // Créer l'organisation personnelle
  const userOrganization = await createOrganizationForUserService(email)

  // Définir comme organisation active
  await auth.api.setActiveOrganization({
    headers: response2.headers,
    body: {
      organizationId: userOrganization.organizationId,
    },
  })
}
```

## Hiérarchie des Rôles

### Rôles disponibles

| Rôle       | Permissions                                | Description                    |
| ---------- | ------------------------------------------ | ------------------------------ |
| **OWNER**  | Toutes les permissions                     | Propriétaire de l'organisation |
| **ADMIN**  | Gestion des membres, modification de l'org | Administrateur                 |
| **MEMBER** | Lecture seule                              | Membre standard                |

### Permissions par rôle

```typescript
// src/services/authorization/organization-authorization.ts
export const canInviteToOrganization = async (organizationId: string) => {
  const authUser = await getAuthUser()
  return authUser?.organizations?.some(
    (org) =>
      org.organizationId === organizationId &&
      (org.role === UserOrganizationRoleConst.OWNER ||
        org.role === UserOrganizationRoleConst.ADMIN)
  )
}
```

## Gestion des Invitations

### Types d'invitations

1. **Invitations reçues** : Invitations d'autres organisations
2. **Invitations envoyées** : Invitations envoyées par l'utilisateur (OWNER/ADMIN)

### Page des invitations

```typescript
// src/app/[locale]/(app)/invitations/page.tsx
export default async function Page() {
  const invitations = await getUserInvitationsServiceDal()
  return <InvitationsContent invitationsUser={invitations} />
}
```

### Interface utilisateur

#### Invitations reçues

- **Organisation** : Nom de l'organisation invitante
- **Inviteur** : Nom de la personne qui a envoyé l'invitation
- **Rôle** : Rôle proposé dans l'organisation
- **Statut** : En attente, acceptée, rejetée, annulée
- **Actions** : Accepter / Rejeter (avec modals de confirmation)

#### Invitations envoyées (OWNER uniquement)

- **Email** : Adresse email de l'invité
- **Rôle** : Rôle proposé
- **Statut** : En attente, acceptée, rejetée, annulée
- **Date d'expiration** : Date limite de l'invitation
- **Actions** : Annuler (avec modal de confirmation)

### Modals de confirmation

#### Acceptation d'invitation

```typescript
// Modal d'acceptation
<Dialog>
  <DialogTitle>Confirmer l'acceptation</DialogTitle>
  <DialogDescription>
    Êtes-vous sûr de vouloir accepter l'invitation de{' '}
    <strong>{invitationToAction?.organization?.name}</strong> ?
    <br />
    Vous rejoindrez cette organisation en tant que{' '}
    <strong>{invitationToAction?.role}</strong>.
  </DialogDescription>
</Dialog>
```

#### Rejet d'invitation

```typescript
// Modal de rejet
<Dialog>
  <DialogTitle>Confirmer le rejet</DialogTitle>
  <DialogDescription>
    Êtes-vous sûr de vouloir rejeter l'invitation de{' '}
    <strong>{invitationToAction?.organization?.name}</strong> ?
    <br />
    Cette action ne peut pas être annulée.
  </DialogDescription>
</Dialog>
```

#### Annulation d'invitation

```typescript
// Modal d'annulation
<Dialog>
  <DialogTitle>Confirmer l'annulation</DialogTitle>
  <DialogDescription>
    Êtes-vous sûr de vouloir annuler l'invitation envoyée à{' '}
    <strong>{invitationToCancel?.email}</strong> ?
    <br />
    Cette action ne peut pas être annulée.
  </DialogDescription>
</Dialog>
```

## Gestion des Membres

### Page de détail de l'organisation

```typescript
// src/app/[locale]/(app)/organizations/[id]/edit/page.tsx
export default async function EditOrganizationPage({params}) {
  const {id} = await params
  const organization = await getOrganizationByIdService(id)
  const {canReadMembers, canManageMembers, canEdit} =
    await getOrganizationPermissions(id)

  return (
    <div>
      <EditOrganizationForm organization={organization} canEdit={canEdit} />

      {canReadMembers && (
        <OrganizationMembersTable
          organizationId={organization.id}
          canManageMembers={canManageMembers}
        />
      )}
    </div>
  )
}
```

### Tableau des membres

#### Fonctionnalités

- **Affichage responsive** : Colonnes masquées selon la taille d'écran
- **Statuts des invitations** : En attente, expirée
- **Gestion des rôles** : Modification des rôles (OWNER/ADMIN)
- **Suppression de membres** : Retrait d'utilisateurs
- **Annulation d'invitations** : Annulation des invitations en attente

#### Structure du tableau

```typescript
// src/components/features/organization/organization-members-table.tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Avatar</TableHead>
      <TableHead>Nom</TableHead>
      <TableHead className="hidden sm:table-cell">Email</TableHead>
      <TableHead className="hidden md:table-cell">Rôle</TableHead>
      <TableHead className="hidden lg:table-cell">Date d'ajout</TableHead>
      <TableHead>Actions</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {members.map((member) => (
      <TableRow key={member.id}>
        <TableCell>
          <Avatar>
            <AvatarImage src={member.image} alt={member.name} />
            <AvatarFallback>{member.name?.[0]}</AvatarFallback>
          </Avatar>
        </TableCell>
        <TableCell>
          <div className="flex flex-col">
            <span className="font-medium">{member.name}</span>
            {member.status === 'invited' && (
              <Badge variant={isExpired ? "destructive" : "outline"}>
                {isExpired ? 'Invitation expirée' : 'Invitation en attente'}
              </Badge>
            )}
          </div>
        </TableCell>
        {/* ... autres colonnes */}
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### Ajout de membres

#### Formulaire d'ajout

```typescript
// src/components/features/organization/organization-add-member-form.tsx
export function OrganizationAddMemberForm({organizationId}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [role, setRole] = useState('member')

  const handleAddMember = async () => {
    await addUserToOrganizationAction(
      organizationId,
      selectedUser.id,
      selectedUser.email,
      role,
      true // Envoyer une invitation par email
    )
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Ajouter un membre</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un membre</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder="Rechercher un utilisateur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <Select value={role} onValueChange={setRole}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un rôle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Membre</SelectItem>
              <SelectItem value="admin">Administrateur</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

#### Actions disponibles

- **Recherche d'utilisateurs** : Recherche par nom ou email
- **Sélection de rôle** : Member, Admin
- **Envoi d'invitation** : Email automatique via Better Auth
- **Ajout direct** : Ajout immédiat sans invitation

## Modèles de données

### Tables principales

```sql
-- Table des organisations
CREATE TABLE organization (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  logo TEXT,
  metadata TEXT
);

-- Table des membres
CREATE TABLE member (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  role organization_role DEFAULT 'member' NOT NULL,
  created_at TIMESTAMP NOT NULL,
  UNIQUE(organization_id, user_id)
);

-- Table des invitations
CREATE TABLE invitation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT,
  status TEXT DEFAULT 'pending' NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  inviter_id UUID NOT NULL REFERENCES user(id) ON DELETE CASCADE
);
```

### Types TypeScript

```typescript
// src/services/types/domain/organization-types.ts
export interface Organization {
  id: string
  name: string
  slug: string
  description?: string
  logo?: string
  createdAt: Date
  updatedAt: Date
}

export interface Member {
  id: string
  organizationId: string
  userId: string
  role: OrganizationRole
  createdAt: Date
}

export interface Invitation {
  id: string
  organizationId: string
  email: string
  role: string
  status: 'pending' | 'accepted' | 'rejected' | 'canceled'
  expiresAt: Date
  inviterId: string
}
```

## Flux d'utilisation

### 1. Inscription d'un utilisateur

1. L'utilisateur s'inscrit avec email/mot de passe
2. Une organisation personnelle est automatiquement créée
3. L'utilisateur devient OWNER de cette organisation
4. L'organisation est définie comme active

### 2. Invitation à une organisation

1. Un OWNER/ADMIN invite un utilisateur par email
2. Better Auth envoie un email d'invitation
3. L'utilisateur reçoit l'invitation dans sa page `/invitations`
4. L'utilisateur peut accepter ou rejeter l'invitation
5. En cas d'acceptation, l'utilisateur devient membre de l'organisation

### 3. Gestion des membres

1. Les OWNER/ADMIN peuvent voir tous les membres
2. Ils peuvent modifier les rôles des membres
3. Ils peuvent supprimer des membres
4. Ils peuvent annuler des invitations en attente

### 4. Navigation entre organisations

1. L'utilisateur peut avoir plusieurs organisations
2. Il peut basculer entre les organisations
3. L'organisation active détermine le contexte d'utilisation

## Sécurité et autorisations

### Vérifications d'autorisation

```typescript
// Vérification des permissions pour chaque action
export const canInviteToOrganization = async (organizationId: string) => {
  const authUser = await getAuthUser()
  return authUser?.organizations?.some(
    (org) =>
      org.organizationId === organizationId &&
      (org.role === UserOrganizationRoleConst.OWNER ||
        org.role === UserOrganizationRoleConst.ADMIN)
  )
}

export const canManageMembers = async (organizationId: string) => {
  const authUser = await getAuthUser()
  return authUser?.organizations?.some(
    (org) =>
      org.organizationId === organizationId &&
      (org.role === UserOrganizationRoleConst.OWNER ||
        org.role === UserOrganizationRoleConst.ADMIN)
  )
}
```

### Protection des routes

```typescript
// Middleware de protection
export async function requireOrganizationAccess(organizationId: string) {
  const authUser = await getAuthUser()
  const hasAccess = authUser?.organizations?.some(
    (org) => org.organizationId === organizationId
  )

  if (!hasAccess) {
    throw new AuthorizationError('Accès non autorisé à cette organisation')
  }
}
```

## Intégration avec Stripe

### Gestion des abonnements

Le système d'organisations s'intègre avec Stripe pour la gestion des abonnements :

```typescript
// src/lib/better-auth/auth.ts
stripe({
  authorizeReference: async ({user, referenceId, action}) => {
    if (action === 'upgrade-subscription' || action === 'cancel-subscription') {
      // Mode ORGANIZATION : vérifier le rôle dans l'org
      if (BILLING_MODE === BillingModes.ORGANIZATION) {
        const org = await getOrganizationMembersService(referenceId)
        const member = org.find((m) => m.userId === user.id)
        // Seuls owner et admin peuvent gérer les abonnements
        return member?.role === 'owner' || member?.role === 'admin'
      }
    }
    return false
  },
})
```

## Bonnes pratiques

### 1. Gestion des erreurs

- Toujours vérifier les permissions avant les actions
- Gérer les cas d'erreur avec des messages explicites
- Logger les actions importantes pour l'audit

### 2. Performance

- Utiliser des requêtes optimisées pour les listes de membres
- Implémenter la pagination pour les grandes organisations
- Mettre en cache les informations d'organisation fréquemment utilisées

### 3. UX/UI

- Afficher des modals de confirmation pour les actions destructives
- Fournir des feedbacks visuels pour les actions en cours
- Implémenter une interface responsive pour tous les écrans

### 4. Sécurité

- Valider toutes les entrées utilisateur
- Vérifier les permissions à chaque niveau
- Utiliser des tokens sécurisés pour les invitations

## Conclusion

Le système d'organisations avec Better Auth offre une solution complète et sécurisée pour la gestion d'équipes. Il combine la simplicité d'utilisation avec la robustesse nécessaire pour les applications professionnelles, tout en s'intégrant parfaitement avec les autres fonctionnalités comme la facturation Stripe.
