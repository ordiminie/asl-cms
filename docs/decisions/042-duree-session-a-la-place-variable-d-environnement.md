# ADR 042 — La durée d'une session à la place d'un compte vit dans `@/env`

- Status: accepted
- Date: 2026-11-02
- Scope: story s48-connexion-a-la-place

## Context

Le critère 7 de s48 veut une durée « paramétrée, pas en dur ». Le plugin `admin()` lit
`impersonationSessionDuration` **une fois**, à la construction (défaut 3600 s). Un réglage lu en base
à chaque ouverture imposerait de corriger `session.expires_at` après coup, hors de Better Auth. Par
ailleurs l'ADR 010 réserve aux paramètres d'association les valeurs qui varient d'une association ;
cette durée est une règle de **plateforme**, pas d'association.

## Decision

La durée est la variable validée `IMPERSONATION_SESSION_DURATION_SECONDS` de `@/env` (serveur,
entier positif, défaut 1800 s, bornée à 3600 s), passée à `impersonationSessionDuration`. La bannière
affiche l'heure de fin lue sur `session.expiresAt` ; aucune durée n'est écrite dans un composant.

## Considered options

- `organization_setting` — rejeté : éditable par le bureau, qui n'a pas à régler le garde-fou qui
  s'exerce sur lui.
- `app_settings` (écran `/admin/settings`) — rejeté : suit l'ancien modèle (type et catégorie en base,
  pas de registre typé) et exige de réécrire `expires_at` après création.
- Constante dans le code — rejeté : c'est le « en dur » que le critère interdit.

## Consequences

- Plus facile : une option native du plugin, aucun contournement, testable avec la valeur de l'env.
- Plus difficile : changer la durée demande un redémarrage ; acceptable pour un réglage rare, posé
  par le prestataire.
- La valeur par défaut est de 30 minutes, alignée sur la maquette et sur le design system (§2.6,
  expiration à 30 minutes).
