# ADR 078 — Menu public : une entrée vise une page **ou** une adresse, contrainte en base ; adresse en liste blanche, validée à l'écriture et au rendu

- Status: accepted
- Date: 2026-11-27
- Scope: story s50-navigation-liens-libres

Complète l'[ADR 021](021-navigation-menu-item-et-pied-de-page.md) (qui reste valable : table `menu_item`
scopée directement, pied de page dans `organization_setting`). Seule change la **cible** d'une entrée.

## Context

L'ADR 021 a posé `menu_item` avec une seule cible : `page_id` (NOT NULL, FK `page`, cascade). Le texte
affiché est le titre de la page. s50 demande une entrée « libellé + adresse », vers un chemin du site
(`/contact`, `/actualites` — routes fixes qu'aucune page du CMS ne représente) ou vers un autre site en
`https://`. Le critère 4 veut que les entrées de page existantes restent inchangées et qu'une entrée ne
vise **jamais à la fois** une page et une adresse, **en base**. Les notes agentiques imposent une **liste
blanche** et la **même validation à l'écriture et au rendu** : une adresse déjà en base ne doit jamais
produire un `href` dangereux.

Trois forces :

- le menu se lit en une requête ordonnée par `rank` (ADR 021) : les deux types d'entrée partagent un seul
  ordre, une seule visibilité, les mêmes gestes (retirer, réordonner, masquer) ;
- le parseur d'URL des navigateurs est permissif (`/\hôte` et `\\hôte` lus comme `//hôte`, espaces et
  contrôles retirés en tête, `https:/hôte` complété en `https://hôte/`) : une règle « commence par `/` »
  ou « n'est pas `javascript:` » laisse passer des adresses qui quittent le site ou exécutent du code ;
- arbitrages de l'utilisatrice (27/11/2026) : une entrée de page garde le titre de sa page ; modifier une
  entrée ne change jamais son type.

## Decision

1. **Même table, deux colonnes facultatives.** `menu_item.page_id` devient facultatif (FK et cascade
   inchangées) ; deux colonnes `label` (`text`) et `address` (`text`), nulles pour une entrée de page.
   Une contrainte `CHECK` nommée `menu_item_page_xor_address_check` :
   `(page_id is not null and label is null and address is null) or (page_id is null and label is not null
and address is not null)`. Elle est déclarée par `check()` dans le modèle et **générée** par
   `pnpm db:generate` (précédent `0069`, s19) ; les lignes existantes la satisfont d'office. La policy RLS
   forcée (`0015`) porte sur `organization_id` seul : rien à y changer. La contrainte unique
   `(organization_id, page_id)` laisse passer plusieurs entrées libres (Postgres traite les `NULL` comme
   distincts).
2. **Liste blanche, un seul prédicat pur** — `classifyLinkAddress` dans `src/lib/helper/link-address.ts`
   (isomorphe : formulaire client, Server Action, service à l'écriture, service au rendu sous `'use
cache'`). Après `trim()`, une adresse est acceptée si et seulement si elle ne contient **aucun**
   caractère de contrôle, aucun espace, aucune barre oblique inverse, et :
   - **chemin interne** : commence par `/`, et le deuxième caractère n'est pas `/` (`?` et `#` permis :
     `/actualites?page=2`, `/#contact` restent sur le site) ;
   - **adresse externe** : commence littéralement par `https://` (casse ignorée), se lit par `new URL`, de
     protocole `https:`, d'hôte non vide, **sans identifiants** (`https://mairie.fr@autre.example` est
     refusé : l'hôte réel n'est pas celui qu'on lit).
     Tout le reste est refusé. `http://` a son propre code de refus (message dédié du design), sans être
     accepté pour autant.
3. **Stockée telle que saisie, après `trim()`, jamais normalisée.** Les formes que le navigateur
   réécrirait (`https:/hôte`, `https:\\hôte`, barres inverses, espaces) sont **refusées** plutôt que
   corrigées : la valeur en base est exactement celle que le navigateur suivra, et celle que le bureau
   relit.
4. **Validée au rendu.** Le service public recalcule `classifyLinkAddress` sur chaque entrée libre ; une
   adresse refusée est **omise** du menu (comme une page non publiée), jamais rendue. Le `href` public
   est calculé par le service, une seule fois, pour les deux rendus (`nav` d'ordinateur et tiroir
   mobile).
5. **Le libellé propre n'existe que pour l'entrée libre** (arbitrage 3), et une modification ne change
   que `label` et `address` d'une entrée **déjà libre** : la requête de modification filtre `page_id is
null` (arbitrage 2).
6. **Rendu** : lien externe dans le même onglet, `rel="noopener noreferrer"`, sans `target="_blank"`
   (notes de la story) ; lien interne par `next/link`.

## Considered options

- **Table séparée `menu_link`** — rejeté : deux tables à fusionner pour un seul ordre (`rank` commun) et
  une seule visibilité ; le réordonnancement (`reorderMenuItemsTxnDao`, une transaction sur une table)
  deviendrait une écriture sur deux tables, et la policy RLS, l'inventaire et la sauvegarde gagneraient
  une table pour deux colonnes.
- **Colonne de type `target_type` (`page` | `link`) + `target` texte polymorphe** — rejeté : perd la FK
  vers `page` et sa cascade (une page supprimée laisserait une entrée orpheline), et le « jamais les
  deux » se lirait dans une valeur plutôt que dans la structure.
- **Libellé facultatif de remplacement pour toute entrée** — rejeté par l'arbitrage 3 : les entrées de
  page restent inchangées (critère 4) ; un libellé qui diverge du titre de la page serait une deuxième
  vérité à tenir.
- **Liste noire de schémas** (`javascript:`, `data:`, `vbscript:`…) — rejeté : interdit par la story, et
  toujours incomplète (casse, contrôles, schémas futurs, chemins relatifs au protocole).
- **Normaliser par `new URL(x).href`** — rejeté : ajoute une barre finale à toute adresse
  (`https://www.saint-etang.fr` relue `https://www.saint-etang.fr/`), et n'aide pas pour les chemins
  internes (`new URL` exige une base) ; refuser les formes ambiguës donne le même niveau de sûreté avec
  une valeur que le bureau reconnaît.
- **Réutiliser `isHttpsUrl` de l'adaptateur Pennylane** ou le schéma de `rehype-sanitize` du CMS —
  rejeté : le premier vit dans `src/lib/pennylane` (une dépendance de la navigation vers un adaptateur de
  facturation) et ignore les chemins internes ; le second autorise `http` et `mailto`.
- **Liste blanche aussi en `CHECK` SQL** (expression régulière) — rejeté : deux implémentations du même
  prédicat finiraient par diverger ; la base garantit la forme (page **xor** adresse), l'application la
  sûreté, revérifiée au rendu.
- **Masquer au rendu les liens vers un module désactivé (piège s34)** — écarté par l'arbitrage 1 : aucune
  route de module n'existe encore ; le sujet se rouvre quand un module aura une route publique (le filtre
  ne pourrait pas vivre sous `siteNavigationTag`, que l'activation d'un module n'invalide pas).

## Consequences

**Ce qui devient plus simple**

- Le bureau atteint depuis le menu les routes fixes du socle et des sites partenaires sans fabriquer de
  page.
- Un seul prédicat, testé une fois, sert les quatre lieux de validation ; un autre lien saisi par le
  bureau (pied de page, blocs) pourra s'y adosser.

**Ce qui devient plus difficile**

- `menu_item` porte deux formes de ligne : toute lecture passe par une **jointure externe** sur `page`
  (une jointure interne ferait disparaître les entrées libres sans erreur, symptôme qui ressemble à un
  oubli de scope RLS) et par une union discriminée côté domaine.
- Annuler le retrait d'une entrée libre la recrée par libellé et adresse, pas par `page_id`.

**À surveiller**

- s34 (ou la première story qui livre une route de module) : un lien libre vers une route de module
  désactivé reste affiché (arbitrage 1). Le filtre, s'il vient, vit hors du cache de navigation ou
  ajoute `siteNavigationTag` aux invalidations de l'activation d'un module.
- s39 (archive) : les entrées libres font partie des « entrées de menu » à exporter.
- Si un futur besoin veut une adresse `mailto:` ou `tel:` au menu, c'est un élargissement de la liste
  blanche, par un nouvel ADR — jamais en relâchant le préfixe.
