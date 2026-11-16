# ADR 055 — Une campagne part une fois par adresse, et la désinscription couvre l'adresse

- Status: accepted — remplace, pour la désinscription, la règle « portée par la fiche, jamais par
  l'adresse » de l'[ADR 051](051-campagnes-persistees-par-destinataire-et-desinscription-par-jeton.md)
- Date: 2026-11-16
- Scope: story s53-un-acces-plusieurs-terrains

## Context

s53 relie plusieurs fiches d'une même adresse à un seul compte : une adresse partagée désigne une seule
personne (ADR 054). Le critère 7 exige **un seul message par adresse**. Or s25 calcule la cible fiche
par fiche (`computeCampaignTarget`), crée une ligne `campaign_recipient` par fiche et lit `{nom}`,
`{parcelle}` et la désinscription sur la fiche ; `member_unsubscribe` est une ligne par fiche.

Arbitrage de produit du 16/11/2026 : la désinscription couvre l'adresse ; `{nom}` est le nom du compte
et `{parcelle}` toutes ses parcelles actuelles.

## Decision

- **Dédoublonnage au calcul de la cible** (`computeCampaignTarget`, point de passage unique que les
  relances et le lancement réutilisent) : les fiches sont groupées par `lower(email)` ; un groupe donne
  **un** destinataire, porté par la première fiche du groupe dans l'ordre de l'ADR 054. Le décompte
  `recipients` compte des adresses ; `unsubscribed` compte des adresses ; `withoutEmail` reste en fiches.
- **Un groupe dont une fiche est désinscrite est désinscrit** en entier.
- **Se désinscrire** depuis un envoi pose une ligne `member_unsubscribe` sur **chaque fiche** de
  l'association qui porte la même adresse à cet instant. La table et son unicité par fiche ne changent
  pas ; une fiche qui reçoit plus tard cette adresse n'hérite pas du refus (à revoir avec s54).
- **Variables** : pour une adresse à plusieurs fiches, `{nom}` = nom du compte relié, `{parcelle}` =
  parcelles actuelles de toutes les fiches de l'adresse, en ordre numérique. Une adresse à une fiche :
  inchangé. Les valeurs sont relues à la livraison (s26), pas figées à la création.

## Considered options

- **Désinscription par fiche, envoi tant qu'une fiche reste inscrite** — rejeté par l'arbitrage : une
  personne qui se désinscrit recevrait encore la campagne au titre de son autre terrain.
- **Une ligne `member_unsubscribe` par adresse** — rejeté : ferait de l'adresse une clé de stockage
  (règle d'identité du projet), et s54 rend l'adresse multiple par fiche.
- **Dédoublonner à la livraison seulement** — rejeté : les décomptes affichés et le budget d'envoi (s52)
  compteraient des fiches ; la cible doit déjà compter des adresses.

## Consequences

- Le nombre d'envois d'une campagne baisse (25 lignes → 15 adresses dans le cas réel) ; le budget de
  s52 compte des adresses.
- s54 étendra le groupement (une fiche, plusieurs adresses) : le point de passage reste
  `computeCampaignTarget`.
- Les campagnes déjà créées gardent leurs lignes ; seule une nouvelle cible est dédoublonnée.
