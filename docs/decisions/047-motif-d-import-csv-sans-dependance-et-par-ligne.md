# ADR 047 — Motif d'import : lecteur CSV maison, une transaction par ligne, rapport éphémère

- Status: accepted
- Date: 2026-11-08
- Scope: story s13-import-initial-membres

## Context

s13 pose le motif d'import du produit que s17 réutilisera pour les relevés d'eau : téléversement,
validation ligne à ligne, rapport d'erreurs, idempotence. Le fichier réel est un CSV exporté d'un
tableur, et deux exports du même fichier ont déjà différé par le dialecte (virgule et Windows-1252,
puis point-virgule et UTF-8). Des cellules contiennent des virgules entre guillemets. Un import crée
des identités et, pour chaque email, un compte : une erreur de lecture (nom corrompu, ligne décalée)
est plus grave qu'un rejet.

## Decision

- **Lecteur CSV écrit dans `src/lib/import/`**, fonctionnel et sans dépendance : décodage UTF-8 strict
  avec repli Windows-1252, BOM ignoré, séparateur détecté sur la ligne d'en-têtes (`;`, `,`,
  tabulation), guillemets et guillemets doublés, fins de ligne CRLF ou LF, en-têtes normalisés
  (espaces insécables, apostrophes, casse). Un fichier illisible est refusé avec sa cause, jamais lu
  de travers.
- **Une transaction de tenant par ligne** : chaque ligne s'écrit en entier (fiche, compte, parcelle) ou
  pas du tout ; une ligne rejetée n'empêche pas les suivantes. Tout passe par les services existants
  (`createMemberProfileService`, `attachParcelService`), jamais par un DAO direct (ADR 029).
- **Rapport éphémère** : il est rendu avec le résultat de l'action, jamais stocké ni journalisé. Il
  contient des données personnelles ; le journal ne reçoit que des comptages.

## Considered options

- **Papa Parse ou csv-parse** — rejetées pour s13 : une dépendance de plus à auditer pour un format que
  quelques dizaines de lignes couvrent, et le choix de l'encodage et du séparateur reste à écrire
  autour de toute façon. À rouvrir si s17 révèle un besoin que le lecteur ne couvre pas.
- **Une seule transaction pour tout le fichier** — rejetée : contredit le critère 6 (les lignes valides
  s'importent malgré les invalides).
- **Rapport persisté en base (historique des imports)** — rejetée en s13 : données personnelles
  conservées sans durée de vie décidée, table métier supplémentaire. Reste possible comme story à part.
- **Script d'exploitation** — rejeté : le critère de succès du PRD exige un chargement sans écrire de code.

## Consequences

- s17 réutilise le lecteur et la forme du rapport ; seul le mappage de colonnes change.
- Relancer un fichier est la seule façon de retrouver un rapport.
- Le lecteur maison doit rester couvert par des tests sur des fichiers fictifs (guillemets, encodages, séparateurs).
