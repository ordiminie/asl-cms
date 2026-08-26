'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {Edit} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useState} from 'react'
import {useForm} from 'react-hook-form'

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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {Input} from '@/components/ui/input'
import {Switch} from '@/components/ui/switch'
import {Textarea} from '@/components/ui/textarea'
import {Plan} from '@/services/types/domain/subscription-types'

import {LimitsManager} from './limits-manager'
import {EditPlanFormData, editPlanSchema} from './plan-form-validation'

interface Props {
  plan: Plan
  onSave: (id: string, data: Partial<Plan>) => Promise<void>
}

export function EditPlanDialog({plan, onSave}: Props) {
  const t = useTranslations('AdminPlans')
  const tCommon = useTranslations('Common')
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<EditPlanFormData>({
    resolver: zodResolver(editPlanSchema),
    defaultValues: {
      planName: plan.planName || '',
      priceId: plan.priceId || '',
      description: plan.description || '',
      price: plan.price || '',
      yearlyPrice: plan.yearlyPrice || '',
      annualDiscountPriceId: plan.annualDiscountPriceId || '',
      currency: plan.currency || 'EUR',
      isRecurring: plan.isRecurring ?? true,
      displayOrder: plan.displayOrder || 0,
      limits: (plan.limits as Record<string, number>) || {
        users: 10,
        projects: 5,
      },
    },
  })

  const handleSubmit = async (data: EditPlanFormData) => {
    setIsLoading(true)
    try {
      await onSave(plan.id, {
        ...data,
        displayOrder: data.displayOrder || 0,
      })
      setIsOpen(false)
    } catch (error) {
      console.error('Error updating plan:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t('form.editTitle')}</DialogTitle>
          <DialogDescription>
            Modifiez les informations du plan d&apos;abonnement.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Code</label>
                <Input value={plan.code} disabled className="bg-muted" />
                <p className="text-muted-foreground text-xs">
                  Le code ne peut pas être modifié
                </p>
              </div>

              <FormField
                control={form.control}
                name="planName"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>{t('form.nameLabel')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('form.namePlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('form.nameDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="priceId"
              render={({field}) => (
                <FormItem>
                  <FormLabel>{t('form.priceIdLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('form.priceIdPlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('form.priceIdDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({field}) => (
                <FormItem>
                  <FormLabel>{tCommon('fields.description')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('form.descriptionPlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>{t('form.monthlyPrice')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={t('form.monthlyPricePlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="yearlyPrice"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>{t('form.yearlyPrice')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={t('form.yearlyPricePlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="annualDiscountPriceId"
              render={({field}) => (
                <FormItem>
                  <FormLabel>{t('form.yearlyPriceIdLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('form.yearlyPriceIdPlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('form.yearlyPriceIdDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="currency"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>{tCommon('fields.currency')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('form.currencyPlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="displayOrder"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>{t('form.displayOrder')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isRecurring"
              render={({field}) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      {t('form.recurringLabel')}
                    </FormLabel>
                    <FormDescription>
                      {t('form.recurringDescription')}
                    </FormDescription>
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

            <FormField
              control={form.control}
              name="limits"
              render={({field}) => (
                <FormItem>
                  <LimitsManager
                    limits={field.value || {}}
                    onChange={field.onChange}
                    className="rounded-lg border p-4"
                  />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                {tCommon('actions.cancel')}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? t('form.updating') : t('form.update')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
