'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {useState, useTransition} from 'react'
import {useForm} from 'react-hook-form'
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

const formSchema = z.object({
  organizationId: z
    .string()
    .uuid({message: "L'ID de l'organisation est invalide"}),
  amount: z
    .number()
    .positive({message: 'Le montant doit être positif'})
    .max(10000, {message: 'Le montant maximum est 10000 crédits'}),
  reason: z.string().max(500).optional(),
  hasExpiration: z.boolean(),
  expiresAt: z.date().nullable().optional(),
})

type FormValues = z.infer<typeof formSchema>
type FormInput = z.input<typeof formSchema>

export function AdminGrantCreditsForm() {
  const [isPending, startTransition] = useTransition()
  const [organizationName, setOrganizationName] = useState('')

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      organizationId: '',
      amount: 0,
      reason: '',
      hasExpiration: false,
      expiresAt: null,
    },
  })

  const hasExpiration = form.watch('hasExpiration')
  const organizationId = form.watch('organizationId')

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
        toast('Succès', {
          description: result.message,
        })
        form.reset()
        setOrganizationName('')
      } else {
        toast('Erreur', {
          description: result.message,
        })
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accorder des crédits</CardTitle>
        <CardDescription>
          Accordez des crédits bonus à une organisation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormItem>
              <FormLabel>Organisation</FormLabel>
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
                  <FormLabel>Nombre de crédits</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={10000}
                      placeholder="100"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>Maximum 10000 crédits</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Raison (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Bonus de bienvenue, geste commercial..."
                      {...field}
                    />
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
                      Date d&apos;expiration
                    </FormLabel>
                    <FormDescription>
                      Les crédits expireront après cette date
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

            {hasExpiration && (
              <FormField
                control={form.control}
                name="expiresAt"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Date d&apos;expiration</FormLabel>
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
              {isPending ? 'Attribution en cours...' : 'Accorder les crédits'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
