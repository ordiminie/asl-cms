# Revue du découpage en stories — ASL-CMS (Lp)

> Revue en contexte neuf de `docs/stories.md` face à `docs/prd.md`, par le subagent
> `stories-reviewer` (skill `stories-review` préchargée).
>
> **Seizième passage — passage de confirmation.** Le quinzième avait rendu `minor / yes` pour les
> 43 stories après le retrait de `s00` ; ses huit minors (G-01 à G-08) ont été corrigés. Objet de ce
> passage : vérifier que ces correctifs n'ont rien cassé — les quatre passages précédents ayant
> montré qu'une correction peut introduire un défaut.

## Perimeter coverage

Les 37 lignes du tronc commun et les 3 modules activables ont été re-parcourus **depuis le tableau du
PRD**, pas depuis les stories. **40/40 couverts, aucun trou** — les huit correctifs n'ont rien fait
perdre.

## Scope

- [x] Cimetière étanche. Aucune story ne réintroduit électricité/gaz, logique de vote
      (dépouillement, quorum, procurations), traitement de paiement, messagerie privée,
      multi-immeubles, plan B de connexion, appels de fonds/tantièmes, carte interactive, vote temps
      réel, IA conversationnelle ou de classification, Kanban, messagerie dédiée, base par tenant,
      abstraction « ressource partagée », WordPress. Dix stories portent une clause « Cimetière »
      explicite.
- [x] Aucune story ne dépasse le périmètre, hors la dérogation déclarée et bornée de s39.

## Les cinq points de vérification

**1) Les deux arêtes ajoutées — vérifiées, saines.**

- Corps s19 (`s02, s12`) = récapitulatif ; corps s42 (`s03, s13, s15, s25, s26, s27, s28`) =
  récapitulatif. **Corps et récapitulatif concordent pour les deux.**
- Graphe complet reconstruit sur les 43 stories : **toute dépendance pointe vers un id strictement
  antérieur** (s04b s'insérant entre s04 et s05). **Aucun cycle, aucune référence en avant** — la
  propriété est structurelle, pas seulement locale.
- Justifications tenues : s19 c4 consomme bien le registre de paramètres de s02, et s19 n'y avait
  **aucun chemin transitif** auparavant (s12 → s01, sans s02) — l'arête est nécessaire, pas
  décorative. s42 c3 consomme la nature statutaire introduite par s27 c7 : nécessaire aussi, et elle
  supprime une référence en avant réelle.
- Aucune dépendance déclarée ailleurs ne devient **fausse**. Deux deviennent redondantes par
  transitivité (s21 → s02, s29 → s02, désormais joignables via s19), mais la redondance est la
  convention du document — s23 déclare s02 alors que s10 le déclare déjà.

**2) s35 c6 face à s33 / s34 — pas de recouvrement, pas de contradiction.** Chaque story teste la
désactivation de **son** module ; s35 c6 est scopé « dans l'espace membre » (cohérent : les annonces
sont réservées aux connectés), s34 c4 vise la navigation publique (cohérent : la voirie a une page
publique). Aucune ne réclame le travail de l'autre.

**3) Règle « Socle habillé » — cohérente avec le pipeline.** Faire vérifier un état d'entrée par
`/ks-research` est exactement son rôle, et le document emploie déjà cet idiome trois fois (s17, s20,
s33). Aucun critère d'acceptation ni livrable n'est ajouté à s01 : ce n'est pas une story déguisée.

**4) La note de s02 est vraie, vérifiée dans le dépôt.** `--accent-hue` : **0 occurrence dans `src/`**.
`globals.css` ne porte que les tokens du boilerplate. La formulation « en place **à l'issue du travail
de socle** — ils n'y sont pas dans le dépôt tel quel » est exacte. Corollaire : les deux greps de la
règle transverse sont factuels et discriminants — `grep -rl 'dark:' src/` renvoie **34 fichiers /
125 occurrences** et `grep -rl 'next-themes' src/` **8 fichiers**, chiffres identiques au tableau
mesuré de `docs/adaptation-socle-design-system.md`. Le garde-fou attraperait bien un socle non fait.

**5) Réécritures — recomptées à la main.** `docs/adaptation-socle-design-system.md` existe, le
pointeur n'est plus pendant. « Trois écarts avec les scores du PRD » : s04 (4 vs 3), s27 (3 vs 2),
s38 (4 vs 3) — **exactement trois**. « se paie sur 42 stories » : 43 − s01 = 42 ✔. « les
trente-quatre stories intermédiaires » : s04, s04b, puis s05→s36 = 34 ✔. « les 42 stories
précédentes » : s01→s41 + s04b = 42 ✔. Recomptés au passage : 43 stories, répartition
3 + 18 + 14 + 8 = 43 ✔ ; s38 « vingt-cinq dépendances » et son arithmétique 27 − 3 + 1 = 25 ✔ ; les
huit stories à 4 portent chacune leur paragraphe « Risque (complexité 4) » ✔.

## Findings

**H-01 — minor — s33 : seul des trois modules à ne pas porter la clause du point d'entrée.**
Son critère de désactivation dit « ni la page de vote ni les résolutions n'existent, et le reste du
site est intact », sans clause sur le point d'entrée, alors que le vote s'atteint « depuis son espace »
(c2). s34 c4 et s35 c6 énoncent tous deux la clause « aucune navigation / aucun point d'entrée n'y
renvoie » qu'exige le PRD (« un module désactivé ne doit laisser aucune entrée de menu morte »).
L'asymétrie est antérieure au correctif G-08, mais celui-ci l'a élargie : s33 est désormais le seul
des trois à ne pas la porter. Non bloquant, testable en l'état — mais c'est le module qui a le plus de
chances d'être désactivé (réserve ASL Community).

**H-02 — minor — s20 : même raisonnement que l'arête ajoutée à s19, non appliqué.**
Le critère 1 (« s'active par **configuration de tenant** ») consomme le registre de s02 mais ne déclare
que `s19`. Ici s02 est joignable transitivement (s20 → s19 → s02), donc **rien n'est inexécutable** —
c'est une inconsistance de convention, pas une arête manquante au sens fort. Même famille : s33 et s35
s'appuient sur l'activation de module de s01 par transitivité là où s34 la déclare explicitement.

**H-03 — minor (cosmétique) — règles transverses : une instruction propre à s01 dans un bloc qui se dit universel.**
Le bloc est introduit par « Ces contraintes valent pour **chaque** story » et contient désormais une
instruction ne concernant que **s01** (les deux greps d'état d'entrée). Le contenu est juste et
vérifié ; c'est son emplacement qui détonne — il tiendrait aussi bien dans les notes agentiques de
s01. Aucune conséquence sur l'exécution.

## Conclusion

**Les huit correctifs G-01 à G-08 n'ont rien cassé.** Les deux arêtes ajoutées sont nécessaires,
cohérentes entre corps et récapitulatif, et laissent le graphe acyclique et exécutable de haut en bas ;
les quatre réécritures sont exactes au chiffre près, y compris les 125 occurrences `dark:` recomptées ;
la note de s02 dit désormais la vérité du dépôt. Les trois minors ci-dessus sont des inconsistances de
rédaction, dont une seule (H-01) a été marginalement aggravée par un correctif — aucune n'empêche
d'exécuter le découpage.

Max severity: minor
Stories ready: yes
