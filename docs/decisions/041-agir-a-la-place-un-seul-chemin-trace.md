# ADR 041 — Agir à la place d'un compte : un seul chemin, tracé, attribué au SuperAdmin

- Status: accepted
- Date: 2026-11-02
- Scope: story s48-connexion-a-la-place

## Context

s48 permet au SuperAdmin d'ouvrir une session à la place d'un compte d'association (arbitrage du
28/10/2026 : le SuperAdmin est le garde-fou de la plateforme). Le plugin `admin()` de Better Auth
1.7.1, déjà monté, fournit `impersonate-user` et `stop-impersonating` ; la colonne
`session.impersonated_by` existe. Trois forces :

- les deux routes HTTP du plugin sont ouvertes (`disabledPaths` ne les ferme pas) : un appel direct
  ouvrirait une session **sans trace** ;
- `getAuthUser()` rend le compte visé : toute écriture de trace (`member_role_event`,
  `incident_report_event`) part sous son nom, ce qui est faux (« la Présidente a transmis la
  présidence ») ;
- le plugin ne refuse pas, à lui seul, le changement de mot de passe, de 2FA ou d'email du compte
  visé : ces refus sont aujourd'hui seulement incidents (mot de passe inconnu, drapeau d'email fermé).

## Decision

1. **Un seul chemin d'ouverture et de sortie** : les routes HTTP `/admin/impersonate-user` et
   `/admin/stop-impersonating` sont fermées (`disabledPaths`, patron du lien magique). Seul un service
   (`impersonation-service`) appelle `auth.api.impersonateUser` / `stopImpersonating` avec
   `headers: await headers()`, puis écrit la trace dans la même requête. Un appel HTTP direct rend 404.
2. **Une table de trace dédiée** `impersonation_event` (une ligne par ouverture, une par sortie
   explicite), scopée par `organization_id`, RLS forcée, noms copiés, clés en `SET NULL`.
3. **Attribution par construction** : un lecteur unique (`getActingContext`) expose le compte vu et
   l'imitateur (`session.impersonatedBy`) ; un helper de trace rend l'auteur effectif (le SuperAdmin) et
   le « pour le compte de » (le compte visé). `member_role_event` et `incident_report_event` reçoivent
   deux colonnes nullables `on_behalf_of_user_id` / `on_behalf_of_name`. L'**autorisation** continue
   de voir le compte visé : seule la trace change d'auteur.
4. **Refus explicite des écritures sensibles** : un plugin local `impersonationGuard()` (hook `before`)
   refuse `change-password`, `change-email`, `two-factor/*`, `delete-user`, `link-social`,
   `unlink-account` tant que `session.impersonatedBy` est posé. Les sections correspondantes de
   `/account` sont remplacées par une note.
5. **Limites assumées** : la fin par expiration et la déconnexion pendant la session ne sont pas
   tracées (aucun événement Better Auth ne les signale) ; les colonnes `updated_by` des réglages, de
   l'accueil, du bandeau, de la navigation et des actualités enregistrent le compte visé. Le critère 6
   ne les exige pas (« au minimum »).

## Considered options

- Garder les routes HTTP ouvertes et tracer dans un hook `after` — rejeté : la trace dépendrait d'un
  hook qui doit retrouver l'association depuis l'hôte, et le chargement de la façade depuis `auth.ts`
  recrée le cycle d'imports déjà gardé par `magic-link-integration-imports.test.ts`.
- Laisser les traces sous le nom du compte visé — rejeté : fausse l'historique, c'est le piège que la
  story existe pour éviter.
- Remplacer l'auteur par le SuperAdmin sans colonne « pour le compte de » — rejeté : on perdrait
  pour qui il a agi.
- Une ligne par session (`started_at` / `ended_at`) — rejeté : l'expiration n'écrit jamais `ended_at`,
  la ligne resterait ouverte indéfiniment ; deux événements sont plus honnêtes.

## Consequences

- Plus facile : l'audit lit une table et deux colonnes ; aucun chemin silencieux.
- Plus difficile : tout nouvel écrivain de trace doit passer par le helper d'auteur effectif (un
  oubli écrit le compte visé). Les routes `/admin/*` restantes du plugin (`set-role`, `ban-user`…)
  restent ouvertes au SuperAdmin : hors périmètre.
- À surveiller : si `allowImpersonatingAdmins` ou `adminUserIds` étaient réglés un jour, les tests
  « pas d'imitation d'un SuperAdmin » et « pas d'enchaînement » doivent échouer.
- s38 exportera `impersonation_event` ou la déclarera exclue, avec son motif.
