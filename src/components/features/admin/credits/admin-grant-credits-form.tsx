'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {useTranslations} from 'next-intl'
import {useState, useTransition} from 'react'
import {useForm, useWatch} from 'react-hook-form'
import {toast} from 'sonner'
import {z} from 'zod'

import {
  grantCreditsAction,
  GrantCreditsInput,
} from '@/app/[locale]/admin/credits/actions'
import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import {Switch} from '@/components/ui/switch'
import {Textarea} from '@/components/ui/textarea'

import {OrganizationSearch} from './organization-search'

const createFormSchema = (t: (key: string) => string) =>
  z.object({
    organizationId: z
      .string()
      .uuid({message: t('validation.organizationIdInvalid')}),
    amount: z
      .number()
      .positive({message: t('validation.positive')})
      .max(10000, {message: t('validation.max')}),
    reason: z.string().max(500).optional(),
    hasExpiration: z.boolean(),
    expiresAt: z.date().nullable().optional(),
  })

type FormSchema = ReturnType<typeof createFormSchema>

type FormValues = z.infer<FormSchema>
type FormInput = z.input<FormSchema>

export function AdminGrantCreditsForm() {
  const t = useTranslations('AdminCredits')
  const tCommon = useTranslations('Common')
  const schema = createFormSchema(t)
  const [isPending, startTransition] = useTransition()
  const [organizationName, setOrganizationName] = useState('')

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      organizationId: '',
      amount: 0,
      reason: '',
      hasExpiration: false,
      expiresAt: null,
    },
  })

  const hasExpiration = useWatch({control: form.control, name: 'hasExpiration'})
  const organizationId = useWatch({
    control: form.control,
    name: 'organizationId',
  })

  const handleOrganizationSelect = (id: string, name: string) => {
    form.setValue('organizationId', id)
    setOrganizationName(name)
  }

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const input: GrantCreditsInput = {
        organizationId: values.organizationId,
        amount: values.amount,
        reason: values.reason || undefined,
        expiresAt: values.hasExpiration ? values.expiresAt : null,
      }

      const result = await grantCreditsAction(input)

      if (result.success) {
        toast(t('successTitle'), {
          description: result.message,
        })
        form.reset()
        setOrganizationName('')
      } else {
        toast(t('errorTitle'), {
          description: result.message,
        })
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('grantTitle')}</CardTitle>
        <CardDescription>
          Accordez des crédits bonus à une organisation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormItem>
              <FormLabel>{tCommon('fields.organization')}</FormLabel>
              <OrganizationSearch
                onSelect={handleOrganizationSelect}
                selectedOrganizationId={organizationId}
                selectedOrganizationName={organizationName}
              />
              <FormDescription>
                Recherchez par nom d&apos;organisation ou email d&apos;un membre
              </FormDescription>
            </FormItem>

            <FormField
              control={form.control}
              name="amount"
              render={({field}) => (
                <FormItem>
                  <FormLabel>{t('amountLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={10000}
                      placeholder={t('amountPlaceholder')}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>{t('amountHint')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({field}) => (
                <FormItem>
                  <FormLabel>{t('reasonLabel')}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t('reasonPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hasExpiration"
              render={({field}) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      {t('expiresAt')}
                    </FormLabel>
                    <FormDescription>{t('expiresHint')}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {hasExpiration && (
              <FormField
                control={form.control}
                name="expiresAt"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>{t('expiresAt')}</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        value={
                          field.value
                            ? new Date(field.value).toISOString().split('T')[0]
                            : ''
                        }
                        onChange={(e) =>
                          field.onChange(
                            e.target.value ? new Date(e.target.value) : null
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Button
              type="submit"
              disabled={isPending || !organizationId}
              className="w-full"
            >
              {isPending ? t('submitting') : t('submit')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
