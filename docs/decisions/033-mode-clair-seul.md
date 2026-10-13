# ADR 033 — Le produit ne s'affiche qu'en clair : thème forcé, pas retiré

- Status: accepted
- Date: 2026-10-13
- Scope: story s45-retrait-pages-publiques-heritees

Remplace l'[ADR 012](012-mode-sombre-conserve.md) (« le mode sombre est conservé »).

## Context

L'ADR 012 (9 septembre 2026) a conservé le mode sombre : le retirer « pour de bon » traversait la base
(enum `theme_type`, colonne `user.theme`, SQL brut du seed), le proxy, 125 classes `dark:` et trois
règles, pour un socle dont aucun écran ASL-CMS n'existait encore.

Le 7 octobre 2026, après la revue du découpage, l'utilisatrice a arbitré : **le produit ne s'affiche
plus qu'en clair**, sans sélecteur de thème. Les écrans d'ASL-CMS sont maintenant dessinés (s02 à s44)
en clair seul, et les designs de s44 à s47 le disent. Une version sombre non dessinée et non testée
serait servie à tout visiteur dont le navigateur est réglé en sombre.

Le coût qui avait fait rejeter le retrait en septembre n'a pas changé : il traverse la base. Ce qui a
changé, c'est la valeur de le payer maintenant — aucune.

## Decision

**Le thème clair est forcé au niveau de `next-themes`** (`forcedTheme="light"`, `enableSystem` retiré),
et **tout ce qui permet d'en choisir un autre est retiré de l'interface** : sélecteur de l'en-tête
public, bascules des menus utilisateur, champ « apparence » des réglages de compte, synchronisation de
la préférence enregistrée.

**Rien n'est retiré en dessous** : l'enum `theme_type`, la colonne `user.theme`, le bloc `.dark` de
`globals.css` et les classes `dark:` restent. Ils ne s'appliquent plus, puisque la classe `dark`
n'est jamais posée sur `<html>`. Aucune migration.

Le proxy cesse de calculer le thème : l'en-tête `x-theme` (seul lecteur : la documentation retirée par
s45) et le cookie `theme` (seul lecteur : le proxy lui-même) disparaissent.

Les **emails** gardent leurs jumelles sombres (`prefers-color-scheme`) : un courriel est lu dans le
client de messagerie du destinataire, qui impose son propre mode, et non dans le produit.

## Considered options

- **Retirer le mode sombre pour de bon** (enum, colonne, `.dark`, 125 classes `dark:`, SQL du seed) —
  rejeté : migration et réécriture du seed dont dépend toute la suite e2e, pour un résultat qu'aucun
  utilisateur ne voit de plus que le thème forcé.
- **Masquer le sélecteur seulement** — rejeté : c'est le « retrait à moitié » que l'ADR 012 écartait.
  Un navigateur en mode sombre et `enableSystem` actif continueraient de recevoir la classe `dark` par
  les préférences du système, avec des pages jamais dessinées en sombre.
- **Conserver le mode sombre** (ADR 012) — rejeté : arbitrage du 7 octobre ; chaque nouvel écran
  devrait être dessiné, vérifié et testé deux fois pour un usage que l'association n'a pas demandé.

## Consequences

- **Voie de retour** : `git revert` du commit de s45 rend le sélecteur et la synchronisation ; comme
  l'enum, la colonne, `.dark` et les `dark:` n'ont pas bougé, le mode sombre redevient exactement ce
  qu'il était. Rétablir l'ADR 012 suffirait à l'écrire.
- **Dette assumée et inerte** : ~125 classes `dark:` et un bloc `.dark` jamais appliqués. Un futur
  retrait propre est possible sans rien casser ; il n'est pas urgent.
- Le choix enregistré en base (`user.theme`) n'est plus lu ni proposé. Sa valeur par défaut
  `system` n'a plus de sens ; elle reste.
- Le design system (§1, §10) et la règle de rendu de contenu cessent de demander de vérifier « en
  clair et en sombre ».
- Tout nouvel écran se vérifie en clair seul. Un navigateur réglé en sombre doit voir la même chose :
  l'e2e de s45 le garde.
