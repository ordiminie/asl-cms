# Service d'Email — contrat `EmailTransport` et React Email

## Principe

**Tout email du produit part par le contrat `EmailTransport`** (ADR 005, ADR 017), jamais par un
fournisseur appelé directement. Les gabarits sont écrits avec [React Email](https://react.email).

- **Brevo** est le transport de **production** (API REST, sans SDK).
- **Resend** est conservé comme transport de **secours**, activable par configuration (ADR 017).
- `file` (boîte de sortie JSON) sert le développement, la CI et les e2e ; `memory` les tests unitaires.

⚠️ **Aucun code métier n'importe un SDK de fournisseur.** `resend` n'est importé que par son
adaptateur, `src/lib/emails/transport/resend-transport.ts` — un test le vérifie
(`provider-imports.test.ts`). Un appel direct à un fournisseur est un défaut de revue.

## Le contrat

`src/lib/emails/transport/` :

```ts
export type EmailMessage = {
  from: string // `adresse` ou `Nom <adresse>`
  to: string
  subject: string
  html?: string
  text: string // toujours fournie (design system §5)
}

export type EmailTransport = {send: (message: EmailMessage) => Promise<void>}
```

Un échec d'envoi lève une `EmailTransportError` (reconnue par `isEmailTransportError`), quel que
soit le fournisseur : l'appelant décide de l'état à afficher, jamais de relancer ailleurs.

`getEmailTransport()` choisit l'implémentation selon `EMAIL_TRANSPORT` (`@/env`) :

| `EMAIL_TRANSPORT` | Variable exigée  | Défaut                                  |
| ----------------- | ---------------- | --------------------------------------- |
| `brevo`           | `BREVO_API_KEY`  | à déclarer en production                |
| `resend`          | `RESEND_API_KEY` | —                                       |
| `file`            | —                | hors production ; `EMAIL_OUTBOX_DIR`    |
| `memory`          | —                | —                                       |

## Structure des gabarits

Les gabarits sont dans `src/lib/emails/` et utilisent les composants de `react-email`. Règles du
médium : design system §5 — 600 px, tables, styles en ligne, **couleurs hexadécimales importées de
`src/lib/emails/theme.ts`** (jamais retapées dans un gabarit, jamais d'OKLCH ni de variable CSS),
un bouton en table toujours doublé de l'URL en clair.

Exemple : [magic-link-email.tsx](src/lib/emails/magic-link-email.tsx).

## Service d'envoi

Le point d'envoi unique est `sendEmailService` dans [email-service.ts](src/services/email-service.ts) :
il rend le gabarit (`react`, élément ou promesse d'élément) en HTML et confie le message au
transport actif.

```tsx
await sendEmailService(
  {
    to: email,
    subject: t('subject', values),
    text: versionTexte, // obligatoire
    react: MonGabarit({...props}),
  },
  {recipientType: 'system'}
)
```

## Bonnes Pratiques

1. **Gabarits React Email**
   - Utiliser les composants de `react-email`
   - Couleurs de `theme.ts` uniquement
   - Définir un type TypeScript pour les props
   - Toujours écrire la version texte (`text`)

2. **Service d'envoi**
   - Passer par `sendEmailService` (ou un `send…EmailService` qui l'appelle), jamais par un transport
     depuis le code métier
   - Laisser remonter `EmailTransportError` jusqu'à l'appelant qui choisit l'état à afficher
   - Les sujets sont préfixés `[DEV]` en développement

3. **Sécurité**
   - Ne jamais journaliser une URL de connexion ni un jeton
   - Les clés des fournisseurs vivent dans `@/env`, jamais dans le code
   - Valider les entrées avant l'envoi
