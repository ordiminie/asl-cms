---
validated: yes
---

# Plan — Story s27b-nature-envois

Branch: `feature/s27b-nature-envois`

Sources : `docs/research/s27b-nature-envois.md`, `docs/designs/s27b-nature-envois.md` (+ `.html`),
[ADR 064](../decisions/064-nature-des-envois-reglage-par-modele-figee-a-l-envoi.md). Appuis : ADR 010, 016,
051, 052, 053, 055, 057, 060. Arbitrage du 20/11/2026 : nature modifiable par le **SuperAdmin seul**.

## Target story

Chaque type d'envoi (quatre modèles de s25 + message libre) porte une nature `facultative` ou `statutaire`,
lue dans les réglages du tenant, `facultative` par défaut. Un désinscrit est réintégré dans les cibles
d'une campagne statutaire (trois cibles), reste exclu des facultatives. Pied de page statutaire explicite ;
page de désinscription qui dit ce qui continue ; reclasser vaut au prochain envoi. Six critères, repris
dans la recherche.

## Tasks (ordered)

1. [x] **Réglages** — section `campaign_nature` (`AssociationSettingSection`) ; cinq clés `choice`
       `campaign.nature.<templateId>` (options `facultative` / `statutaire`, défaut `facultative`,
       `editableBy: 'super_admin'`), libellés `AssociationSettings` (carte, intro, options, aide lecture
       seule, « Sans choix enregistré : facultatif. ») ; accesseur `getCampaignNature(settings, templateId)`
       qui rend `facultative` pour toute valeur absente ou inconnue ; `getStatutoryTemplateIds(settings)`.
       Seed TechCorp (`TEST_TENANT_SETTINGS`) : `reminder`, `invoice`, `general_assembly` = `statutaire`,
       `free`, `post_assembly_documents` = `facultative`. **Vérif** : tests du registre, de l'accesseur
       (valeur vide, inconnue → facultative ; critères 1, 2), du formulaire (bureau en lecture seule,
       SuperAdmin modifie), du seed.
2. [x] **Modèle** — `campaign.nature` (pgEnum `campaign_nature`, `not null`, défaut `facultative`) ;
       `pnpm db:generate` (aucune SQL à la main) ; `docs/architecture.md` (ligne `campaign`). **Vérif** :
       test de modèle, `db:generate` sans diff.
3. [x] **Règle de cible** — `computeCampaignTarget(rows, isTargeted, nature = 'facultative')` : en
       `statutaire`, l'adresse désinscrite est destinataire et comptée `reinstated` ; `unsubscribed` ne
       compte que les exclues ; `campaignTargetCountsOf` rend `reinstated`. Docstring mise à jour.
       **Vérif** : tests de règle — deux natures × prédicats « tous », « impayés » (sous-ensemble),
       « groupe » ; adresse partagée dont une fiche est désinscrite ; fiche sans adresse jamais comptée.
4. [x] **Service** — `readTarget(orgId, choice, settings, templateId)` dérive la nature des réglages ;
       `getCampaignComposerContextService`, `previewCampaignPlanService` et `readCampaignTargetAction`
       reçoivent le modèle (schéma Zod du modèle) ; `sendCampaignService` fige `nature` sur la campagne et
       `unsubscribedCount` = exclues (`facultative`) ou réintégrées (`statutaire`) ; DTO de campagne et de
       décompte portent `nature`. Aucune nature acceptée en entrée. **Vérif** : tests de service — trois
       cibles × deux natures (critère 3) ; reclasser entre deux envois change la cible du second et pas la
       nature figée du premier (critère 6) ; une entrée avec `nature` est refusée ou ignorée.
5. [x] **Livraison** — `deliverToRecipient` : contrôle de désinscription sauté quand la campagne est
       `statutaire` (nature lue sur la campagne). **Vérif** : test — adresse désinscrite après la création,
       envoyée en statutaire, marquée `unsubscribed` en facultatif.
6. [x] **Email** — pied de `campaign-email.tsx` et `campaign-text.ts` selon la nature : phrase statutaire
       et libellé « Ne plus recevoir les campagnes facultatives » ; facultatif inchangé ; aperçu = nature
       courante du modèle, livraison = nature figée. Lien et `List-Unsubscribe` sur les deux natures.
       **Vérif** : tests de rendu HTML et texte (critère 4).
7. [x] **Composeur et fiche** — ligne de nature sous chaque modèle (`CampaignsBureau.templateNatures.*`) ;
       décompte relu au changement de modèle ; note « Elles reçoivent celle-ci : c'est un envoi
       statutaire. » ; rappel de l'aperçu ; fiche : ligne « Nature », libellé « Désinscrits qui l'ont
       reçue » en statutaire. **Vérif** : tests des composants (aucun contrôle de nature dans le
       formulaire).
8. [x] **Désinscription** — `getUnsubscribePageStateService` rend aussi les types statutaires du tenant
       (aucune donnée du membre) ; `UnsubscribePanel` : paragraphe et liste en `confirm`, `unsubscribed`,
       `already` ; phrase « plus aucune campagne » sans statutaire ; docstring mise à jour. **Vérif** :
       tests du service et du panneau (critère 5).
9. [x] **Design system** — §5.4 (bouton conservé sur un statutaire, libellé), §5.5 (« Publication après
       l'AG » facultative), §3.1 (carte « Nature des envois »), §3.14 (nature écrite dans le
       `radio-group`). **Vérif** : relecture.
10. [x] **e2e** — `e2e/campaigns.spec.ts` : avec le seed TechCorp, un désinscrit reçoit une convocation
        (statutaire) et pas un message libre, sur « tous », « impayés » et un groupe ; la page de
        désinscription liste les envois statutaires ; le SuperAdmin reclasse un modèle et l'envoi suivant
        change (critère 6) ; le bureau voit la carte en lecture seule. **Vérif** : en CI.

## Files touched

- `src/services/types/domain/association-settings-types.ts`, `campaign-types.ts`
- `src/db/models/campaign-model.ts`, migration générée, `src/db/repositories/campaign-repository.ts`
- `src/services/rules/campaign-rules.ts`, `src/services/campaign-service.ts`, `src/services/unsubscribe-service.ts`
- `src/services/validation/campaign-validation.ts`
- `src/app/[locale]/(bureau)/bureau/campagnes/actions.ts`, page de désinscription, `unsubscribe-dal.ts`
- `src/lib/emails/campaign-email.tsx`, `campaign-text.ts`
- `src/components/features/campaigns/campaign-composer.tsx`, `campaign-preview-step.tsx`,
  `campaign-detail.tsx`, `unsubscribe-panel.tsx` ; formulaire des réglages (rendu générique)
- `messages/fr.json`, `src/db/scripts/tenant-settings-seed.ts`
- tests colocalisés ; `e2e/campaigns.spec.ts`
- `docs/design-system.md`, `docs/architecture.md`, ADR 064, docs de la story

Une migration (colonne `campaign.nature`), générée. Aucune variable d'environnement, aucune dépendance.

## Test strategy

- **Unitaire (`pnpm test --run`)** : accesseur et registre (défaut sûr), règle de cible (deux natures ×
  trois prédicats), services (cible, figement, reclassement, refus d'une nature en entrée), livraison,
  rendu de l'email, composants (composeur, fiche, panneau de désinscription, réglages en lecture seule).
- **e2e (CI)** : les trois cibles × deux natures sur base réelle, page de désinscription, reclassement par
  le SuperAdmin. Isolation : aucune table nouvelle ; la colonne s'ajoute à `campaign`, déjà sous RLS — le
  test d'accès croisé de s25 reste valable.

## Definition of Done

- Les six critères couverts par un test nommé d'après eux ; défaut `facultative` prouvé.
- Aucune nature en saisie ; aucune valeur de classification dans le code.
- `pnpm lint`, typecheck, `pnpm test --run` verts ; e2e verts en CI ; migration générée.
- Revue passée (`Ship allowed: yes`), une PR, un commit de story (plus un pour la migration si utile).
