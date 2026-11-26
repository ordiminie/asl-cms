# ADR 077 — Mise à jour annuelle : instantané des valeurs importées sur la fiche, le site l'emporte

- Status: proposed
- Date: 2026-11-26
- Scope: story s56-import-annuel-coordonnees

## Context

s56 met à jour, depuis le fichier clients de Pennylane, les adresses postales, le téléphone et les adresses
email des fiches existantes (critère 2). La règle de La Fourche est confirmée (réponse 6, 15/11/2026) : « le
fichier n'écrase que les données jamais modifiées sur le site depuis le dernier import ». Réimporter le même
fichier ne doit rien changer (critère 10).

Rien ne trace aujourd'hui un import ni une modification « sur le site » : `member_profile.updated_at` est
bumpé par toute écriture (bureau, membre, identifiant Pennylane) et vaut pour la fiche entière ; l'`origin`
d'une adresse dit qui l'a **créée**, pas qui l'a modifiée (une adresse `file` corrigée par le bureau reste
`file`). Les fiches créées par s13 n'ont aucune trace de la valeur importée.

## Decision

1. **Instantané sur la fiche.** Deux colonnes facultatives sur `member_profile` (couvertes par sa RLS forcée,
   aucune table nouvelle, patron de l'ADR 048) : `pennylane_import_snapshot` (`jsonb`) — les dernières valeurs
   **lues dans le fichier** pour chaque groupe : `home` (ligne, code postal, commune), `land` (idem), `phone`,
   `emails` (liste en minuscules, ordre de la cellule) — et `pennylane_imported_at` (`timestamptz`). Écrites
   par l'import annuel à chaque fiche rapprochée, et par l'import initial (s13) à la création.
2. **Granularité : le groupe**, pas le champ (domicile, terrain, téléphone, adresses email). C'est la maille
   du rapport (design s56, section 1) et des formulaires du bureau ; les compléments d'adresse, absents du
   fichier, ne sont jamais écrits par l'import.
3. **Règle par groupe**, pure (fichier `F`, valeur actuelle `C`, instantané `S`) :
   - `F` vide (cellules vides) ou groupe absent (terrain sans `Adresse de Livraison`, arbitrage C) → groupe
     ignoré, rien n'est effacé ;
   - `F = C` → inchangé ;
   - `S` connu : `C = S` → `F` écrit ; sinon la valeur du site est **gardée**, et signalée au rapport
     seulement si `F ≠ S` (le fichier apporte du neuf) ;
   - `S` inconnu (fiche de s13 ou fiche créée à la main) : fiche jamais modifiée depuis sa création
     (`updated_at = created_at`) → `F` écrit ; sinon gardée et signalée.
   - Dans tous les cas l'instantané reçoit `F`.
4. **Adresses email** : une adresse est « venue du fichier » si son origine est `file` **et** qu'elle figure
   dans `S.emails` (sans instantané : si sa ligne n'a jamais été modifiée, `updated_at = created_at`) ; sinon
   elle est traitée comme une adresse du site (jamais désactivée, critère 9). Une adresse de `S.emails` que la
   fiche n'a plus (retirée sur le site) n'est pas rajoutée.
5. **Idempotence par comparaison, pas par horodatage** : aucune écriture quand rien ne change (ni la fiche,
   ni ses adresses, ni `updated_at`) ; seul l'instantané et `pennylane_imported_at` sont réécrits, sans bumper
   `updated_at`. Rejouer le fichier donne un rapport « Rien n'a changé ».

## Considered options

- **Horodatage « modifié sur le site » par champ** (colonnes `*_site_updated_at`) — rejeté : une dizaine de
  colonnes, chaque écrivain du bureau et du membre à modifier, et une date ne dit pas si le fichier apporte du
  neuf.
- **Date du dernier import par association** (table à la `billing_sync_state`) comparée à `updated_at` —
  rejeté : `updated_at` est par fiche, bumpé par l'import lui-même et par des écritures sans rapport ; une
  table de plus à RLS et accès croisé pour une information moins précise.
- **Table d'instantanés dédiée** — rejeté : relation 1-1 avec la fiche, même RLS, une jointure et un test
  d'accès croisé de plus pour rien.
- **Reprise `--custom` des instantanés depuis les valeurs actuelles** pour les fiches de s13 — rejeté :
  tiendrait pour importées des valeurs corrigées sur le site depuis ; la règle « jamais modifiée depuis la
  création » est prudente sans migration de données.

## Consequences

- Une valeur gardée reste gardée tant que le fichier ne la rejoint pas ; elle n'est signalée qu'une fois par
  valeur nouvelle du fichier.
- Premier import annuel : une fiche touchée sur le site depuis sa création garde **tous** ses groupes qui
  diffèrent (prudence, erreur visible au rapport et jamais une donnée écrasée).
- L'instantané est une donnée personnelle : supprimé avec la fiche, à déclarer à l'export RGPD (s38) et à
  l'inventaire de `docs/architecture.md`.
