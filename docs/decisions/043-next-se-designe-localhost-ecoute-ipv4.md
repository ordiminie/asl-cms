# ADR 043 — Next se désigne `localhost`, et `localhost` se résout en IPv4

- Status: accepted
- Date: 2026-11-04
- Scope: story s49-correctif-proxy-nginx
- Amends: ADR 036, décision 1 (le service n'écoute toujours que sur la machine ; seule la façon de le
  dire change)

## Context

Le premier déploiement de s12b sur le VPS de recette a montré que la page d'accueil de chaque domaine
répond **500** derrière nginx (`docs/research/s49-correctif-proxy-nginx.md`). Le mécanisme, établi dans
le code de Next 16.3.0 et confirmé sur le serveur :

- le middleware de Next remplace tout nom de machine local (`127.x.x.x`, `[::1]`, `localhost`) par
  `localhost` (`server/web/next-url.js`) : la réécriture de next-intl (`/` → `/fr`, locale unique sans
  préfixe, ADR 008) pointe donc vers `localhost` ;
- Next se désigne lui-même par le `-H` qu'on lui passe : avec `-H 127.0.0.1`, il se croit à
  `127.0.0.1`, et à `https://…` dès que nginx envoie `X-Forwarded-Proto: https`
  (`server/lib/router-utils/resolve-routes.js`) ;
- les deux origines diffèrent, la réécriture est jugée **externe** et Next la contacte par le réseau :
  en TLS vers un port HTTP (erreur `EPROTO`, 500), ou en HTTP vers `/fr`, qui redirige en 308 vers `/`.

L'e2e et la CI lancent `next start` **sans `-H`** : Next se désigne alors `localhost`, ce qui masque le
défaut.

Une contrainte du serveur empêche la correction évidente. Sur le VPS, `localhost` se résout en `::1`
**avant** `127.0.0.1` (`getent ahosts localhost`), et Node suit cet ordre (`verbatim`) : `-H localhost`
fait écouter Next en `[::1]:3100` seulement (observé avec `ss`). Or nginx, `ops/rollback.sh` et
l'orchestrateur de déploiement visent `127.0.0.1:3100`.

## Decision

Le service est lancé avec `-H localhost` et l'environnement `NODE_OPTIONS=--dns-result-order=ipv4first` :

```
Environment=NODE_OPTIONS=--dns-result-order=ipv4first
ExecStart=… next start -H localhost -p 3100
```

Next se désigne `localhost`, comme sa réécriture. Avec l'ordre IPv4 d'abord, `localhost` se résout en
`127.0.0.1` : le socket d'écoute reste `127.0.0.1:3100`, et nginx, `rollback.sh` et l'orchestrateur n'ont
pas à changer d'adresse. Le service n'est toujours joignable que depuis la machine.

Le contrat est gardé par un test d'exploitation (`ops/ops-config.test.ts`) : le `-H` du service est le
mot `localhost`, l'ordre IPv4 est posé, et la cible de nginx est l'adresse IPv4 de bouclage.

## Considered options

- **Garder `-H 127.0.0.1`** — rejeté : c'est la cause du défaut.
- **`-H localhost` seul, nginx visant `localhost`** — rejeté : sur ce serveur Next écouterait en IPv6
  seulement. Il faudrait aussi changer la cible de nginx, `LOCAL_URL` de `rollback.sh` et de
  l'orchestrateur, et les tests qui les épinglent ; et rien ne garantit que le serveur de production
  (LWS) ordonne `localhost` de la même façon, ce qui rendrait la configuration dépendante du serveur.
- **`experimental.trustHostHeader`** — rejeté : réglage expérimental de Next, dont la priorité diffère
  selon le fichier (`resolve-routes.js` le lit avant `-H`, `next-server.js` après) et qui impose
  `https://` en dur. Aucune exécution ne le prouve ; il lierait le tenant à l'en-tête `Host` plus
  fortement que l'ADR 036 ne le veut.
- **Retirer `X-Forwarded-Proto` de nginx** — rejeté : l'application perdrait le protocole réel (liens
  magiques, cookies `__Secure-`, ADR 022) pour masquer une erreur de nom d'hôte. Les quatre en-têtes
  écrasés sont une garantie de l'ADR 036.
- **Écouter sur toutes les interfaces (`-H 0.0.0.0` ou `::`)** — rejeté : l'application ne doit pas être
  joignable sans passer par nginx (ADR 036) ; le port 3100 sur la machine de recette est partagé.
- **Éviter la réécriture interne** — rejeté : elle est le fonctionnement normal de next-intl en locale
  unique sans préfixe ; l'écarter rouvrirait l'ADR 008 et tout le routage `[locale]`.

## Consequences

- Plus facile : l'accueil se rend derrière nginx ; aucune adresse de `ops/` ne change.
- Plus difficile : le correctif repose sur un comportement interne de Next (la normalisation en
  `localhost`). À revérifier à chaque montée de version de Next : si Next cesse de normaliser, le test
  de fumée et le contrôle de fin de déploiement (qui exige maintenant un statut 2xx avec les en-têtes de
  nginx) le diront.
- L'ordre IPv4 d'abord s'applique à **toutes** les résolutions de noms du processus (Brevo, Stripe…) :
  sans effet fâcheux sur un VPS à adresse IPv4, à surveiller si l'on ajoute un service joignable
  seulement en IPv6.
- Un serveur déjà installé doit recopier l'unité et la recharger (`daemon-reload`, `restart`) : étape
  ajoutée à la procédure d'exploitation.
- Non prouvé à ce jour de bout en bout : la copie `-H localhost` essayée sur le VPS le 4 novembre
  répondait 200, mais sans `NODE_OPTIONS`. La preuve complète est la recette après redéploiement.
