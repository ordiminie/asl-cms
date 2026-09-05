'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {Edit} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {ReactNode, useState} from 'react'
import {useForm} from 'react-hook-form'
import {toast} from 'sonner'
import * as z from 'zod'

import {Button} from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {authClient} from '@/lib/better-auth/auth-client'
import {UserOrganizationRoleConst} from '@/services/types/domain/auth-types'

// Schéma de validation
const formSchema = z.object({
  role: z.enum([
    UserOrganizationRoleConst.OWNER,
    UserOrganizationRoleConst.ADMIN,
    UserOrganizationRoleConst.MEMBER,
  ]),
})

type FormValues = z.infer<typeof formSchema>

interface EditMemberRoleDialogProps {
  memberId: string
  memberName: string
  currentRole: string
  triggerButton?: ReactNode
}

export function EditMemberRoleDialog({
  memberId,
  memberName,
  currentRole,
  triggerButton,
}: EditMemberRoleDialogProps) {
  const t = useTranslations('Organization.members')
  const tRoles = useTranslations('Organization.roles')
  const tCommon = useTranslations('Common')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      role: currentRole as FormValues['role'],
    },
  })

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true)
    try {
      console.log('onSubmit', data)
      console.log('memberId', memberId)
      if (currentRole === UserOrganizationRoleConst.OWNER) {
        toast.error(t('ownerImmutable'))
        return
      }
      const {error} = await authClient.organization.updateMemberRole({
        memberId: memberId,
        role: data.role,
      })

      if (error) {
        toast.error(error.message)
        return
      }

      setIsDialogOpen(false)
      //
      toast.success(t('roleUpdated', {name: memberName}))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('roleUpdateError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        {triggerButton ? (
          triggerButton
        ) : (
          <Button variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" />
            {t('editRole')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('editRoleTitle', {name: memberName})}</DialogTitle>
          <DialogDescription>{t('editRoleDescription')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="role"
              render={({field}) => (
                <FormItem>
                  <FormLabel>{tCommon('fields.role')}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('selectRole')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={UserOrganizationRoleConst.OWNER}>
                        {tRoles('OWNER')}
                      </SelectItem>
                      <SelectItem value={UserOrganizationRoleConst.ADMIN}>
                        {tRoles('ADMIN')}
                      </SelectItem>
                      <SelectItem value={UserOrganizationRoleConst.MEMBER}>
                        {tRoles('MEMBER')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                {tCommon('actions.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('updating') : t('update')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
