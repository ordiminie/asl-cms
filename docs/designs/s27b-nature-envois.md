# Design — Story s27b-nature-envois

> Conçu le 2026-11-20, chemin **agent** (orchestrateur). Source visuelle unique : `docs/design-system.md`.
> Contexte : `docs/research/s27b-nature-envois.md`. Écrans de départ : `docs/designs/s25-campagnes-email.md`
> (écrans 2, 3, 4, 6 et pied d'email), `docs/designs/s27-groupes-destinataires.md` (décompte),
> `docs/designs/s52-budget-envoi-adaptateur.md` (réglage en lecture seule pour le bureau).
> **Web : mode clair uniquement** (ADR 033). Arbitrage du 20/11 : la nature se modifie par le **SuperAdmin seul**.
>
> Contrôle visuel : voir la ligne de résultat en fin de fichier.

## Screen(s)

Données fictives : « Clos-Fleuri », 296 adresses joignables, 15 désinscrites.

| Écran | Route / support                           | Change                                                                                |
| ----- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| 1     | `/bureau/reglages` — carte nouvelle       | « Nature des envois » : une ligne par type d'envoi, `radio-group` à deux options      |
| 2     | `/bureau/campagnes/nouvelle` — composeur  | nature écrite sous chaque modèle ; décompte qui suit le modèle                        |
| 3     | aperçu (étape 3) et fiche de campagne     | rappel du décompte ; ligne « Nature » au résumé ; « Désinscrits exclus » ou « reçue » |
| 4     | email de campagne — pied de page          | mention statutaire, libellé du bouton de désinscription                               |
| 5     | `/desinscription/{jeton}` — page publique | ce que le membre continuera de recevoir                                               |

- **Écran 1 — Réglages, carte « Nature des envois »** (section nouvelle du registre, juste après la carte de la section `sending`).
  Intro : « Un envoi **statutaire** atteint aussi les membres désinscrits : leur appartenance à
  l'association les engage à le recevoir. Un envoi **facultatif** ne les atteint pas. » Cinq réglages
  `choice` du registre (§3.1, `radio-group`, 2 options) : « Message libre », « Relance manuelle »,
  « Facture disponible », « Convocation à l'AG », « Documents après l'AG ». Options : « Facultatif — les
  désinscrits ne le reçoivent pas » / « Statutaire — les désinscrits le reçoivent aussi ». Réglage vide :
  « Sans choix enregistré : facultatif. » (§3.1, valeur qui s'applique). **Bureau** : rendu en lecture
  seule (forme s52 : fond `muted`, valeur en vigueur), aide « Réglé par l'équipe technique de la
  plateforme, après avis du conseil RGPD : vous ne pouvez pas le modifier. » **SuperAdmin** : modifiable.
- **Écran 2 — Composeur.** Carte « Modèle » : sous la phrase d'usage de chaque choix, une ligne `meta`
  « Envoi statutaire : les membres désinscrits le reçoivent aussi. » ou « Envoi facultatif : les membres
  désinscrits ne le reçoivent pas. » — lue dans les réglages, **aucun contrôle** pour la changer. Carte
  « Destinataires » : le décompte est relu quand le modèle change (comme pour la cible, `skeleton` pendant
  la lecture). Ligne « Adresses désinscrites » : en facultatif, note inchangée « Elles ne reçoivent pas
  les campagnes. » ; en statutaire, note « Elles reçoivent celle-ci : c'est un envoi statutaire. » et
  le nombre est compris dans « Adresses qui recevront la campagne ».
- **Écran 3 — Aperçu et fiche.** Rappel (aperçu) : facultatif inchangé (« … {n} désinscrits n'en
  recevront pas ») ; statutaire : « **311 membres** recevront cette campagne, dont 15 désinscrits
  (envoi statutaire) · 71 sans email n'en recevront pas. » Fiche de campagne, carte « Résumé » : ligne
  « Nature » (« Statutaire » / « Facultative », texte, **figée à l'envoi**) ; la ligne « Désinscrits
  exclus » devient « Désinscrits qui l'ont reçue » pour une campagne statutaire.
- **Écran 4 — Pied de l'email** (§5.4). Statutaire : au-dessus du bouton, la phrase (ton §5.4 : le
  pourquoi, jamais « vous ne pouvez pas ») « Ce message vous parvient même si vous vous êtes désinscrit
  des campagnes : votre appartenance à {association} vous engage à en être informé. » Le bouton reste, au
  libellé « Ne plus recevoir les campagnes facultatives » (lien de désinscription obligatoire sur tout
  envoi de masse, PRD l. 72 ; il désinscrit des seuls envois facultatifs). Facultatif : pied de s25
  inchangé (« Ne plus recevoir ces campagnes », « Se désinscrire ne vous prive d'aucune information
  obligatoire. »). Version texte : mêmes phrases.
- **Écran 5 — Désinscription.** Sous la phrase « Cette adresse ne recevra plus les campagnes… »
  (confirmation, puis « C'est enregistré »), un paragraphe : « Vous continuerez de recevoir, parce que
  votre appartenance à l'association vous y engage : » + liste à puces des types statutaires du tenant
  (libellés de l'écran 1). Aucun type statutaire : « Vous ne recevrez plus aucune campagne de {name} à
  cette adresse. » États `already` et `invalid` inchangés (le premier reprend le paragraphe).

## Mockup

`docs/designs/s27b-nature-envois.html` — référence visuelle. **NE PAS copier en production** : l'Execute
réutilise le rendu généré des réglages, le composeur, l'email React et `UnsubscribePanel`.

## Reused components (from the design system)

- Réglage `choice` → `radio-group` (§3.1) ; lecture seule pour le bureau (forme s52, §3.1).
- `radio-group` du composeur (s25), lignes de décompte libellé / valeur / note (s27), `skeleton`.
- Pied de campagne de s25 (§5.4 : bouton de désinscription visible, mentions `muted-foreground`).
- Liste à puces de corps de texte (18 px, page publique de s25).

## States

| Écran | Vide                                                                | Chargement                                        | Erreur                                               | Succès                          |
| ----- | ------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------- | ------------------------------- |
| 1     | réglage jamais enregistré : « Sans choix enregistré : facultatif. » | existant                                          | valeur hors liste refusée par le registre (existant) | toast d'enregistrement existant |
| 2     | cible sans destinataire : existant (s27)                            | `skeleton` sur le décompte quand le modèle change | lecture du décompte impossible : existant (s27)      | décompte relu                   |
| 3     | —                                                                   | —                                                 | —                                                    | rappel et résumé                |
| 4     | —                                                                   | —                                                 | —                                                    | pied statutaire ou facultatif   |
| 5     | aucun envoi statutaire : phrase « plus aucune campagne »            | —                                                 | `invalid`, `error` existants                         | `unsubscribed`, `already`       |

## Design system gaps

1. **§5.4 contredit le PRD et s27b sur le bouton de désinscription d'un envoi statutaire** — §5.4 dit
   « Pas de désinscription » et renvoie à des « préférences » qui n'existent pas ; le PRD (l. 72) fait du
   lien une obligation sur tout envoi de masse, et s25 le pose sur chaque campagne. Proposition retenue :
   le bouton reste, libellé « Ne plus recevoir les campagnes facultatives ». À corriger au §5.4.
2. **§5.5 classe « Publication après l'AG » en statutaire** — l'arbitrage du 18/09 (notes de s27b, « à ne
   pas corriger ») la classe facultative. Le design suit la story ; le tableau §5.5 est à aligner.
3. **Carte de réglages nouvelle** « Nature des envois » — section du registre (`campaign_nature`), même
   gabarit que les cartes générées (§3.1). Pas de composant nouveau.
4. **Nature d'un modèle écrite dans un `radio-group`** (composeur) — une ligne `meta` sous la phrase
   d'usage ; forme à inscrire au §3.14 (formes de s27).

Contrôle visuel : non fait — Chromium de Playwright ne démarre pas sur la machine (essai du 20/11/2026 :
« Target page, context or browser has been closed » au lancement) ; contrôle en lecture seule à la place,
le 20/11/2026 : styles repris de la maquette de s20, couleurs toutes issues des tokens §1.1 / §1.9 (aucune
couleur hors du bloc `:root`), espacements dans l'échelle §1.4, rupture mobile `max-width: 640px` dans le
cadre, états des cinq écrans présents.
