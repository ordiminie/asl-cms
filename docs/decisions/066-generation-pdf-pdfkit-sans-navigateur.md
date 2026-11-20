# ADR 066 — Génération PDF par pdfkit, sans navigateur

- Status: accepted
- Date: 2026-11-20
- Scope: story s28-publipostage-pdf

## Context

s28 est la première génération de PDF du produit (les autres PDF sont déposés ou redirigés). Le VPS
cible (LWS, 2 vCore / 4 Go, ADR 036) porte l'application, Postgres et nginx sur une seule machine. Le
lot réel est d'environ 100 lettres d'une page. Le critère 4 impose un bloc adresse placé au millimètre
et **vérifié par un test sur les coordonnées dans le PDF généré**.

## Decision

1. Moteur : **`pdfkit`** (pur JavaScript, polices via fontkit), dans un module serveur
   `src/lib/letters/`. Chaque élément est placé par coordonnées explicites (points PDF, convertis
   depuis les millimètres du gabarit §6.1) : la géométrie est du code testable, pas une feuille de
   style.
2. Le corps Markdown est rendu par l'arbre `mdast` de `remark` (déjà installé) avec le **schéma
   restreint du CMS**, en blocs simples (paragraphe, titres 2 et 3, listes, citation en cadre 1 pt) ;
   les variables sont remplacées **dans les nœuds texte**, après l'analyse, pour qu'une valeur ne soit
   jamais lue comme du Markdown (même garantie que `renderCampaignBodyHtml`). Un lien s'imprime en
   clair (« texte (adresse) »), comme la version texte de l'email.
3. Polices : celles du site (Public Sans, Source Serif 4) depuis les fichiers déjà hébergés (ADR 046),
   embarquées dans le PDF ; si fontkit refuse le woff2, un TTF dans `src/assets/fonts/` (précédent :
   `SourceSerif4-SemiBold.ttf`).
4. Test des coordonnées : **`pdfjs-dist`** en dépendance de **développement** seulement, qui relit le
   PDF produit (`getTextContent()` → matrice de transformation de chaque texte) dans un test Vitest
   `node`.
5. Le PDF est produit à la demande, en mémoire, jamais stocké (`Cache-Control: no-store`) : il porte
   des noms et des domiciles.

## Considered options

- **Navigateur headless** (Chromium via Playwright ou Puppeteer, HTML → PDF) — rejeté : 300 à 500 Mo par
  instance sur une machine de 4 Go partagée avec Postgres, un binaire et des bibliothèques système à
  installer sur le VPS ; c'est le risque mémoire que la story demandait de vérifier.
- **`@react-pdf/renderer`** — rejeté : mise en page par flexbox (yoga-layout en wasm) où la position
  exacte du bloc adresse est un résultat de mise en page plutôt qu'une donnée ; plus lourd, et la
  composition React n'apporte rien à un gabarit fixe d'une page.
- **`pdf-lib`** — rejeté : aucun retour à la ligne ni mise en page de texte ; il faudrait réécrire la
  coupure des paragraphes à la main.
- **Service externe de génération** — rejeté : les domiciles des membres quitteraient le serveur.

## Consequences

- Deux dépendances : `pdfkit` (+ ses types) en production, `pdfjs-dist` en développement.
- Sous Next 16, `pdfkit` lit ses métriques de police sur le disque : le module est déclaré dans
  `serverExternalPackages` si le bundler le casse (à vérifier dans `node_modules/next/dist/docs/`).
- s36 (modèles de documents) pourra réutiliser le module et sa géométrie.
