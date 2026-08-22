'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {Check, Copy} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useState, useTransition} from 'react'
import {useForm} from 'react-hook-form'
import {toast} from 'sonner'
import {z} from 'zod'

import {setAffiliateCodeAction} from '@/app/[locale]/(app)/account/affiliate/actions'
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
import {
  REFERRAL_CODE_MAX_LENGTH,
  REFERRAL_CODE_PATTERN,
  REFERRAL_QUERY_PARAM,
} from '@/lib/helper/referral-helper'
import {AffiliateDashboardDTO} from '@/services/types/domain/affiliate-types'

type AffiliateDashboardProps = {
  dashboard: AffiliateDashboardDTO
  appUrl: string
}

const formatAmount = (cents: number, currency: string): string =>
  new Intl.NumberFormat('fr-FR', {style: 'currency', currency}).format(
    cents / 100
  )

export function AffiliateDashboard({
  dashboard,
  appUrl,
}: AffiliateDashboardProps) {
  const t = useTranslations('Affiliate')
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)
  const [currentCode, setCurrentCode] = useState(dashboard.code ?? '')

  const schema = z.object({
    code: z
      .string()
      .min(3, t('validation.codeMin'))
      .max(REFERRAL_CODE_MAX_LENGTH, t('validation.codeMax'))
      .regex(REFERRAL_CODE_PATTERN, t('validation.codePattern')),
  })

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {code: dashboard.code ?? ''},
  })

  const referralLink = currentCode
    ? `${appUrl}?${REFERRAL_QUERY_PARAM}=${currentCode}`
    : ''

  function onSubmit(values: z.infer<typeof schema>) {
    startTransition(async () => {
      const result = await setAffiliateCodeAction(values.code)

      if (result.success) {
        setCurrentCode(result.data?.code ?? values.code)
        toast.success(result.message)
      } else {
        toast.error(result.message)
        form.setError('code', {message: result.message})
      }
    })
  }

  async function copyLink() {
    await navigator.clipboard.writeText(referralLink)
    setCopied(true)
    toast.success(t('success.linkCopied'))
    setTimeout(() => setCopied(false), 2000)
  }

  const stats = [
    {
      label: t('stats.referredAccounts'),
      value: String(dashboard.referredOrganizations),
    },
    {
      label: t('stats.waitingPeriod'),
      value: formatAmount(dashboard.waitingCents, dashboard.currency),
      hint: t('stats.waitingCount', {count: dashboard.waitingCount}),
    },
    {
      label: t('stats.commissionDue'),
      value: formatAmount(dashboard.dueCents, dashboard.currency),
    },
    {
      label: t('stats.totalPaid'),
      value: formatAmount(dashboard.paidCents, dashboard.currency),
    },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('link.title')}</CardTitle>
          <CardDescription>{t('link.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-3 sm:flex-row sm:items-start"
            >
              <FormField
                control={form.control}
                name="code"
                render={({field}) => (
                  <FormItem className="flex-1">
                    <FormLabel>{t('link.codeLabel')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('link.codePlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>{t('link.codeHelp')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isPending} className="sm:mt-8">
                {isPending ? t('link.saving') : t('link.save')}
              </Button>
            </form>
          </Form>

          {referralLink && (
            <div className="flex items-center gap-2 rounded-md border p-3">
              <code className="flex-1 truncate text-sm">{referralLink}</code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyLink}
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                <span className="ml-2 hidden sm:inline">{t('link.copy')}</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm">{stat.label}</p>
              <p className="text-2xl font-semibold">{stat.value}</p>
              {stat.hint && (
                <p className="text-muted-foreground mt-1 text-xs">
                  {stat.hint}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-muted-foreground text-sm">{t('page.payoutNotice')}</p>
    </div>
  )
}
