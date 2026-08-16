---
description:
---

# Règle React Query - Guide d'Implémentation

## Vue d'ensemble

Cette règle définit comment implémenter React Query dans notre application Next.js 16 avec TypeScript, en suivant les patterns établis pour la gestion des projets.

## Architecture React Query

### Structure des dossiers

```
src/
├── components/
│   ├── context/
│   │   └── query-provider.tsx          # Configuration React Query
│   ├── hooks/client/
│   │   └── entity-client.ts           # Hooks React Query par entité
│   └── features/entity/
│       ├── entity-management.tsx   # Composant principal
│       ├── create-entity-dialog.tsx # Dialog création
│       ├── edit-entity-dialog.tsx   # Dialog édition
│       └── delete-entity-dialog.tsx # Dialog suppression
└── lib/api/
    ├── api-client.ts                   # Client API générique
    └── entity-api.ts                   # API spécifique à l'entité
```

## Configuration Provider

### QueryProvider Setup

Référence : [query-provider.tsx](src/components/context/query-provider.tsx)

```typescript
// Configuration du QueryClient avec options optimisées
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error) => {
        // Pas de retry sur erreurs 4xx
        if (error && typeof error === 'object' && 'status' in error) {
          const statusError = error as {status: number}
          if (statusError.status >= 400 && statusError.status < 500) {
            return false
          }
        }
        return failureCount < 3
      },
    },
    mutations: {
      retry: 1,
    },
  },
})
```

### Intégration dans AppProviders

Référence : [app-providers.tsx](src/components/context/app-providers.tsx)

```typescript
// Wrapper QueryProvider au niveau racine
<QueryProvider>
  <ThemeProvider>
    <AuthProvider>
      {children}
    </AuthProvider>
  </ThemeProvider>
</QueryProvider>
```

## API Client Pattern

### Client API générique

Référence : [api-client.ts](src/lib/api/api-client.ts)

```typescript
// Classe d'erreur personnalisée
export class ApiError extends Error {
  constructor(
    public message: string,
    public status: number,
    public statusText: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Client API avec gestion d'erreurs
export async function apiClient<T>(
  endpoint: string,
  options: globalThis.RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    throw new ApiError(
      `API Error: ${response.statusText}`,
      response.status,
      response.statusText
    )
  }

  return response.json()
}
```

### API spécifique par entité

Référence : [projects-api.ts](src/lib/api/projects-api.ts)

```typescript
// Types de réponse standardisés
export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    total: number // ← Nombre total d'éléments
    page: number // ← Page actuelle
    limit: number // ← Éléments par page
    totalPages: number // ← Nombre total de pages
  }
}

// Fonctions API CRUD complètes
export const entityApi = {
  getEntities: async (params) =>
    apiClient<PaginatedResponse<EntityDTO>>(`/api/entities?${searchParams}`),
  getEntity: async (id) =>
    apiClient<ApiResponse<EntityDTO>>(`/api/entities/${id}`),
  createEntity: async (data) =>
    apiClient<ApiResponse<EntityDTO>>('/api/entities', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateEntity: async (id, data) =>
    apiClient<ApiResponse<EntityDTO>>(`/api/entities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteEntity: async (id) =>
    apiClient<ApiResponse<void>>(`/api/entities/${id}`, {method: 'DELETE'}),
}
```

## Hooks React Query Pattern

### Structure des Query Keys

Référence : [project-client.ts](src/components/hooks/client/project-client.ts)

```typescript
// Hiérarchie de clés pour invalidation précise
export const entityKeys = {
  all: ['entities'] as const,
  lists: () => [...entityKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) =>
    [...entityKeys.lists(), params] as const,
  details: () => [...entityKeys.all, 'detail'] as const,
  detail: (id: string) => [...entityKeys.details(), id] as const,
}
```

### Hooks de lecture (Queries)

```typescript
// Hook liste avec pagination et cache optimisé
export function useEntities(params: {
  page?: number
  limit?: number
  search?: string
  organizationId?: string
}) {
  return useQuery({
    queryKey: entityKeys.list(params),
    queryFn: () => entityApi.getEntities(params),
    placeholderData: (previousData) => previousData, // Garde les données pendant rechargement
  })
}

// Hook détail avec enable conditionnel
export function useEntity(id: string) {
  return useQuery({
    queryKey: entityKeys.detail(id),
    queryFn: () => entityApi.getEntity(id),
    enabled: !!id, // Ne s'exécute que si ID fourni
  })
}
```

### Hooks de mutation (Mutations)

```typescript
// Hook création avec invalidation automatique
export function useCreateEntity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateEntity) => entityApi.createEntity(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({queryKey: entityKeys.lists()})
      toast.success(response.message || 'Entité créée avec succès')
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? (error.message as string)
          : 'Erreur lors de la création'
      toast.error(message)
    },
  })
}

// Hook mise à jour avec invalidation ciblée
export function useUpdateEntity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({id, data}: {id: string; data: Partial<UpdateEntity>}) =>
      entityApi.updateEntity(id, data),
    onSuccess: (response, variables) => {
      // Invalider listes + détail spécifique
      queryClient.invalidateQueries({queryKey: entityKeys.lists()})
      queryClient.invalidateQueries({queryKey: entityKeys.detail(variables.id)})
      toast.success(response.message || 'Entité mise à jour avec succès')
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? (error.message as string)
          : 'Erreur lors de la mise à jour'
      toast.error(message)
    },
  })
}
```

## Composants React Query Pattern

### Composant principal de gestion

Référence : [projects-management-react-query.tsx](src/components/features/projects/react-query/projects-management-react-query.tsx)

```typescript
export function EntityManagementReactQuery({ organization, searchParams }: Props) {
  const searchStore = use(searchParams)

  // États locaux pour pagination/recherche
  const [page, setPage] = useState(Number(searchStore.page) || 1)
  const [limit, setLimit] = useState(Number(searchStore.limit) || 20)
  const [search, setSearch] = useState(searchStore.search || '')

  // ID réel depuis l'organisation
  const organizationId = organization.id

  // Hooks React Query
  const { data: entitiesResponse, isLoading, isError, error } = useEntities({
    page, limit, search, organizationId,
  })

  const updateMutation = useUpdateEntity()
  const deleteMutation = useDeleteEntity()

  // Handlers pour interactions
  const handleSearch = (newSearch: string) => {
    setSearch(newSearch)
    setPage(1)
  }

  const handleUpdate = async (id: string, data: { name: string; description?: string }) => {
    updateMutation.mutate({ id, data })
  }

  // Gestion des états
  if (isLoading) return <LoadingComponent />
  if (isError) return <ErrorComponent error={error} />

  // Rendu principal avec données
  return <TableComponent entities={entitiesResponse?.data} />
}
```

### Dialog de création

Référence : [create-project-dialog-rq.tsx](src/components/features/projects/react-query/create-project-dialog-rq.tsx)

```typescript
export function CreateEntityDialog({ organizationId, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const createMutation = useCreateEntity()
  const user = authClient.useSession() // Récupération user authentifié

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  })

  const onSubmit = async (data: FormData) => {
    createMutation.mutate({
      ...data,
      organizationId,
      createdBy: user.data?.user.id, // User ID réel
    }, {
      onSuccess: () => {
        setOpen(false)
        form.reset()
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {/* Champs formulaire */}
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Création...' : 'Créer'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

### Dialog d'édition

Référence : [edit-project-dialog-rq.tsx](src/components/features/projects/react-query/edit-project-dialog-rq.tsx)

```typescript
export function EditEntityDialog({ entity, onSave, isLoading }: Props) {
  const [open, setOpen] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: entity.name,
      description: entity.description || '',
    },
  })

  const onSubmit = async (data: FormData) => {
    await onSave(entity.id, data)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Edit className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Modifier</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {/* Champs formulaire */}
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Mise à jour...' : 'Mettre à jour'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

### Dialog de suppression

Référence : [delete-project-dialog-rq.tsx](src/components/features/projects/react-query/delete-project-dialog-rq.tsx)

```typescript
export function DeleteEntityDialog({ entityId, entityName, onDelete, isLoading }: Props) {
  const [open, setOpen] = useState(false)

  const handleDelete = async () => {
    await onDelete(entityId)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer l'entité</DialogTitle>
          <DialogDescription>
            Êtes-vous sûr de vouloir supprimer <strong>{entityName}</strong> ?
            Cette action est irréversible.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
            {isLoading ? 'Suppression...' : 'Supprimer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

## Pagination Unifiée React Query

### Structure de réponse standardisée

Toutes les APIs retournent une structure de pagination uniforme :

```typescript
// Réponse API standardisée
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 25,        // ← Nombre total d'éléments
    "page": 1,          // ← Page actuelle
    "limit": 10,        // ← Éléments par page
    "totalPages": 3     // ← Nombre total de pages
  }
}
```

### Utilisation dans les composants

```typescript
export function EntityManagementReactQuery({ organization, searchParams }: Props) {
  const { data: entitiesResponse } = useEntities({
    page, limit, search, organizationId,
  })

  // Extraction des données et pagination
  const entities = entitiesResponse?.data || []
  const pagination = entitiesResponse?.pagination || {
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  }

  return (
    <>
      <TableComponent entities={entities} />
      <ProjectsPagination
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={handlePageChange}
      />
    </>
  )
}
```

### Gestion des états par défaut

Toujours prévoir des valeurs par défaut pour éviter les erreurs :

```typescript
const pagination = entitiesResponse?.pagination || {
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 0,
}
```

## Intégration avec l'authentification

### Récupération utilisateur authentifié

```typescript
// Dans les composants React Query
const user = authClient.useSession()

// Utilisation dans les mutations
createMutation.mutate({
  ...data,
  createdBy: user.data?.user.id,
})
```

## Bonnes pratiques

### 1. Query Keys hiérarchiques

- Structure cohérente pour invalidation précise
- Utilisation de `const` assertions pour type safety

### 2. Gestion des erreurs

- Classe `ApiError` personnalisée
- Messages d'erreur utilisateur contextuels
- Toast notifications automatiques

### 3. États de chargement

- `isLoading`, `isPending` pour UX fluide
- Placeholder data pour éviter les clignotements
- États de chargement granulaires par action

### 4. Cache et performance

- `staleTime` et `gcTime` optimisés
- Invalidation ciblée vs globale
- Prefetch pour chargement anticipé

### 5. Types TypeScript

- Types stricts pour requêtes et réponses
- Inférence automatique avec Zod
- Interfaces cohérentes entre API et hooks

## Checklist d'implémentation

### Nouvelle entité React Query

- [ ] Créer `entity-api.ts` avec CRUD complet
- [ ] Créer `entity-client.ts` avec hooks + query keys
- [ ] Créer composants dialog (create, edit, delete)
- [ ] Créer composant principal de gestion
- [ ] Intégrer dans routing Next.js
- [ ] Tests des hooks et composants

### Configuration projet

- [ ] QueryProvider configuré dans app-providers
- [ ] DevTools activés en développement
- [ ] Types API response standardisés
- [ ] Gestion d'erreurs centralisée
- [ ] Authentication hooks intégrés

Cette architecture garantit une implémentation React Query cohérente, performante et maintenable à travers toute l'application.
