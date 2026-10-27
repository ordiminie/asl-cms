'use client'

import {AlertTriangle} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {type ReactNode, useId, useState} from 'react'

import {Alert, AlertDescription} from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {Button} from '@/components/ui/button'
import {Label} from '@/components/ui/label'
import {RadioGroup, RadioGroupItem} from '@/components/ui/radio-group'
import {cn} from '@/lib/utils'
import type {MemberAccountRole} from '@/services/types/domain/member-account-types'
import type {MemberProfileDTO} from '@/services/types/domain/member-profile-types'
import type {MemberRoleCardDTO} from '@/services/types/domain/member-role-types'

import {DetailCard} from './member-profile-detail-card'
import type {ChangeMemberRoleFormAction} from './member-profile-form-validation'

type MemberRoleCardProps = {
  profile: Pick<MemberProfileDTO, 'id' | 'name' | 'roleCard'>
  action: ChangeMemberRoleFormAction
  /** Le role est enregistre : la fiche le confirme en haut (A3, A8). */
  onSaved: (message: string) => void
}

const strong = (chunks: ReactNode) => <strong>{chunks}</strong>

const BUTTON_CLASS = 'h-14 w-full text-base sm:h-11 sm:w-auto'

/**
 * Carte « Role dans l'association » (s14, ecran A) : une phrase toujours
 * ecrite, puis la modification en place par un `radio-group`. La passation
 * de la presidence passe par un `alert-dialog`, seul acte sans retour.
 */
export function MemberRoleCard({
  profile,
  action,
  onSaved,
}: MemberRoleCardProps) {
  const t = useTranslations('BureauMemberProfilesPage.detail.role')
  const [editing, setEditing] = useState(false)

  return (
    <DetailCard title={t('title')}>
      {editing ? (
        <RoleForm
          profile={profile}
          action={action}
          onCancel={() => setEditing(false)}
          onDone={(message) => {
            setEditing(false)
            if (message) onSaved(message)
          }}
        />
      ) : (
        <RoleReading
          name={profile.name}
          card={profile.roleCard}
          onEdit={() => setEditing(true)}
        />
      )}
    </DetailCard>
  )
}

/** Lecture : la phrase du role, puis le bouton ou la phrase qui le remplace. */
function RoleReading({
  name,
  card,
  onEdit,
}: {
  name: string
  card: MemberRoleCardDTO
  onEdit: () => void
}) {
  const t = useTranslations('BureauMemberProfilesPage.detail.role')

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[17px]">
        {card.reading === 'no_account'
          ? t('reading.no_account')
          : t.rich(`reading.${card.reading}`, {name, strong})}
      </p>
      {card.notice && (
        <p className="text-muted-foreground text-[15px]">
          {t(`notices.${card.notice}`)}
        </p>
      )}
      {card.canEdit && (
        <div>
          <Button
            type="button"
            variant="outline"
            className={BUTTON_CLASS}
            onClick={onEdit}
          >
            {t('edit')}
          </Button>
        </div>
      )}
    </div>
  )
}

/** Modification en place : choix, avertissement, enregistrement (A2 a A10). */
function RoleForm({
  profile,
  action,
  onCancel,
  onDone,
}: {
  profile: MemberRoleCardProps['profile']
  action: ChangeMemberRoleFormAction
  onCancel: () => void
  onDone: (message: string | null) => void
}) {
  const t = useTranslations('BureauMemberProfilesPage.detail.role')
  const fieldId = useId()
  const card = profile.roleCard
  const saved = card.reading === 'no_account' ? null : card.reading
  const [choice, setChoice] = useState<MemberAccountRole | null>(saved)
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const submit = async (role: MemberAccountRole) => {
    setPending(true)
    setFailure(null)
    const formData = new FormData()
    formData.set('memberProfileId', profile.id)
    formData.set('role', role)

    const result = await action(undefined, formData)
    setPending(false)
    if (result.status === 'saved') {
      onDone(result.message)
    } else {
      setFailure(result.message)
    }
  }

  const onSave = () => {
    if (!choice || choice === saved) {
      onDone(null)
    } else if (choice === 'owner') {
      setConfirming(true)
    } else {
      void submit(choice)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {failure && (
        <Alert
          variant="destructive"
          className="border-destructive border-2 [&>svg]:size-5"
        >
          <AlertTriangle aria-hidden="true" />
          <AlertDescription className="text-foreground text-base">
            {failure}
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-3">
        <Label id={`${fieldId}-legend`} className="text-[16px] font-medium">
          {t('legend')}
        </Label>
        <RadioGroup
          aria-labelledby={`${fieldId}-legend`}
          value={choice ?? undefined}
          onValueChange={(value) => setChoice(value as MemberAccountRole)}
          className="gap-3"
        >
          {card.options.map((role) => (
            <RoleOption
              key={role}
              id={`${fieldId}-${role}`}
              role={role}
              selected={choice === role}
            />
          ))}
        </RadioGroup>
      </div>
      {choice && choice !== saved && choice !== 'owner' && (
        <RoleWarning name={profile.name} role={choice} self={card.self} />
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          disabled={pending}
          className={BUTTON_CLASS}
          onClick={onSave}
        >
          {pending ? t('saving') : t('save')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={BUTTON_CLASS}
          onClick={onCancel}
        >
          {t('cancel')}
        </Button>
      </div>
      <TransferDialog
        name={profile.name}
        open={confirming}
        onOpenChange={setConfirming}
        onConfirm={() => {
          setConfirming(false)
          void submit('owner')
        }}
      />
    </div>
  )
}

function RoleOption({
  id,
  role,
  selected,
}: {
  id: string
  role: MemberAccountRole
  selected: boolean
}) {
  const t = useTranslations('BureauMemberProfilesPage.detail.role.options')

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-md border p-4',
        selected ? 'border-primary border-2' : 'border-border'
      )}
    >
      <RadioGroupItem
        id={id}
        value={role}
        aria-describedby={`${id}-help`}
        className="mt-1"
      />
      <div className="flex flex-col gap-1">
        <Label htmlFor={id} className="text-[16px] font-medium">
          {t(`${role}.label`)}
        </Label>
        <p id={`${id}-help`} className="text-muted-foreground text-[15px]">
          {t(`${role}.help`)}
        </p>
      </div>
    </div>
  )
}

/** Encart `warning` avant l'ecriture, des que le choix differe (A2, A4, A9). */
function RoleWarning({
  name,
  role,
  self,
}: {
  name: string
  role: MemberAccountRole
  self: boolean
}) {
  const t = useTranslations('BureauMemberProfilesPage.detail.role.warnings')
  const key = role === 'board' ? 'board' : self ? 'memberSelf' : 'member'

  return (
    <Alert className="border-warning-border bg-warning text-warning-foreground border-2 [&>svg]:size-5">
      <AlertTriangle aria-hidden="true" />
      <AlertDescription className="text-warning-foreground text-base">
        <p>{t.rich(key, {name, strong})}</p>
      </AlertDescription>
    </Alert>
  )
}

/** Passation (A7) : ancree en bas sur mobile, boutons empiles. */
function TransferDialog({
  name,
  open,
  onOpenChange,
  onConfirm,
}: {
  name: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const t = useTranslations('BureauMemberProfilesPage.detail.role.transfer')

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('title', {name})}</AlertDialogTitle>
          <AlertDialogDescription className="text-foreground text-base">
            {t('description', {name})}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-14 sm:h-11">
            {t('cancel')}
          </AlertDialogCancel>
          <AlertDialogAction className="h-14 sm:h-11" onClick={onConfirm}>
            {t('confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
