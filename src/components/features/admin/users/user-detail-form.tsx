'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {ArrowLeft, Building2, Calendar, Shield, User, Zap} from 'lucide-react'
import Link from 'next/link'
import {useLocale, useTranslations} from 'next-intl'
import {useState} from 'react'
import {useForm, useWatch} from 'react-hook-form'
import {toast} from 'sonner'
import {z} from 'zod'

import {updateUserDetailAction} from '@/app/[locale]/admin/users/actions'
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {Input} from '@/components/ui/input'
import {Progress} from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {Switch} from '@/components/ui/switch'
import {Textarea} from '@/components/ui/textarea'
import {AdminUserOrganizationWithUsage} from '@/services/organization-service'
import {User as UserType} from '@/services/types/domain/user-types'

const userDetailSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  email: z.string().email('Format email invalide'),
  role: z.enum([
    'public',
    'user',
    'redactor',
    'moderator',
    'admin',
    'super_admin',
  ]),
  visibility: z.enum(['public', 'private']),
  banned: z.boolean(),
  banReason: z.string().optional(),
  banExpires: z.string().optional(),
  twoFactorEnabled: z.boolean(),
  emailVerified: z.boolean(),
})

type UserDetailFormData = z.infer<typeof userDetailSchema>

const toBanExpiresInSeconds = (banExpires?: string) =>
  banExpires
    ? Math.floor((new Date(banExpires).getTime() - Date.now()) / 1000)
    : undefined

interface UserDetailFormProps {
  user: UserType
  permissions: {
    canCreate: boolean
    canEdit: boolean
    canDelete: boolean
    canManage: boolean
  }
  organizationsWithUsage: AdminUserOrganizationWithUsage[]
}

export default function UserDetailForm({
  user,
  permissions,
  organizationsWithUsage,
}: UserDetailFormProps) {
  const t = useTranslations('AdminUsers')
  const locale = useLocale()
  const tCommon = useTranslations('Common')
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<UserDetailFormData>({
    resolver: zodResolver(userDetailSchema),
    defaultValues: {
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'user',
      visibility: user.visibility || 'private',
      banned: user.banned || false,
      banReason: user.banReason || '',
      banExpires: user.banExpires
        ? new Date(user.banExpires).toISOString().split('T')[0]
        : '',
      twoFactorEnabled: user.twoFactorEnabled || false,
      emailVerified: user.emailVerified || false,
    },
  })

  const isBanned = useWatch({control: form.control, name: 'banned'})

  const onSubmit = async (data: UserDetailFormData) => {
    setIsLoading(true)
    try {
      // Mettre à jour toutes les informations incluant les données de ban
      const updateData = {
        name: data.name,
        email: data.email,
        role: data.role,
        visibility: data.visibility,
        banned: data.banned,
        banReason: data.banReason,
        banExpiresIn: toBanExpiresInSeconds(data.banExpires),
        twoFactorEnabled: data.twoFactorEnabled,
        emailVerified: data.emailVerified,
      }

      const result = await updateUserDetailAction(user.id, updateData)

      if (result.success) {
        toast.success(result.message)
        // router.refresh()
      } else {
        toast.error(result.message)
        // Gérer les erreurs de validation spécifiques
        if (result.errors) {
          result.errors.forEach((error) => {
            form.setError(error.field as keyof UserDetailFormData, {
              message: error.message,
            })
          })
        }
      }
    } catch (error) {
      toast.error(t('updateError'))
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return t('notSet')
    return new Date(date).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatUsage = (used: number, limit: number | null) => {
    if (limit === null || limit === -1) {
      return `${used} / ∞`
    }
    return `${used} / ${limit}`
  }

  const getUsagePercent = (used: number, limit: number | null) => {
    if (limit === null || limit === -1 || limit === 0) return 0
    return Math.min((used / limit) * 100, 100)
  }

  const getProgressColor = (used: number, limit: number | null) => {
    if (limit === null || limit === -1) return 'bg-green-500'
    const ratio = used / limit
    if (ratio >= 1) return 'bg-red-500'
    if (ratio >= 0.8) return 'bg-orange-500'
    return 'bg-green-500'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/users" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Retour à la liste
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Informations générales */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t('personalInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({field}) => (
                        <FormItem>
                          <FormLabel>{t('fullName')}</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={!permissions.canEdit}
                              placeholder={t('namePlaceholder')}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({field}) => (
                        <FormItem>
                          <FormLabel>{tCommon('fields.email')}</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              disabled={!permissions.canEdit}
                              placeholder={t('emailPlaceholder')}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="role"
                      render={({field}) => (
                        <FormItem>
                          <FormLabel>{tCommon('fields.role')}</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            disabled={!permissions.canManage}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('selectRole')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="public">
                                {tCommon('states.public')}
                              </SelectItem>
                              <SelectItem value="user">
                                {t('roles.user')}
                              </SelectItem>
                              <SelectItem value="redactor">
                                {t('roles.redactor')}
                              </SelectItem>
                              <SelectItem value="moderator">
                                {t('roles.moderator')}
                              </SelectItem>
                              <SelectItem value="admin">
                                {t('roles.admin')}
                              </SelectItem>
                              <SelectItem value="super_admin">
                                {t('roles.super_admin')}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="visibility"
                      render={({field}) => (
                        <FormItem>
                          <FormLabel>{tCommon('fields.visibility')}</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            disabled={!permissions.canEdit}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={t('selectVisibility')}
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="public">
                                {tCommon('states.public')}
                              </SelectItem>
                              <SelectItem value="private">
                                {tCommon('states.private')}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="emailVerified"
                      render={({field}) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              {t('emailVerified')}
                            </FormLabel>
                            <FormDescription>
                              {t('emailVerifiedDescription')}
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={!permissions.canEdit}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="twoFactorEnabled"
                      render={({field}) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              {t('twoFactor')}
                            </FormLabel>
                            <FormDescription>
                              {t('twoFactorDescription')}
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={!permissions.canEdit}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Section bannissement */}
                  <div className="border-t pt-6">
                    <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                      <Shield className="h-5 w-5" />
                      {t('moderation')}
                    </h3>

                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="banned"
                        render={({field}) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">
                                {t('banned')}
                              </FormLabel>
                              <FormDescription>
                                {t('bannedDescription')}
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={!permissions.canManage}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {isBanned && (
                        <>
                          <FormField
                            control={form.control}
                            name="banReason"
                            render={({field}) => (
                              <FormItem>
                                <FormLabel>{t('banReason')}</FormLabel>
                                <FormControl>
                                  <Textarea
                                    {...field}
                                    disabled={!permissions.canManage}
                                    placeholder={t('banReasonPlaceholder')}
                                    className="min-h-[80px]"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="banExpires"
                            render={({field}) => (
                              <FormItem>
                                <FormLabel>{t('banExpires')}</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    type="date"
                                    disabled={!permissions.canManage}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Laisser vide pour un bannissement permanent
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      )}
                    </div>
                  </div>

                  {permissions.canEdit && (
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        disabled={!form.formState.isDirty || isLoading}
                      >
                        {isLoading ? t('saving') : t('saveChanges')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => form.reset()}
                        disabled={isLoading}
                      >
                        Annuler
                      </Button>
                    </div>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Informations système */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {t('systemInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-muted-foreground text-sm font-medium">ID</p>
                <p className="font-mono text-sm">{user.id}</p>
              </div>

              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  {t('createdOn')}
                </p>
                <p className="text-sm">{formatDate(user.createdAt)}</p>
              </div>

              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  {t('lastUpdate')}
                </p>
                <p className="text-sm">{formatDate(user.updatedAt)}</p>
              </div>

              {user.stripeCustomerId && (
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    ID Client Stripe
                  </p>
                  <p className="font-mono text-sm">{user.stripeCustomerId}</p>
                </div>
              )}

              {user.image && (
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Photo de profil
                  </p>
                  <Avatar className="mt-2 h-16 w-16">
                    <AvatarImage
                      src={user.image}
                      alt="Photo de profil"
                      className="object-cover"
                    />
                    <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                </div>
              )}
            </CardContent>
          </Card>

          {user.settings && (
            <Card>
              <CardHeader>
                <CardTitle>{t('settingsTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    {t('theme')}
                  </p>
                  <p className="text-sm capitalize">{user.settings.theme}</p>
                </div>

                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    {t('language')}
                  </p>
                  <p className="text-sm uppercase">{user.settings.language}</p>
                </div>

                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    {t('timezone')}
                  </p>
                  <p className="text-sm">{user.settings.timezone}</p>
                </div>

                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    {t('notifications')}
                  </p>
                  <div className="space-y-1 text-sm">
                    <p>
                      Email:{' '}
                      {user.settings.enableEmailNotifications
                        ? t('enabled')
                        : t('disabled')}
                    </p>
                    <p>
                      Push:{' '}
                      {user.settings.enablePushNotifications
                        ? t('enabled')
                        : t('disabled')}
                    </p>
                    <p>
                      {t('channel')}: {user.settings.notificationChannel}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Organisations et utilisation */}
      {organizationsWithUsage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {t('orgsAndUsage')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {organizationsWithUsage.map((org) => (
                <div key={org.id} className="rounded-lg border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="font-medium">{org.name}</h4>
                    <Badge variant="outline" className="uppercase">
                      {org.usage.plan}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 flex items-center gap-2 text-sm">
                        <Zap className="h-3 w-3" />
                        <span className="text-muted-foreground">
                          {t('projects')}
                        </span>
                        <span className="ml-auto">
                          {formatUsage(
                            org.usage.projects,
                            org.usage.limits.projects
                          )}
                        </span>
                      </div>
                      <Progress
                        value={getUsagePercent(
                          org.usage.projects,
                          org.usage.limits.projects
                        )}
                        className="h-1.5"
                        indicatorClassName={getProgressColor(
                          org.usage.projects,
                          org.usage.limits.projects
                        )}
                      />
                    </div>

                    <div>
                      <div className="mb-1 flex items-center gap-2 text-sm">
                        <User className="h-3 w-3" />
                        <span className="text-muted-foreground">
                          {t('members')}
                        </span>
                        <span className="ml-auto">
                          {formatUsage(org.usage.users, org.usage.limits.users)}
                        </span>
                      </div>
                      <Progress
                        value={getUsagePercent(
                          org.usage.users,
                          org.usage.limits.users
                        )}
                        className="h-1.5"
                        indicatorClassName={getProgressColor(
                          org.usage.users,
                          org.usage.limits.users
                        )}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
