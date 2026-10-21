# ADR 038 — Un accès fermé est refusé à chaque lecture de la session, par la règle de l'ADR 034

- Status: accepted
- Date: 2026-10-20
- Scope: story s12d-comptes-membres

Complète l'[ADR 034](034-connexion-limitee-a-l-association-du-domaine.md), qui contrôle l'appartenance
à l'**ouverture** d'une session.

## Context

s12d ferme l'accès d'un propriétaire en retirant sa ligne `member` de l'association (ADR 037). Le
critère 5 exige que l'accès soit coupé **à la requête suivante**, même si une session est ouverte.

Ce qui existe :

- l'ADR 034 ne regarde l'appartenance qu'à la création de la session ; une session déjà ouverte
  n'est plus jamais contrôlée ;
- une `session` n'a pas d'association : c'est le cookie, propre à l'hôte, qui la borne à un domaine
  (ADR 022) ;
- `session.cookieCache` (5 min) sert la session de base depuis le cookie signé, mais `customSession`
  relit le compte **et ses appartenances** en base à chaque `getSession` ;
- `getAuthUser()` est le point par lequel passent les pages (`withAuth`), les Server Actions
  (`requireActionAuth`) et les DAL de session.

## Decision

`getAuthUser()` applique, à chaque lecture, la même règle que l'ouverture de session :
**`canOpenSessionOn(user, organisation du domaine appelé)`** (`association-membership.ts`). Un compte
qui ne la satisfait plus est traité comme **non connecté** : `getAuthUser()` rend `undefined`.

Pour l'écran, `withAuth` distingue « aucune session » (vers `/login`) de « session présente mais accès
fermé » : il redirige vers une route de passage `/login/acces-ferme` (Route Handler, patron de
`/login/destination`), qui **ferme cette session** par Better Auth et renvoie un `307` vers
`/login?acces=ferme`, où la page de connexion affiche le message de l'écran D.

## Considered options

- **Supprimer les sessions du compte à la fermeture** — rejeté : une session n'a pas d'association,
  donc on couperait l'accès de la personne **dans ses autres associations** (contre le critère 3) ; et
  `cookieCache` servirait encore la session pendant 5 minutes sans relire la base (contre le
  critère 5).
- **Un contrôle dans le layout `(app)` seulement** — rejeté : les Server Actions de `/account` et toute
  page future hors de ce layout resteraient ouvertes ; l'oubli d'un layout ouvrirait l'accès (l'ADR 034
  rejetait déjà ce contrôle par lieu).
- **Le contrôle dans `customSession`** (rendre une session vide) — rejeté : la fonction ne reçoit pas
  de façon fiable l'hôte de la requête pour tous les appelants, et une session « vide mais présente »
  côté client produirait un état incohérent dans `useSession`.
- **Réduire `cookieCache`** — rejeté : ne résout rien seul (il faudrait toujours un contrôle), et
  coûte une lecture de session en base à chaque requête pour tous.

## Consequences

- Une lecture d'association par requête authentifiée en plus (résolution du domaine, mise en cache
  par `cache()` dans la requête).
- Le SuperAdmin reste accepté partout, comme à l'ouverture.
- Un lien de connexion envoyé avant la fermeture bute sur l'ADR 034 à son ouverture : il donne l'écran
  de lien invalide existant, **pas** le message de l'écran D (l'erreur reste celle d'un compte inconnu,
  ADR 034).
- `getCurrentUserDal` (cache privé du navigateur) peut montrer quelques minutes un contexte périmé
  dans des éléments d'interface ; aucune décision d'accès ni aucune donnée de « Mes parcelles » ne doit
  en dépendre.
- Les tests unitaires qui simulent `getAuthUser` ne voient pas la règle : la coupure se prouve en e2e
  (rechargement réel de la page, pas une navigation cliente servie par `staleTimes`).
