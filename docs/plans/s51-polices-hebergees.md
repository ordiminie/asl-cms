---
validated: yes
---

# Plan — Story s51-polices-hebergees

Branch: `feature/s51-polices-hebergees` (à créer depuis `main`)

Réf. : `docs/research/s51-polices-hebergees.md`, ADR 046.

## Target story

Servir Public Sans, Source Serif 4 et JetBrains Mono depuis le dépôt (`next/font/local`) au lieu de les
télécharger chez Google au build. Complexité 1, dépend de s12b, sans UI nouvelle.

Critères :

1. Plus d'import `next/font/google` ; trois familles en local, mêmes graisses ; un test échoue si
   l'import réapparaît.
2. Build de production sans accès à `fonts.googleapis.com` / `fonts.gstatic.com`.
3. Aucune page ne charge de ressource Google Fonts (HTML + feuilles de style) — e2e sur une page
   publique et une page du back-office.
4. Rendu inchangé : mêmes familles et mêmes variables CSS, design system intact.
5. Fichiers livrés avec leur licence SIL OFL.

## Décisions de planification (réponses aux questions ouvertes de la recherche)

- **Format** : un fichier `woff2` latin **variable** par famille (3 fichiers) ; la plage de graisse
  déclarée reste celle d'aujourd'hui (`400 700`, `400 700`, `400 500` selon la famille). C'est le fichier
  que Google servait déjà pour ces familles variables ; pas d'italique (le rendu actuel le synthétise).
- **Origine** : fichiers `latin` récupérés depuis l'API CSS2 de Google Fonts (mêmes octets qu'aujourd'hui),
  licence OFL depuis les dépôts officiels des familles ; origine, version et date consignées dans
  `README.md` du dossier de polices.
- **Emplacement** : `src/app/[locale]/fonts/` (le `src` de `next/font/local` est relatif au fichier
  appelant, `base-layout.tsx`).
- **`adjustFontFallback`** : `'Arial'` pour Public Sans, `'Times New Roman'` pour Source Serif 4, `false`
  pour JetBrains Mono (aucune option adaptée à une mono).
- **Critère 2** : prouvé par le test de source (critère 1) et par le job e2e de la CI, plus une assertion
  e2e qu'aucune requête vers ces domaines n'est émise. Pas d'étape CI qui coupe le réseau (hors périmètre).
- **Docs de mécanisme** (`docs/design-system.md` l. 211-229 et 1199, `README.md`) : mises à jour à
  l'identique ailleurs (le nom du loader), sans toucher aux tokens ni aux composants.

## Tasks (ordered)

1. [x] Test d'abord : `src/app/[locale]/fonts.test.ts` — parcourt les `.ts/.tsx` de `src/` et échoue si
   une ligne importe exactement `next/font/google` (pas `@next/third-parties/google`) ; vérifie aussi que
   les trois `woff2` et leurs licences existent. Rouge tant que l'import subsiste.
2. [x] Ajouter le dossier `src/app/[locale]/fonts/` : trois `woff2` latin variables, les fichiers de licence
   OFL de chaque famille, et un `README.md` d'origine ; ajouter `*.woff2 binary` à `.gitattributes`.
3. [x] Adapter `base-layout.test.tsx` : le mock passe de `next/font/google` à `next/font/local` (une
   seule fabrique par défaut renvoyant `{variable: 'font'}`) ; l'assertion `class="font font font …"` est
   conservée. Rouge avant la tâche 4.
4. [x] Modifier `base-layout.tsx` : remplacer l'import et les trois déclarations par `localFont` (`src`,
   `weight`, `display: 'swap'`, `variable` identiques, `adjustFontFallback` ci-dessus). Les tests des
   tâches 1 et 3 passent au vert.
5. [x] E2E `e2e/fonts-hebergees.spec.ts` : sur `/` et sur une page du back-office (même helper de connexion
   que `smoke-authenticated.spec.ts`), le HTML et chaque feuille `/_next/static/` ne contiennent ni
   `fonts.googleapis.com` ni `fonts.gstatic.com`, aucune requête vers ces domaines n'est émise, et
   `document.fonts` contient les trois familles chargées (`status === 'loaded'`).
6. [x] Mettre à jour les mentions du mécanisme dans `docs/design-system.md` (l. 211-229, 1199) et
   `README.md` si elles décrivent `next/font/google`.
7. [x] Vérifications locales ciblées : `pnpm exec vitest run` sur les deux tests, `pnpm lint`, `pnpm
   exec tsc --noEmit`. Le build et l'e2e sont validés par la CI de la PR (jamais en local).

## Files touched

- `src/app/[locale]/base-layout.tsx` (modifié)
- `src/app/[locale]/base-layout.test.tsx` (modifié)
- `src/app/[locale]/fonts.test.ts` (nouveau)
- `src/app/[locale]/fonts/*.woff2`, `*-OFL.txt`, `README.md` (nouveaux)
- `e2e/fonts-hebergees.spec.ts` (nouveau)
- `.gitattributes`, `docs/design-system.md`, `README.md` (mentions)
- `docs/decisions/046-polices-hebergees-avec-le-site.md`, `docs/research/s51-polices-hebergees.md`,
  `docs/plans/s51-polices-hebergees.md` (voyagent avec la branche)

## Test strategy

- **Vitest (node/jsdom)** : garde de source (critère 1, 5) et test du layout adapté (critère 4 côté
  structure). Aucun accès base ni réseau.
- **Playwright** sur le build de production, en CI seulement : critères 2 et 3, et le rendu réel des
  polices. C'est la seule preuve que les chemins `src` sont corrects.
- Vérification visuelle du critère 4 : comparer une page publique avant/après, en regardant les
  décalages de mise en page liés au repli de police.

## Definition of Done

- Une PR, diff lisible, un seul commit de story (`feat:` ou `fix:` au choix de la PR).
- Aucun import `next/font/google` ; tests unitaires verts (`pnpm test --run`) ; lint et types propres.
- Job e2e de la CI vert, sans accès à Google ; aucun changement de token ni de composant.
- Revue passée (`/ks-review s51`, `Ship allowed: yes`) avant `/ks-ship`.
