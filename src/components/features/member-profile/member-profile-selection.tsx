'use client'

import {CircleCheck} from 'lucide-react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useTranslations} from 'next-intl'
import {
  createContext,
  type ReactNode,
  useContext,
  useId,
  useState,
  useTransition,
} from 'react'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Checkbox} from '@/components/ui/checkbox'
import {Label} from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  RecipientGroupDTO,
  RecipientGroupSelectionActionResult,
} from '@/services/types/domain/recipient-group-types'

import {
  RECIPIENT_GROUPS_PATH,
  recipientGroupPathOf,
} from '../recipient-groups/recipient-group-paths'
import {memberProfilesListPathOf} from './member-profile-paths'

/**
 * Selection des fiches de la page affichee et barre d'action groupee (s27,
 * ecran 2, gap 1 du design retenu au plan) : une case par ligne, une case de
 * page dans l'en-tete, une barre qui apparait des qu'une fiche est cochee.
 * La selection ne survit pas a un changement de page.
 */

type SelectionAction = (
  state: RecipientGroupSelectionActionResult | undefined,
  formData: FormData
) => Promise<RecipientGroupSelectionActionResult>

export type MemberProfileGroupSelection = {
  groups: RecipientGroupDTO[]
  /** Le groupe du filtre « Groupe », ou rien : « Tous les propriétaires ». */
  groupId?: string
  addAction: SelectionAction
  removeAction: SelectionAction
}

type SelectionState = {
  pageIds: string[]
  selected: string[]
  toggle: (id: string, checked: boolean) => void
  togglePage: (checked: boolean) => void
  clear: () => void
}

const SelectionContext = createContext<SelectionState | null>(null)

const useSelection = (): SelectionState => {
  const selection = useContext(SelectionContext)
  if (!selection) throw new Error('Selection hors de son fournisseur')
  return selection
}

export function MemberProfileSelectionProvider({
  pageIds,
  children,
}: {
  pageIds: string[]
  children: ReactNode
}) {
  const [selected, setSelected] = useState<string[]>([])

  const toggle = (id: string, checked: boolean) =>
    setSelected((current) =>
      checked
        ? pageIds.filter((candidate) => [...current, id].includes(candidate))
        : current.filter((candidate) => candidate !== id)
    )
  const togglePage = (checked: boolean) =>
    setSelected(checked ? [...pageIds] : [])

  return (
    <SelectionContext.Provider
      value={{
        pageIds,
        selected,
        toggle,
        togglePage,
        clear: () => setSelected([]),
      }}
    >
      {children}
    </SelectionContext.Provider>
  )
}

export function RowSelectCheckbox({id, name}: {id: string; name: string}) {
  const t = useTranslations('BureauMemberProfilesPage.recipientGroups')
  const {selected, toggle} = useSelection()

  return (
    <Checkbox
      checked={selected.includes(id)}
      onCheckedChange={(checked) => toggle(id, checked === true)}
      aria-label={t('selectRow', {name})}
      className="size-5"
    />
  )
}

export function PageSelectCheckbox() {
  const t = useTranslations('BureauMemberProfilesPage.recipientGroups')
  const {selected, pageIds, togglePage} = useSelection()
  const all = pageIds.length > 0 && selected.length === pageIds.length

  return (
    <Checkbox
      checked={all ? true : selected.length > 0 ? 'indeterminate' : false}
      onCheckedChange={(checked) => togglePage(checked === true)}
      aria-label={t('selectPage')}
      className="size-5"
    />
  )
}

/** Le filtre « Groupe » de la barre d'outils, qui voyage dans l'URL. */
export function GroupFilter({
  groups,
  groupId,
  search,
}: {
  groups: RecipientGroupDTO[]
  groupId?: string
  search?: string
}) {
  const t = useTranslations('BureauMemberProfilesPage.recipientGroups')
  const router = useRouter()
  const fieldId = useId()
  const ALL = 'all'

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={fieldId} className="text-[17px]">
        {t('filterLabel')}
      </Label>
      <Select
        value={groupId ?? ALL}
        onValueChange={(value) =>
          router.push(
            memberProfilesListPathOf({
              search,
              groupId: value === ALL ? undefined : value,
            })
          )
        }
      >
        <SelectTrigger id={fieldId} className="h-14 w-full sm:h-11 sm:w-72">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('filterAll')}</SelectItem>
          {groups.map((group) => (
            <SelectItem key={group.id} value={group.id}>
              {group.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

type Outcome = {
  kind: 'added' | 'removed'
  result: RecipientGroupSelectionActionResult
} | null

/**
 * La barre de selection : le decompte annonce, puis « Ajouter au groupe »,
 * ou « Retirer du groupe » quand la liste est filtree sur un groupe. Le
 * resultat reste affiche apres l'action, la selection videe au succes.
 */
export function SelectionBar({
  groups,
  groupId,
  addAction,
  removeAction,
}: MemberProfileGroupSelection) {
  const {selected, clear} = useSelection()
  const [outcome, setOutcome] = useState<Outcome>(null)

  return (
    <div className="flex flex-col gap-4">
      {outcome && <OutcomeAlert outcome={outcome} />}
      {selected.length > 0 && (
        <SelectionActions
          groups={groups}
          groupId={groupId}
          selected={selected}
          onDone={(kind, result) => {
            setOutcome({kind, result})
            if (result.status === 'saved') clear()
          }}
          addAction={addAction}
          removeAction={removeAction}
        />
      )}
    </div>
  )
}

function SelectionActions({
  groups,
  groupId,
  selected,
  onDone,
  addAction,
  removeAction,
}: MemberProfileGroupSelection & {
  selected: string[]
  onDone: (
    kind: 'added' | 'removed',
    result: RecipientGroupSelectionActionResult
  ) => void
}) {
  const t = useTranslations('BureauMemberProfilesPage.recipientGroups')
  const [target, setTarget] = useState(groups[0]?.id ?? '')
  const [pending, startTransition] = useTransition()
  const fieldId = useId()

  const run = (kind: 'added' | 'removed', chosen: string) =>
    startTransition(async () => {
      const formData = new FormData()
      formData.set('groupId', chosen)
      for (const id of selected) formData.append('memberProfileIds', id)
      const action = kind === 'added' ? addAction : removeAction
      onDone(kind, await action(undefined, formData))
    })

  return (
    <div className="border-primary flex flex-col gap-3 rounded-lg border-2 p-4 sm:flex-row sm:flex-wrap sm:items-end">
      <p aria-live="polite" className="text-[17px] font-semibold sm:mr-auto">
        {t('selected', {count: selected.length})}
      </p>
      {groupId ? (
        <Button
          type="button"
          variant="outline"
          className="h-14 w-full sm:h-11 sm:w-auto"
          disabled={pending}
          onClick={() => run('removed', groupId)}
        >
          {t('remove')}
        </Button>
      ) : groups.length === 0 ? (
        <p className="text-[17px]">
          {t('noGroup')}{' '}
          <Link href={RECIPIENT_GROUPS_PATH} className="text-primary underline">
            {t('createGroup')}
          </Link>
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor={fieldId} className="text-[15px]">
              {t('addTarget')}
            </Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger
                id={fieldId}
                className="h-14 w-full sm:h-11 sm:w-64"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-14 w-full sm:h-11 sm:w-auto"
            disabled={pending}
            onClick={() => run('added', target)}
          >
            {t('add')}
          </Button>
        </>
      )}
    </div>
  )
}

function OutcomeAlert({outcome}: {outcome: NonNullable<Outcome>}) {
  const t = useTranslations('BureauMemberProfilesPage.recipientGroups')
  const {kind, result} = outcome

  if (result.status === 'error') {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTitle className="text-[15px] whitespace-normal">
          {result.message}
        </AlertTitle>
      </Alert>
    )
  }
  return (
    <Alert role="status">
      <CircleCheck aria-hidden="true" className="text-primary" />
      <AlertTitle className="text-[15px] whitespace-normal">
        {t(kind, {
          count: result.changed,
          name: result.groupName,
          total: result.profileCount,
        })}
      </AlertTitle>
      <AlertDescription>
        <Link
          href={recipientGroupPathOf(result.groupId)}
          className="text-primary underline"
        >
          {t('openGroup')}
        </Link>
      </AlertDescription>
    </Alert>
  )
}
