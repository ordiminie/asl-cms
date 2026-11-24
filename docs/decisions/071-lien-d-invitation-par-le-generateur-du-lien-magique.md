# ADR 071 — Le lien d'invitation naît du générateur du lien magique, appelé sans requête, puis prolongé

- Status: accepted
- Date: 2026-11-24
- Scope: story s42a-invitation-individuelle
- Complète : ADR 022 (origine de l'association lue en base), ADR 034 (contrôle unique d'ouverture de
  session), ADR 053 (budget quotidien et report), ADR 056 §6 (lien secret d'un email reporté)

## Context

s42a envoie une invitation à chaque adresse active d'une fiche, avec un lien de connexion propre. La story
interdit une seconde implémentation du lien : le seul générateur est l'endpoint Better Auth
`signInMagicLink` (plugin `magic-link` 1.7.1), dont la route HTTP est fermée et qui appelle notre
`sendMagicLink`. Or, tel quel, ce chemin ne convient pas à une invitation :

- il déduit l'association de **l'hôte de la requête**, alors que s42b générera ces liens depuis la livraison
  d'une part de campagne, et que l'invitation reportée de s42a est rejouée par le planificateur : **hors de
  toute requête** ;
- il consomme le **quota par adresse** de la demande anonyme (3 par jour) ;
- il **ne rend rien** à l'appelant (`{status: true}` quoi qu'il arrive), qui doit pourtant savoir si l'email
  est parti, reporté ou refusé, et écrire « invitée le » ;
- sa durée est **globale** (`expiresIn`, 20 minutes) : arbitrage du 24/11/2026, une invitation vaut une
  durée propre, paramètre de tenant (seed 7 jours).

## Decision

1. **Un seul générateur.** Le service d'invitation appelle `auth.api.signInMagicLink` avec des **en-têtes
   construits** (`Host` = domaine de l'association, lu en base) et **sans `Request`** : le middleware
   `formCsrfMiddleware` du plugin ne contrôle rien sans `ctx.request`. `body.metadata.invitation` porte
   l'association (identifiant) et un **canal de retour en mémoire** (fonction appelée avec l'URL et le
   jeton). Ce canal n'est jamais sérialisé : la route HTTP reste fermée (`MAGIC_LINK_DISABLED_HTTP_PATHS`),
   seul le code serveur peut le fournir.
2. **Branche « invitation » de `sendMagicLink`** : l'association vient de `metadata.invitation` (jamais de
   l'hôte, jamais du navigateur), le quota de la demande anonyme n'est pas consommé, le contrôle
   `canOpenSessionOn` reste celui de la connexion, les liens précédents de l'adresse sont révoqués
   (`revokeEarlierMagicLinks`, critère de réinvitation), la ligne `verification` du jeton est **prolongée**
   par l'adaptateur du contexte (`expiresAt = maintenant + durée du tenant`), l'URL est rebasée sur
   l'origine de l'association, puis remise au canal de retour. **Elle n'envoie rien** : l'envoi, la trace et
   le report appartiennent au service d'invitation.
3. **Lien d'erreur propre** : `errorCallbackURL` d'une invitation porte un motif, pour que la page
   `/login/lien-invalide` explique la durée de l'invitation et non les 20 minutes.
4. **Report** (ADR 053) : nature d'envoi `invitation`, reportable. L'email conservé ne contient **jamais**
   le lien (marque à sa place, patron de l'ADR 056 §6) ; le jeton émis pour l'envoi refusé est révoqué ;
   le rejeu, sans requête, régénère un lien neuf par le même générateur, puis écrit la trace.

## Considered options

- **Créer la ligne `verification` nous-mêmes** (`internalAdapter.createVerificationValue`, même format) —
  rejeté : c'est la seconde génération de lien que la story interdit, et elle dépendrait du format interne
  du plugin pour le jeton comme pour l'URL.
- **Un second plugin `magicLink` à durée longue** — rejeté : deux plugins de même identifiant et de mêmes
  chemins ; le second écraserait le premier.
- **Allonger la durée globale** — rejeté : le lien demandé garde 20 minutes (PRD, §7 du design system).
- **Garder 20 minutes pour l'invitation** — rejeté par l'arbitrage du 24/11/2026 (public âgé, email lu
  plus tard).
- **Plugin d'organisation de Better Auth** — rejeté (notes de s46) : lien sur `NEXT_PUBLIC_APP_URL`, écran
  d'acceptation retiré, il crée la ligne `member` déjà posée par s12d.
- **Lire l'issue de l'envoi après coup** (trace ou file de report relues par l'appelant) — rejeté : une
  course entre deux clics, et une lecture de plus pour une information que le chemin connaît déjà.

## Consequences

- `sendMagicLink` gagne une branche, sans changer le chemin de la demande (tests existants inchangés).
- Le canal de retour dépend de ce que le plugin transmet `body.metadata` tel quel (`z.record(z.string(),
z.any())`) : un test sur le vrai Better Auth le prouve, et cassera à une montée de version qui le
  sérialiserait.
- La durée est lue au moment de la génération : changer le réglage vaut pour l'invitation suivante.
- s42b réutilise ce générateur depuis la livraison d'une part, sans rien réimplémenter.
