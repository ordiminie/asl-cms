# ADR 017 — Resend conservé comme transport de secours derrière `EmailTransport`

- Status: accepted
- Date: 2026-09-19
- Scope: story s03-connexion-lien-magique
- Amends: ADR 005 (sur un seul point : « Resend est retiré avec le nettoyage de l'ADR 009 »)

## Context

L'ADR 005 introduit un contrat d'envoi maison, `EmailTransport`, avec une implémentation Brevo, et prévoit le retrait
de Resend. Il écarte en revanche « deux chemins séparés — transactionnel chez l'un, campagnes chez l'autre » pour la V1,
en laissant la porte ouverte « si la délivrabilité transactionnelle de Brevo décevait ».

s03 pose le contrat. En le faisant, le retrait de Resend s'avère être le seul travail qui ne sert pas la story : retirer
la dépendance, la clé du schéma d'environnement, de `env.example`, du script d'initialisation et de trois workflows —
alors que, derrière le contrat, Resend n'est plus qu'une implémentation parmi d'autres, sans aucun appel direct depuis
le code métier.

## Decision

**Resend est conservé comme implémentation de `EmailTransport`, à côté de Brevo**, choisie comme les autres par la
variable `EMAIL_TRANSPORT` (`brevo`, `resend`, `file`, `memory`).

- **Brevo reste le transport de production** (décision client, PRD, ADR 005). Resend est un **secours**, activable par
  configuration, sans modification de code.
- `RESEND_API_KEY` devient **facultative** : exigée seulement quand `EMAIL_TRANSPORT=resend`, comme `BREVO_API_KEY`
  l'est pour `brevo`.
- **Aucun code métier n'appelle Resend** : le SDK n'est importé que par son adaptateur. Un appel direct à un fournisseur
  reste un défaut de revue.
- Tout le reste de l'ADR 005 est inchangé : un seul contrat, un seul point d'envoi, Brevo en production.

## Considered options

- **Retirer Resend (lettre de l'ADR 005)** — rejeté : travail sans valeur pour s03, et perte d'une bascule immédiate
  vers un second fournisseur si Brevo déçoit (délivrabilité, incident de compte), cas que l'ADR 005 prévoyait lui-même
  de rouvrir.
- **Garder Resend appelé directement, à côté du contrat** — rejeté : deux chemins d'envoi, précisément ce que le contrat
  supprime.
- **Répartir les envois entre les deux fournisseurs (transactionnel chez l'un, campagnes chez l'autre)** — toujours
  rejeté pour la V1, pour les raisons de l'ADR 005 : deux quotas à réconcilier, budget quotidien impossible à tenir.
  Cet ADR ne l'autorise pas : un seul transport est actif à la fois.

## Consequences

**Ce qui devient plus simple**

- s03 ne touche ni aux workflows ni au script d'initialisation pour retirer Resend.
- Basculer de fournisseur en cas d'incident est un changement de variable, pas un déploiement de code.

**Ce qui devient plus difficile**

- Un adaptateur de plus à maintenir et à tester.
- **Le budget quotidien (s26) est celui du compte Brevo** (300 envois par jour). S'il fallait envoyer par Resend, le
  décompte ne correspondrait plus au plafond réel : s26 doit rattacher le budget au transport actif, ou documenter que
  le secours Resend suspend la garantie du plafond.

**À surveiller**

- La dépendance `resend` reste dans `package.json` : la tenir à jour comme les autres.
- La documentation du boilerplate (`src/app/[locale]/docs/…`) décrit encore Resend comme fournisseur principal ; elle
  n'est pas le cadre du produit.
