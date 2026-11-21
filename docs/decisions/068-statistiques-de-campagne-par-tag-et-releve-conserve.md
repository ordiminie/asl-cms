# ADR 068 — Statistiques de campagne : un tag fournisseur par campagne et un relevé conservé

- Status: accepted
- Date: 2026-11-21
- Scope: story s30-stats-campagnes
- Amends: ADR 005 (forme de la « lecture des statistiques » du contrat `EmailTransport`), ADR 017 (le contrat
  ne se limite plus à `send`)

## Context

s30 affiche les ouvertures et les clics d'une campagne, **mesurés par Brevo** (« restitution, pas mesure »).
Une campagne n'existe pas chez Brevo : chaque destinataire reçoit un email transactionnel unitaire (ADR 051),
réparti en parts quotidiennes (ADR 052). L'ADR 005 annonçait une opération de lecture des statistiques dans
`EmailTransport` ; le code s'en tient à `send`, et la réponse de Brevo (`messageId`) est ignorée.

Faits vérifiés sur l'API Brevo (21/11/2026) : `POST /v3/smtp/email` accepte `tags: string[]` ;
`GET /v3/smtp/statistics/aggregatedReport?tag=&startDate=&endDate=` agrège `requests`, `delivered`,
`uniqueOpens`, `uniqueClicks`… pour un tag, sur une plage **de 90 jours au plus**, tous champs optionnels.
Brevo ne signale pas qu'un agrégat est définitif.

Arbitrages du 21/11/2026 : conserver le dernier relevé (une campagne de plus de 90 jours garde ses chiffres) ;
ouvertures et clics en **personnes uniques**, taux sur les **emails envoyés** ; phrase d'interprétation affichée.

## Decision

1. **Un tag par campagne**, `campaign-<uuid de la campagne>` : porté par chaque email de la campagne
   (`SendEmailPayload.tags` → `ComposedEmail.tags` → `EmailMessage.tags` → `tags` du corps Brevo). Toutes les
   parts portent le même tag : l'agrégat Brevo est **consolidé sur la campagne** sans calcul maison. Le tag
   n'est pas une donnée personnelle ; il n'est pas devinable.
2. **Le contrat `EmailTransport` gagne `readTagStatistics({tag, startDate, endDate})`**, obligatoire pour
   toute implémentation. Brevo interroge l'agrégat (délai borné, clé jamais journalisée, champ absent lu 0) ;
   `resend`, `file` et `memory` répondent `{status: 'unsupported'}` (`memory` peut être amorcé pour les tests).
   Un échec réseau ou un refus lève `EmailTransportError`, comme `send`. Le code métier passe par
   `email-service`, jamais par le transport directement hors de ce service.
3. **Campagne suivie** : colonne `campaign.stats_tracked` (`false` par défaut, `true` pour toute campagne créée
   après s30). Une campagne non suivie est « indisponible », jamais « 0 ».
4. **Relevé conservé** sur `campaign` : `stats_unique_opens`, `stats_unique_clicks`, `stats_read_at`, écrits
   **seulement quand l'agrégat est consolidé** : campagne terminée (`sent` ou `interrupted`) **et**
   `requests` Brevo ≥ `sent_count`. Le relevé est de la restitution (des compteurs fournis par Brevo), pas de la
   mesure. Il est écrit par la lecture de la fiche, sous `withTenant`, dans la table déjà isolée par la RLS.
5. **Règle d'affichage**, dans l'ordre : aucun email parti → « rien à mesurer » ; campagne en cours → « après
   le dernier envoi » ; non suivie → indisponible ; dans la fenêtre Brevo → lecture : consolidée → chiffres +
   relevé écrit, sinon « pas encore disponibles » ; lecture impossible (erreur, hors fenêtre, transport sans
   statistiques) → dernier relevé s'il existe, sinon indisponible avec sa raison. **Un chiffre n'est affiché
   que s'il est consolidé.**
6. **Fenêtre de lecture** : de la veille du jour (Paris) de création de la campagne à aujourd'hui ; la lecture
   n'a lieu que si cette plage tient en 89 jours (marge sur la limite de 90 et sur le fuseau de Brevo).
7. **Taux** = arrondi à l'entier de `unique / sent_count × 100`.

## Considered options

- **Webhooks Brevo (événements `opened`, `click`) stockés par destinataire** — rejeté : une route publique et un
  secret de plus, une table d'événements nominatifs (surface RGPD) pour restituer trois compteurs.
- **Lecture directe sans relevé** — rejetée par l'arbitrage : la convocation d'AG de l'an passé perdrait ses
  chiffres après 90 jours.
- **Table dédiée aux relevés** — rejetée : un relevé par campagne, trois colonnes ; une table de plus (RLS,
  policy, test d'isolation) pour une relation 1-1.
- **Agréger par `messageId` conservé sur chaque destinataire** — rejeté : 300 appels ou une pagination
  d'événements pour un résultat que l'agrégat par tag donne en un appel.
- **Opération facultative (`readTagStatistics?`)** — rejetée : un transport qui oublie l'opération se
  confondrait avec un transport qui ne la sait pas ; l'obligation rend la réponse `unsupported` explicite.
- **Taux sur `delivered` Brevo, ouvertures totales** — rejetés par l'arbitrage.

## Consequences

**Ce qui devient plus simple** : la consolidation multi-parts est native ; aucun pixel, aucun compteur maison ;
l'isolation repose sur la lecture de la campagne sous `withTenant` **avant** tout appel au fournisseur.

**Ce qui devient plus difficile** : une lecture de fiche peut écrire (le relevé) ; chaque implémentation de
transport porte une opération de plus.

**À surveiller** :

- Le suivi des ouvertures et des clics doit être actif dans le compte Brevo (paramètre du compte) : à vérifier
  en recette, où la clé est restreinte à l'IP du VPS.
- Une campagne envoyée pendant une bascule sur Resend (ADR 017) n'atteindra jamais `requests ≥ sent_count` chez
  Brevo : elle reste « pas encore disponible ». Accepté tant que le secours n'a jamais servi.
- Brevo réécrit les liens pour compter les clics, celui de désinscription compris.
- Un second client sur le même compte Brevo ne change rien à l'isolation (tag uuid, contrôle avant l'appel).
