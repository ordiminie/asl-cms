# ADR 046 — Polices hébergées avec le site (`next/font/local`)

- Status: accepted
- Date: 2026-11-06
- Scope: story s51-polices-hebergees

## Context

`next build` téléchargeait Public Sans, Source Serif 4 et JetBrains Mono chez Google
(`next/font/google`). Le 5 novembre 2026, ce téléchargement a échoué deux fois : un déploiement sur le
VPS (version en service intacte) et trois jobs e2e de la CI de la PR #54, ce qui bloque la CI de toute
PR tant que Google ne répond pas. Une dépendance réseau au build pour trois fichiers statiques n'a pas de
raison d'être.

## Decision

Les trois familles sont livrées dans le dépôt, au format `woff2` latin, avec leur licence SIL OFL, et
chargées par `next/font/local`. Les variables CSS (`--font-public-sans`, `--font-source-serif`,
`--font-jetbrains-mono`) sont conservées : `globals.css` et le design system ne changent pas. Un test
unitaire échoue si `next/font/google` réapparaît dans `src/`.

## Considered options

- Garder `next/font/google` et relancer la CI en cas d'échec — rejeté : l'échec dépend de la
  disponibilité de Google, pas du code ; il bloque toutes les PR et un déploiement.
- Paquets `@fontsource/*` — rejeté : ajoute trois dépendances pour des fichiers que le dépôt peut
  porter lui-même, et le brief interdit tout changement de dépendance hors besoin.
- Pile de polices système, sans fichier — rejeté : change le rendu, donc le design system.

## Consequences

Le build ne dépend plus d'aucun domaine tiers pour les polices, et les pages n'en chargent plus
(RGPD : plus de requête vers Google depuis le navigateur du visiteur). Le dépôt grossit de quelques
centaines de Ko de binaires. Une montée de version d'une police devient une opération manuelle,
consignée dans le fichier d'origine à côté des licences.
