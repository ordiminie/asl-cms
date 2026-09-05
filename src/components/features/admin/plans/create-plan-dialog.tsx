'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {Plus} from 'lucide-react'
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
import {CreatePlan} from '@/services/types/domain/subscription-types'

import {CreatePlanFormData, createPlanSchema} from './plan-form-validation'

interface Props {
  onSave: (data: CreatePlan) => Promise<void>
}

export function CreatePlanDialog({onSave}: Props) {
  const t = useTranslations('AdminPlans')
  const tCommon = useTranslations('Common')
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<CreatePlanFormData>({
    resolver: zodResolver(createPlanSchema),
    defaultValues: {
      code: '',
      planName: '',
      priceId: '',
      description: '',
      price: '',
      yearlyPrice: '',
      annualDiscountPriceId: '',
      currency: 'EUR',
      isRecurring: true,
      displayOrder: 0,
    },
  })

  const handleSubmit = async (data: CreatePlanFormData) => {
    setIsLoading(true)
    try {
      await onSave({
        ...data,
        displayOrder: data.displayOrder || 0,
      })
      form.reset()
      setIsOpen(false)
    } catch (error) {
      console.error('Error creating plan:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Nouveau plan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t('form.createTitle')}</DialogTitle>
          <DialogDescription>{t('form.createDescription')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>{tCommon('fields.code')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('form.codePlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('form.codeDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                {tCommon('actions.cancel')}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? t('form.creating') : t('form.create')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
