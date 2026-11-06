# Polices hébergées avec le site

Chargées par `next/font/local` dans `../base-layout.tsx` (story s51, ADR 046). Une montée de version
est une opération manuelle : remplacer le fichier, puis mettre à jour ce tableau.

| Fichier                      | Famille        | Version (table `name`) | Axe `wght` du fichier | Graisses déclarées | Licence                  |
| ---------------------------- | -------------- | ---------------------- | --------------------- | ------------------ | ------------------------ |
| `public-sans-latin.woff2`    | Public Sans    | 2.001                  | 100..900              | `400 700`          | `public-sans-OFL.txt`    |
| `source-serif-4-latin.woff2` | Source Serif 4 | 4.004                  | 200..900              | `400 700`          | `source-serif-4-OFL.txt` |
| `jetbrains-mono-latin.woff2` | JetBrains Mono | 2.211                  | 400..800              | `400 500`          | `jetbrains-mono-OFL.txt` |

## Origine des polices

Récupérées le 6 novembre 2026 depuis l'API CSS2 de Google Fonts, sous-ensemble `latin` (le bloc
`/* latin */` de la feuille renvoyée à un navigateur récent), mêmes octets que ceux que
`next/font/google` téléchargeait au build :

- `https://fonts.googleapis.com/css2?family=Public+Sans:wght@400..700&display=swap`
  → `https://fonts.gstatic.com/s/publicsans/v21/ijwRs572Xtc6ZYQws9YVwnNGfJ4.woff2`
- `https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400..700&display=swap`
  → `https://fonts.gstatic.com/s/sourceserif4/v15/vEFF2_tTDB4M7-auWDN0ahZJW3IX2ih5nk3AucvUHf6kDXr4.woff2`
- `https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400..500&display=swap`
  → `https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxDcwg.woff2`

Plage Unicode du sous-ensemble `latin` : `U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6,
U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215,
U+FEFF, U+FFFD` — accents, `œ`/`Œ`, `’`, `«`/`»` et `€` compris.

Empreintes SHA-256 :

```
5ed4d31c988e73b258894244f209069ebe77dc7e564861954b21198b6de90d68  public-sans-latin.woff2
382475f38242c52d42a3e5ff8dc69b5d73f10d0d21e4550b5fe232984688779a  source-serif-4-latin.woff2
83c005d49d8a6a50474c73a5a36ac0468076e9c4a29da7bdb14995d80560a5be  jetbrains-mono-latin.woff2
```

## Origine des licences (SIL Open Font License 1.1)

Récupérées le 6 novembre 2026 depuis les dépôts officiels des familles :

- `public-sans-OFL.txt` : `LICENSE.md` de `uswds/public-sans`, branche `develop`, commit
  `2fbdcc075a9c483f20720998e4249b86fe5d5269`
- `source-serif-4-OFL.txt` : `LICENSE.md` de `adobe-fonts/source-serif`, branche `release`, commit
  `6e2784a47aad721b1980b03df9c9f318da15ad10`
- `jetbrains-mono-OFL.txt` : `OFL.txt` de `JetBrains/JetBrainsMono`, branche `master`, commit
  `61cf0cedc2d9d29efcab968e97707d6899133e68`
