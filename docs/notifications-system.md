# Système de Notifications

Ce document détaille l'architecture et le fonctionnement du système de notifications du boilerplate SaaS Next.js.

## Vue d'Ensemble

Le système de notifications est conçu pour gérer de manière centralisée toutes les communications avec les utilisateurs, qu'elles soient affichées dans l'interface ou envoyées par email. Il s'intègre profondément avec Better Auth et Stripe pour automatiser les notifications liées à l'authentification et aux paiements.

## Architecture

### Structure en Couches

Le système respecte l'architecture en couches stricte du projet :

```
┌─────────────────────────────────────────────────────────────┐
│ Présentation (Pages/Composants React)                       │
├─────────────────────────────────────────────────────────────┤
│ DAL (Data Access Layer) avec Cache                         │
├─────────────────────────────────────────────────────────────┤
│ Façade (Interface avec Intercepteurs)                      │
├─────────────────────────────────────────────────────────────┤
│ Service (Logique Métier)                                   │
├─────────────────────────────────────────────────────────────┤
│ Repository (Base de Données)                               │
└─────────────────────────────────────────────────────────────┘
```

### Fichiers Principaux

- **Service** : `src/services/notification-service.ts`
- **Façade** : `src/services/facades/notification-service-facade.ts`
- **Repository** : `src/db/repositories/notification-repository.ts`
- **Types** : `src/services/types/domain/notification-types.ts`
- **Autorisations** : `src/services/authorization/notification-authorization.ts`
- **Interface** : `src/app/[locale]/(app)/notifications/`

## Modèle de Données

### Table `notifications`

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  userId UUID NOT NULL REFERENCES users(id),
  type VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  read BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

### Structure TypeScript

```typescript
interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  metadata?: Record<string, any>
  read: boolean
  createdAt: Date
}
```

## Types de Notifications

Le système supporte plusieurs catégories de notifications :

### Authentification

- `reset_password` : Réinitialisation de mot de passe
- `email_verification` : Vérification d'email
- `magic_link` : Lien magique de connexion
- `otp_code` : Code OTP pour 2FA
- `change_email_verification` : Changement d'email

### Abonnements et Paiements

- `subscription_created` : Nouvel abonnement
- `subscription_updated` : Abonnement modifié
- `subscription_canceled` : Abonnement annulé
- `subscription_deleted` : Abonnement supprimé
- `payment_failed` : Paiement échoué
- `payment_succeeded` : Paiement réussi

### Organisation

- `organization_invitation` : Invitation à rejoindre une organisation

### Sécurité

- `security_alert` : Alerte de sécurité
- `password_changed` : Mot de passe modifié

### Système

- `system_maintenance` : Maintenance système
- `user_banned` / `user_unbanned` : Utilisateur banni/débanni

### Projets

- `project_created` : Nouveau projet
- `project_updated` : Projet mis à jour

## Création de Notifications

### Fonction Principale : `createTypedNotificationService`

Cette fonction centralise la création de notifications avec gestion automatique des traductions et envoi d'emails.

```typescript
await createTypedNotificationService({
  userId: 'user-id',
  type: NotificationTypeConst.subscription_created,
  metadata: {
    subscription: subscriptionData,
  },
})
```

### Processus de Création

1. **Validation** des données d'entrée avec Zod
2. **Récupération** des paramètres utilisateur (langue, préférences email)
3. **Génération** du titre et message (traductions i18n si non fournis)
4. **Sauvegarde** en base de données
5. **Envoi d'email** conditionnel selon le type et les préférences

### Gestion des Traductions

Le système utilise next-intl pour les traductions automatiques :

```typescript
// Clés de traduction automatiques
const titleKey = `notifications.${type}.title`
const messageKey = `notifications.${type}.message`

// Récupération des traductions
const t = await getTranslations('notifications')
const title = t(titleKey, metadata)
const message = t(messageKey, metadata)
```

## Envoi d'Emails

### Classification des Notifications

Les notifications sont classées en deux catégories :

#### Notifications Critiques (Email Toujours Envoyé)

- Authentification et sécurité
- Réinitialisation de mot de passe
- Vérification d'email
- Codes OTP
- Magic links

#### Notifications Standard (Selon Préférences Utilisateur)

- Abonnements et paiements
- Invitations d'organisation
- Mises à jour de projets

### Templates d'Email

#### Templates Spécialisés

Chaque type critique a son propre template optimisé :

- `sendResetPasswordLinkEmailService`
- `sendVerificationEmailService`
- `sendMagicLinkEmailService`
- `sendOTPEmailService`
- `sendOrganizationInvitationService`

#### Template Générique

Pour les autres notifications, un template générique avec styles par type :

- `sendNotificationEmailService` avec classification info/warning/success/error

## Intégration Better Auth

Le système s'intègre directement dans la configuration Better Auth pour automatiser les notifications :

```typescript
// Configuration dans auth.ts
emailAndPassword: {
  sendResetPassword: async ({user, url}) => {
    await createTypedNotificationService({
      userId: user.id,
      type: NotificationTypeConst.reset_password,
      metadata: {url},
    })
  }
}

// Stripe webhooks
onSubscriptionComplete: async ({subscription}) => {
  await createTypedNotificationService({
    userId: user.id,
    type: NotificationTypeConst.subscription_created,
    metadata: {subscription},
  })
}
```

## Autorisations et Sécurité

Le système utilise CASL pour les autorisations :

### Règles de Base

- **Lecture** : Utilisateur peut lire ses propres notifications
- **Modification** : Utilisateur peut modifier ses propres notifications
- **Création** : Admins ou utilisateur pour lui-même
- **Suppression** : Utilisateur peut supprimer ses notifications

### Implémentation

```typescript
// Vérification d'autorisation
const canRead = await canReadNotification(user, notification)
if (!canRead) {
  throw new AuthorizationError('Accès refusé')
}
```

## Interface Utilisateur

### Page Notifications : `/notifications`

#### Composants Principaux

- **NotificationsManagement** : Composant racine avec état global
- **NotificationItem** : Affichage d'une notification individuelle
- **NotificationsToolbar** : Filtres et actions globales

#### Fonctionnalités

- **Filtrage** : "Toutes" / "Non lues" uniquement
- **Actions** : Marquer comme lu/non lu, supprimer
- **Action globale** : "Marquer tout comme lu"
- **Compteur** : Badge avec nombre de notifications non lues

### Server Actions

Actions Next.js pour les interactions :

```typescript
// Actions disponibles
markNotificationAsReadAction
markNotificationAsUnreadAction
deleteNotificationAction
markAllNotificationsAsReadAction
getNotificationsByFilterAction
```

### Hook de Compteur Global

```typescript
// Hook pour le compteur de notifications non lues
const {unreadCount} = useUnreadNotifications()
```

## Gestion des Erreurs

### Stratégie de Résilience

- Les erreurs d'envoi d'email n'interrompent pas la création de notification
- Logging détaillé pour le debugging
- Validation stricte avec messages d'erreur localisés

### Types d'Erreurs

- `ValidationError` : Données invalides
- `AuthorizationError` : Permissions insuffisantes
- `NotFoundError` : Notification inexistante

## Performance et Cache

### Cache React-Cache

- Cache au niveau DAL pour optimiser les lectures
- Invalidation automatique lors des mutations

### Optimisations

- Pagination des notifications (structure prête)
- Index de base de données sur `userId` et `read`
- Requêtes optimisées avec Drizzle ORM

## Extension du Système

### Ajouter un Nouveau Type de Notification

1. **Définir le type** dans `notification-types.ts`
2. **Ajouter les traductions** dans les fichiers de messages
3. **Créer un template email** si nécessaire
4. **Utiliser** `createTypedNotificationService`

Exemple :

```typescript
// 1. Nouveau type
export const NotificationTypeConst = {
  // ...types existants
  feature_announcement: 'feature_announcement'
} as const

// 2. Traductions (messages/fr.json)
{
  "notifications": {
    "feature_announcement": {
      "title": "Nouvelle fonctionnalité disponible",
      "message": "Découvrez {featureName} dans votre tableau de bord"
    }
  }
}

// 3. Utilisation
await createTypedNotificationService({
  userId: 'user-id',
  type: NotificationTypeConst.feature_announcement,
  metadata: {
    featureName: 'Chat IA'
  }
})
```

## Bonnes Pratiques

### Métadonnées

- Toujours typer les métadonnées selon le type de notification
- Inclure toutes les données nécessaires pour l'affichage et l'email

### Traductions

- Utiliser les clés de traduction conventionnelles
- Passer les variables via les métadonnées

### Performance

- Éviter les notifications en masse sans pagination
- Utiliser les index de base de données appropriés

### Sécurité

- Toujours vérifier les autorisations
- Ne pas exposer d'informations sensibles dans les métadonnées

## Configuration

### Variables d'Environnement

```env
# Email (via Resend)
RESEND_API_KEY=your_resend_api_key

# Better Auth
AUTH_SECRET=your_auth_secret

# Base URL pour les liens dans les emails
NEXT_PUBLIC_APP_URL=https://your-app.com
```

### Paramètres Utilisateur

Les utilisateurs peuvent configurer :

- `enableEmailNotifications` : Activer/désactiver les emails
- `notificationChannel` : Canal préféré (email, in-app, both)

Le système respecte ces préférences tout en garantissant l'envoi des notifications critiques de sécurité.
