# ADR 012 — Le mode sombre est conservé

- Status: accepted
- Date: 2026-09-09
- Scope: framing

## Context

Le design system a décidé l'abandon du mode sombre — un seul jeu de tokens — et son §10 en
tirait quatre dettes de socle : retirer le bloc `.dark` de `globals.css`, neutraliser
`next-themes` et le sélecteur de thème, mettre à jour `rule-mdx-rendering.md` qui impose de
vérifier « en clair et en sombre », et rendre `docs/[...slug]` de nouveau prerendable.
`docs/adaptation-socle-design-system.md` en avait fait un programme de travail, conduit hors
pipeline killer-saas.

Ce programme allait plus loin que du CSS. La préférence de thème est **persistée en base** :
enum `theme_type`, colonne `user.theme`, types, validation, formulaires, synchronisation
client, et du **SQL brut dans `src/db/scripts/seed.ts`** — dont dépend la suite e2e, qui
tourne contre une base seedée. S'y ajoutaient `src/proxy.ts` (cookie `theme`, en-tête
`x-theme`), 125 classes `dark:` réparties dans 34 fichiers, et trois règles à réécrire.

Au moment d'appliquer le design system au socle, le périmètre a été ramené à l'apparence
seule (CSS/JS). Le motif est le rapport coût/valeur : ce chantier traverse la base de
données, le proxy, les tests et les règles pour rhabiller un socle dont **aucun écran
ASL-CMS n'existe encore** — la valeur pour l'association est nulle avant s01.

## Decision

**Le mode sombre est conservé.** Le produit porte deux jeux de tokens. `next-themes`, le
sélecteur de thème et la colonne `user.theme` restent en place.

Le §10 du design system est caduc sur ce point : la présente ADR le remplace.

## Considered options

- **Retirer le mode sombre comme le prescrit le §10** — rejeté : le retrait atteint la base
  de données (migration Drizzle, réécriture du SQL brut de `seed.ts`, suite e2e), le proxy,
  les tests et trois règles, sans aucun gain observable par un utilisateur avant s01.
- **Retirer le mode sombre à moitié** — le CSS sans `next-themes` — rejeté : les 125 classes
  `dark:` continueraient de s'appliquer par-dessus des tokens clairs dès que le système de
  l'utilisateur est en sombre. Rendu mixte, **pire que l'état de départ**.
- **Garder le bloc `.dark` du boilerplate tel quel** — rejeté : l'application porterait deux
  identités sans rapport, bleu d'encre en clair et gris chaud `stone` en sombre.

## Consequences

**Plus facile** — aucune migration, aucun SQL de seed à réécrire, aucune règle à réécrire.
L'application du design system au socle a tenu en 10 fichiers.

**Plus difficile** — toute livraison de conception doit désormais fournir **deux** jeux de
tokens. Le jeu sombre vient de `docs/designs/Design system - sombre.dc.html`, qui introduit
au passage les variantes `-ink` : `-foreground` est l'encre posée **sur** l'aplat, `-ink` la
couleur prise **en texte** sur le fond de page.

**À surveiller** — trois points ouverts :

1. **Le trio `warning` n'est couvert qu'en clair.** Ses valeurs sombres sont dérivées, pas
   validées, et signalées comme telles dans `globals.css`. À faire trancher.
2. **L'appariement clair des variantes `-ink` est déduit** — le document les marque « dark
   only ». En clair elles renvoient à `primary` / `destructive`. À confirmer.
3. **Les 125 classes `dark:` du boilerplate n'ont pas été écrites pour cette palette.** Celles
   qui codent une couleur en dur l'ignorent : `src/components/ui/file-upload.tsx` recode toute
   sa surface sombre en `neutral-*`, et plusieurs badges utilisent des aplats saturés
   (`dark:bg-blue-900`, `dark:bg-red-900`). Elles ne sont pas corrigées : à trier story par
   story, quand l'écran concerné passe en revue.

`.claude/rules/01-presentation/rule-mdx-rendering.md` garde sa consigne de vérifier « en
clair et en sombre » : elle redevient exacte.

⚠️ L'exception email du §5.2 est **inchangée** et reste vraie : certains clients de
messagerie imposent le mode sombre, indépendamment de ce que fait le web.
