# ADR 051 — Une campagne se persiste par destinataire, se livre en arrière-plan, et se désinscrit par jeton aléatoire

- Status: accepted
- Date: 2026-11-10
- Scope: story s25-campagnes-email

## Context

s25 envoie une campagne email aux membres, l'archive, et fait produire son effet au lien de désinscription
du pied de page. Rien n'existe : ni table, ni envoi de masse. Quatre choix engagent s26 (envoi échelonné,
« jamais deux fois la même campagne »), s27 et s27b (ciblage, nature facultative / statutaire), s30
(statistiques) et la recette (la requête d'un envoi de ~300 emails unitaires dure plus que le délai d'un
proxy). La recherche (`docs/research/s25-campagnes-email.md`, pièges 2, 3, 12, 13 et questions 2, 3, 9)
les a laissés ouverts : la forme de l'envoi, l'identité portée par le lien, l'effet du lien, et ce que
la désinscription désigne.

## Decision

- **Trois tables métier** (RLS forcée, ADR 002) : `campaign` (l'archive : objet, texte d'aperçu, corps
  Markdown **tel qu'écrit**, modèle d'origine, cible, décomptes figés à l'envoi, statut, auteur copié),
  `campaign_recipient` (une ligne par destinataire : fiche, statut `pending` / `sent` / `failed`, jeton de
  désinscription) et `member_unsubscribe` (le refus d'une fiche, une ligne par fiche).
- **Une ligne d'envoi par destinataire, créée avant le premier email.** Le déclenchement est donc
  interceptable : s26 découpe en parts en changeant quelles lignes sont traitées, s30 y lit ses
  statistiques, et « jamais deux fois à la même personne » est une contrainte `UNIQUE (campaign_id,
member_profile_id)`, pas une discipline.
- **Livraison en arrière-plan, séquentielle, par `after()` de Next**, lancée **après** l'autorisation et
  la création des lignes. L'action rend la main tout de suite ; la page de la campagne suit
  l'avancement (`sent_count` sur `recipient_count`, relu par rafraîchissement). La livraison n'a besoin
  d'aucune session : elle ne reçoit que l'association et la campagne. Elle **s'arrête au premier
  échec** (campagne `interrupted`, restants `pending`) : un plafond Brevo atteint ferait échouer tous les
  suivants, et relancer écrirait deux fois aux premiers. Aucune reprise en V1 (s26).
- **Idempotence par `submission_id`** : un identifiant tiré à l'ouverture du composeur, `UNIQUE`
  par association. Un double clic, un rejeu ou un second onglet retrouve la campagne existante au lieu
  d'en créer une seconde.
- **Désinscription par jeton aléatoire stocké**, pas par jeton signé : 32 octets aléatoires, un par ligne
  `campaign_recipient`, jamais une identité en clair, jamais l'email. Aucun secret à ajouter à `@/env`, aucune
  rotation qui invaliderait des emails déjà reçus, révocation possible. Le lien est résolu **dans le tenant du
  domaine appelé** : un jeton d'une autre association ne se résout pas, et `withRlsBypass` n'est pas utilisé.
- **L'effet est une écriture par POST, jamais par GET.** `GET /desinscription/{jeton}` montre la
  confirmation sans rien écrire (les antivirus et clients de messagerie préchargent les liens) ; le bouton
  « Me désinscrire » écrit. Le POST sans interaction exigé par RFC 8058 (`List-Unsubscribe-Post`) est une
  route `POST /api/campaigns/unsubscribe/{jeton}` distincte, appelée par le client de messagerie.
- **Le refus est porté par la fiche** (`member_unsubscribe.member_profile_id`), pas par l'adresse : une
  adresse change, un foyer la partage, et l'identité d'un membre n'est jamais son email (AGENTS.md). Pas de
  levée en V1.
- **Les quatre modèles sont du contenu de code provisoire**, libellés dans `messages/fr.json`, pas des lignes
  `email_template` : leur texte reste à rédiger avec le bureau, l'édition d'un modèle est hors périmètre, et
  s27b lira la nature d'un envoi dans la configuration du tenant le moment venu.
- **Une seule fonction pure de calcul de cible** (membres de l'association avec email, non désinscrits)
  alimente le décompte, l'aperçu et l'envoi : c'est le point de passage unique que s27 étend et que s27b
  réintègre.

## Considered options

- **Boucle dans la requête, sans lignes de destinataire** — rejeté : un envoi de ~300 emails unitaires dépasse
  le délai d'un proxy, l'état d'avancement n'existe nulle part, et s26 devrait tout reprendre (c'est le piège
  que la story nomme).
- **File `scheduled_job` + cron système (ADR 006)** — rejeté ici : l'infrastructure n'existe pas encore et
  c'est le sujet de s26 ; `after()` est le plus petit mécanisme qui sorte l'envoi de la requête, et la table de
  destinataires est ce que la file consommera.
- **Jeton signé (HMAC) portant l'identifiant de la fiche** — rejeté : un nouveau secret à déployer et à ne jamais
  changer, aucune révocation, et l'identité voyage dans l'URL.
- **GET qui écrit le refus** — rejeté : désinscrit des membres à leur insu (préchargement). La lecture
  littérale du critère 6 (« suivre le lien enregistre le refus ») est tenue par le bouton de la page, et par le
  POST sans interaction pour les clients qui le supportent.
- **Désinscription par adresse email** — rejeté : voir plus haut ; deux fiches ne partagent pas une adresse
  (index unique), mais l'adresse change.
- **Table `email_template` par association** — rejeté : voir plus haut.
- **Reprise automatique après interruption** — rejeté pour la V1 : sans l'idempotence d'envoi de s26 elle
  risque le doublon.

## Consequences

- Trois tables, donc trois lignes au classement RLS de `docs/architecture.md` (compteurs et titre à tenir,
  sinon `src/db/rls-inventory.test.ts` échoue).
- Le texte d'une campagne et le contenu de ses destinataires sont des données personnelles : jamais dans les
  journaux (intercepteurs `shouldLogDetails: () => false`), jamais dans un `'use cache'`. L'export d'association
  (s38) et la copie du membre (s40) devront inclure les trois tables ; à noter, pas à faire ici.
- Un redémarrage du serveur pendant un envoi laisse une campagne `sending` sans fin : l'écran la traite comme
  `interrupted` passé un délai sans progression. La vraie reprise appartient à s26.
- **Non vérifié, à prouver à la recette sur le VPS** : Brevo ajoute lui-même un en-tête `List-Unsubscribe` aux emails
  transactionnels (le retirer est une option d'un forfait Entreprise) ; que l'en-tête que nous passons dans
  `headers` le remplace n'est pas établi. Si Brevo gagne, son lien ne désinscrit que chez Brevo : le bouton du
  pied de page, lui, reste le chemin qui fait foi. À vérifier en lisant les en-têtes d'un envoi réel.
- Le nom d'expéditeur de la campagne est celui de l'association, l'adresse reste celle de la plateforme
  (`getEmailFrom()`, ADR 005) ; la réponse est dirigée vers l'adresse de contact de l'association.
