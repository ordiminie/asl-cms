'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {AlertCircle, CheckCircle2, Info} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {useState} from 'react'
import {useForm} from 'react-hook-form'

import {
  ProvisionFormState,
  provisionOrganizationAction,
} from '@/app/[locale]/admin/organizations/actions'
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Checkbox} from '@/components/ui/checkbox'
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
import {Label} from '@/components/ui/label'
import {Separator} from '@/components/ui/separator'
import {ORGANIZATION_MODULES} from '@/services/types/domain/organization-types'

import {
  createProvisionOrganizationFormSchema,
  ProvisionOrganizationFormValues,
} from './provision-organization-form-validation'

/** Deux lettres tirees du nom, comme le §1.8 du design system le demande. */
const monogram = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '··'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}

/** Identifiant court propose d'apres le nom, modifiable. */
const suggestSlug = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export function ProvisionOrganizationForm() {
  const t = useTranslations('AdminOrganizations.provision')
  const tModules = useTranslations('AdminOrganizations.modules')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [slugEdited, setSlugEdited] = useState(false)
  const [state, setState] = useState<ProvisionFormState | undefined>()
  const [enabledModules, setEnabledModules] = useState<string[]>([])
  // Le nom est suivi en etat local plutot que par `form.watch` : le React
  // Compiler ne peut pas memoiser la fonction rendue par react-hook-form et
  // le signale (`react-hooks/incompatible-library`).
  const [nameValue, setNameValue] = useState('')

  const form = useForm<ProvisionOrganizationFormValues>({
    resolver: zodResolver(createProvisionOrganizationFormSchema(t)),
    defaultValues: {
      name: '',
      slug: '',
      domain: '',
      adminEmail: '',
      contactEmail: '',
    },
  })

  const toggleModule = (moduleKey: string, checked: boolean) => {
    setEnabledModules((current) =>
      checked
        ? [...current, moduleKey]
        : current.filter((key) => key !== moduleKey)
    )
  }

  const onSubmit = async (values: ProvisionOrganizationFormValues) => {
    setIsSubmitting(true)
    setState(undefined)

    const formData = new FormData()
    formData.set('name', values.name)
    formData.set('slug', values.slug)
    formData.set('domain', values.domain)
    formData.set('adminEmail', values.adminEmail)
    formData.set('contactEmail', values.contactEmail)
    for (const moduleKey of enabledModules) {
      formData.append('modules', moduleKey)
    }

    const result = await provisionOrganizationAction(undefined, formData)
    setIsSubmitting(false)
    setState(result)
  }

  if (state?.success) {
    return (
      <Alert>
        <CheckCircle2 />
        <AlertTitle>{t('successTitle')}</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <span>
            {t('successBody', {
              name: state.organizationName ?? '',
              domain: state.domain ?? '',
              email: state.adminEmail ?? '',
            })}
          </span>
          <Link
            className="text-link underline"
            href={`/admin/organizations/${state.organizationId}/edit`}
          >
            {t('breadcrumbCurrent')}
          </Link>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="max-w-xl space-y-6"
        noValidate
      >
        {state?.success === false && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>{t('errorTitle')}</AlertTitle>
            <AlertDescription className="flex flex-col gap-1">
              <span>{state.message}</span>
              <span>{t('errorKeepsInput')}</span>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t('associationCardTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({field}) => (
                <FormItem>
                  <FormLabel>{t('nameLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(event) => {
                        field.onChange(event)
                        setNameValue(event.target.value)
                        if (!slugEdited) {
                          form.setValue('slug', suggestSlug(event.target.value))
                        }
                      }}
                    />
                  </FormControl>
                  <FormDescription>{t('nameHelp')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({field}) => (
                <FormItem>
                  <FormLabel>{t('slugLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(event) => {
                        setSlugEdited(true)
                        field.onChange(event)
                      }}
                    />
                  </FormControl>
                  <FormDescription>{t('slugHelp')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="domain"
              render={({field}) => (
                <FormItem>
                  <FormLabel>{t('domainLabel')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>{t('domainHelp')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactEmail"
              render={({field}) => (
                <FormItem>
                  <FormLabel>{t('contactEmailLabel')}</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormDescription>{t('contactEmailHelp')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="bg-accent-solid text-background flex size-11 items-center justify-center rounded-md font-serif text-lg"
              >
                {monogram(nameValue)}
              </span>
              <span className="text-muted-foreground text-sm">
                {t('monogramLabel')}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('adminCardTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="adminEmail"
              render={({field}) => (
                <FormItem>
                  <FormLabel>{t('adminEmailLabel')}</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormDescription>{t('adminEmailHelp')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('modulesCardTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">{t('modulesHelp')}</p>
            {ORGANIZATION_MODULES.map((moduleKey) => (
              <div key={moduleKey} className="flex items-start gap-3">
                <Checkbox
                  id={`module-${moduleKey}`}
                  checked={enabledModules.includes(moduleKey)}
                  onCheckedChange={(checked) =>
                    toggleModule(moduleKey, checked === true)
                  }
                  className="mt-1"
                />
                <div className="flex flex-col">
                  <Label htmlFor={`module-${moduleKey}`}>
                    {tModules(`keys.${moduleKey}`)}
                  </Label>
                  <span className="text-muted-foreground text-sm">
                    {tModules(`descriptions.${moduleKey}`)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Alert className="border-warning-border bg-warning text-warning-foreground">
          <Info />
          <AlertTitle>{t('noticeTitle')}</AlertTitle>
          <AlertDescription className="text-warning-foreground">
            {t('noticeBody')}
          </AlertDescription>
        </Alert>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('submitting') : t('submit')}
          </Button>
          <Button variant="outline" asChild disabled={isSubmitting}>
            <Link href="/admin/organizations">{t('cancel')}</Link>
          </Button>
        </div>
      </form>
    </Form>
  )
}
