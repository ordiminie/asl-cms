---
description: Sécurisation des Routes et Layouts sous Cache Components
paths:
  - '**page.tsx'
  - '**layout.tsx'
---

# Sécurisation des Routes et Layouts

Sous `cacheComponents`, une route authentifiée doit rester sécurisée **sans**
bloquer son shell. D'où un contrôle en quatre niveaux, chacun avec un rôle
précis.

## Les quatre niveaux

| Niveau            | Où                          | Ce qu'il décide                                      |
| ----------------- | --------------------------- | ---------------------------------------------------- |
| 0. Proxy          | `src/proxy.ts`              | pas de cookie de session → redirect `/login`         |
| 1. Route          | layout ou page (`withAuth`) | rôle insuffisant → UI `forbidden()`, mais statut 200 |
| 2. Server Actions | `requireActionAuth()`       | chaque mutation revérifie la session                 |
| 3. Services / DAL | autorisation CASL           | qui a le droit sur quelle ressource                  |

Le niveau 0 est un **garde-fou de routage**, pas une preuve : la présence d'un
cookie ne dit rien de sa validité. Il existe pour trancher avant le premier
octet — sous streaming, un `redirect()` déclenché en cours de rendu part après le
début d'un `200` et ne peut plus changer le statut. La sécurité réelle reste aux
niveaux 2 et 3, au plus près de la donnée.

⚠️ **Le niveau 1 ne rend pas un vrai 403, et `instant = false` n'y change rien.**
Sous Cache Components, **toute** route dynamique streame un shell d'abord : quand
`forbidden()` est levé, le statut est déjà parti. Mesuré : `/admin` visité par un
utilisateur standard rend un `200` portant l'UI forbidden (e2e
`authorization.spec.ts`). Aucun contenu protégé ne fuit — la doc juge d'ailleurs
ce compromis acceptable pour une page — mais si le code de statut compte, le
contrôle de rôle doit remonter dans le proxy. C'est ce que prescrit
[la doc de `forbidden`](https://nextjs.org/docs/app/api-reference/functions/forbidden) :
« run that check in `proxy` instead ».

**La portée est bornée au rendu de page.** Les Route Handlers ne streament aucun
shell : `src/lib/api-auth.ts` rend bien `401` sans session et `403` sur rôle
insuffisant, et c'est vérifié dans `e2e/authorization.spec.ts`. La couche où un
code de statut est réellement consommé — clients d'API, monitoring — n'est donc
pas concernée.

## La règle d'or des layouts

**Ne jamais `await` la session au niveau supérieur d'un layout.** Ça tient tout
le segment derrière la requête, `{children}` compris, et le shell statique est
perdu.

Le layout crée la promesse et la passe telle quelle :

```tsx
// src/app/[locale]/(app)/layout.tsx
import {getCurrentUserDal} from '@/app/dal/user-dal'

export default function AppLayout({children}: {children: React.ReactNode}) {
  const userPromise = getCurrentUserDal() // créée, jamais attendue

  return (
    <AuthProvider userPromise={userPromise}>
      <OrganizationProvider>
        <Suspense fallback={null}>
          <UserPreferencesSync />
          <OrganizationSync />
        </Suspense>
        <Suspense fallback={<SidebarSkeleton />}>
          <AppSidebar />
        </Suspense>
        {children}
      </OrganizationProvider>
    </AuthProvider>
  )
}
```

`getCurrentUserDal()` est en `'use cache: private'` : la seule directive
autorisée à lire `cookies()` / `headers()`, avec un résultat gardé côté
navigateur et jamais sur le serveur. Elle redirige vers `/login` si la session
est absente. Détail dans
[rule-react-cache-next-cache.md](rule-react-cache-next-cache.md).

**Côté client**, `useAuth()` et `useOrganization()` déroulent la promesse avec
`use()` : ils **suspendent**, donc ne s'appellent que depuis un composant placé
derrière un `<Suspense>`. Un provider qui suspend emporte `{children}` avec lui —
c'est pour ça que les effets vivent dans `UserPreferencesSync` et
`OrganizationSync` plutôt que dans les providers.

## Le contrôle de rôle : `withAuth`

`withAuth` (et son raccourci `withAuthAdmin`) fait un `await` sur la session,
redirige si non authentifié, appelle `forbidden()` si le rôle manque, et injecte
`user` en prop.

```tsx
// Sur une page : la page streame derrière le loading.tsx du segment
export default withAuth(Page)
export default withAuthAdmin(AdminPage)
```

Sur un **layout**, l'`await` de `withAuth` tient le segment : la route doit alors
porter `export const instant = false` avec la raison écrite dans le fichier.
C'est le cas de `admin/layout.tsx`. Ne pas croire que cet opt-out achète le
statut 403 — il n'achète que le droit de bloquer.

```tsx
// src/app/[locale]/admin/layout.tsx
export const instant = false // withAuthAdmin await la session en tête de layout

function AdminLayout({
  children,
  user,
}: {children: React.ReactNode} & WithAuthProps) {
  return (
    <AuthProvider userPromise={getCurrentUserDal()}>
      <AdminSidebar user={user} />
      {children}
    </AuthProvider>
  )
}

export default withAuthAdmin(AdminLayout)
```

Pour une section **sans contrôle de rôle** (le groupe `(app)`), aucun `withAuth`
sur le layout : le proxy fait le gating, `getCurrentUserDal()` redirige, et la
route garde son shell statique.

## À faire / à éviter

✅ **À faire**

- Créer la promesse de session dans le layout, la passer aux providers.
- Mettre chaque consommateur de `useAuth()` / `useOrganization()` derrière un
  `<Suspense>` avec un fallback de même gabarit (sinon le contenu saute).
- Ajouter le segment protégé à `AUTHENTICATED_SEGMENTS` dans `src/proxy.ts`.
- Protéger la Server Action associée avec `requireActionAuth()`, toujours.

❌ **À éviter**

- `await getAuthUser()` en tête de layout — bloque tout le segment.
- Appeler `useAuth()` dans un provider : il suspendrait `{children}`.
- Se reposer sur le proxy pour la sécurité : il ne valide rien.
- `withAuth` sur un composant client : les HOCs sont des Server Components.

## Checklist

- [ ] Le segment est listé dans `AUTHENTICATED_SEGMENTS` (`src/proxy.ts`)
- [ ] Le layout ne fait aucun `await` sur la session
- [ ] Chaque consommateur de la session est derrière un `<Suspense>`
- [ ] Contrôle de rôle : `withAuth`/`withAuthAdmin` + `instant = false` justifié
      dans le fichier si c'est sur un layout
- [ ] Server Actions protégées par `requireActionAuth()`
- [ ] Autorisation métier dans les services (CASL), jamais dans l'UI seule
- [ ] Couvert par `e2e/authorization.spec.ts` : redirect sans session, contenu
      protégé qui ne fuit pas, accès légitime qui passe
