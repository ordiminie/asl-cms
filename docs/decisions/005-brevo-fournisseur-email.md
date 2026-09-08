# ADR 005 — Brevo comme fournisseur d'email, derrière un adaptateur

- Status: accepted
- Date: 2026-09-08
- Scope: framing

## Context

Le boilerplate envoie ses emails avec **Resend** : `src/services/email-service.ts` instancie `new Resend(env.RESEND_API_KEY)` en tête de module et appelle `resend.emails.send()` directement. Les 14 gabarits de `src/lib/emails/` sont des composants `react-email`, indépendants du transporteur.

Le PRD impose Brevo — c'est le fournisseur retenu avec le client, et le plafond de **300 emails/jour** est une donnée structurante du produit, pas un détail d'intégration : s26 (scission d'une campagne au-delà de 300 destinataires) et le budget quotidien d'envoi par association en découlent directement.

Contrairement au stockage (ADR 004), **aucune couture n'existe** : le service métier connaît le SDK du fournisseur. Le remplacer à l'identique reproduirait le même couplage avec un autre nom.

## Decision

Introduire un contrat d'envoi maison, sur le modèle de `StorageOperations`, et y brancher une implémentation Brevo.

- Un type `EmailTransport` expose les opérations dont le produit a besoin : envoi unitaire, envoi de campagne, et lecture des statistiques d'ouverture et de clic (s30).
- `src/services/email-service.ts` ne dépend plus que de ce contrat. Les gabarits `react-email` sont conservés tels quels : ils produisent du HTML, ils ne connaissent pas le transporteur.
- **Le quota est une propriété du transport, pas de l'appelant.** Le contrat expose le budget quotidien restant par association, et tout email sortant le décompte — invitations (s15), campagnes (s25), relances (s29), lancement (s42). C'est la seule façon de tenir la promesse de s26 : le plafond Brevo est par compte et par jour, donc scinder une campagne isolée ne suffit pas.
- Resend est retiré avec le nettoyage de l'ADR 009.

## Considered options

- **Appeler le SDK Brevo directement, comme le boilerplate appelle Resend** — rejeté : le PRD classe la facturation membres et le vote parmi les intégrations « derrière une interface interchangeable » (ADR 011) au motif que le fournisseur peut changer d'un tenant à l'autre. L'email tombe sous le même raisonnement — une association peut arriver avec son propre compte d'envoi — et surtout le décompte de quota n'a pas d'endroit naturel où vivre sans ce contrat.
- **Conserver Resend** — rejeté : décision client, actée au PRD. Resend n'offre par ailleurs pas la partie campagne et statistiques attendue par s25 et s30.
- **SMTP générique (nodemailer)** — rejeté : porterait l'envoi unitaire, mais pas les campagnes, pas la gestion de la désinscription, pas les statistiques d'ouverture et de clic. Il faudrait redévelopper ce que Brevo fournit.
- **Deux chemins séparés — transactionnel chez l'un, campagnes chez l'autre** — rejeté pour la V1 : deux comptes, deux quotas à réconcilier, et un budget quotidien par association qui deviendrait impossible à tenir de façon fiable. À rouvrir si la délivrabilité transactionnelle de Brevo décevait.

## Consequences

**Ce qui devient plus simple**

- Le plafond de 300/jour est appliqué en un seul endroit, ce qui rend s26 et le budget quotidien démontrables plutôt qu'espérés.
- Changer de fournisseur, ou en donner un différent à une association, devient une implémentation du contrat.
- Les gabarits `react-email` du boilerplate restent réutilisables sans modification.

**Ce qui devient plus difficile**

- Le contrat est à concevoir avant la première story de communication. Il est plus large que `StorageOperations` : envoi, campagne, statistiques, quota.
- La désinscription doit être cohérente des deux côtés — la liste Brevo et notre propre classification statutaire/facultative. C'est notre classification qui fait foi, Brevo n'en connaît pas la notion.

**À surveiller**

- **Le décompte de quota doit survivre au redémarrage** : un compteur en mémoire repartirait à zéro et laisserait dépasser le plafond. Il vit en base, comme les tâches planifiées de l'ADR 006.
- Le contenu détaillé des 4 modèles d'email est une dépendance externe non levée (PRD Constraints). Le contrat et le câblage se développent sans lui ; seul le texte attend le bureau.
- Ne pas confondre cette facturation-là avec rien : l'email est un coût de plateforme, sans rapport avec la facturation membres (Pennylane, ADR 011) ni avec l'abonnement Stripe Zourite Studio ↔ association.
