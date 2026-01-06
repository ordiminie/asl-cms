'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {Edit} from 'lucide-react'
import {useState} from 'react'
import {useForm} from 'react-hook-form'
import * as z from 'zod'

import {LimitsManager} from '@/components/features/admin/plans/limits-manager'
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
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import {Organization} from '@/services/types/domain/organization-types'

// Schéma de validation
const formSchema = z.object({
  name: z
    .string()
    .min(1, 'Le nom est requis')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères'),
  slug: z
    .string()
    .min(1, 'Le slug est requis')
    .max(50, 'Le slug ne peut pas dépasser 50 caractères'),
  description: z.string().optional(),
  limitOverrides: z.record(z.string(), z.number()).optional(),
})

type FormValues = z.infer<typeof formSchema>

interface EditOrganizationDialogProps {
  organization: Organization
  onSave: (
    id: string,
    data: {
      name: string
      slug: string
      description?: string
      limitOverrides?: Record<string, number>
    }
  ) => Promise<void>
}

export function EditOrganizationDialog({
  organization,
  onSave,
}: EditOrganizationDialogProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: organization.name,
      slug: organization.slug ?? '',
      description: organization.description || '',
      limitOverrides:
        (organization.limitOverrides as Record<string, number>) || {},
    },
  })

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true)
    try {
      await onSave(organization.id, data)
      setIsDialogOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Edit className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Modifier</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier l&apos;organisation</DialogTitle>
          <DialogDescription>
            Modifiez les informations de l&apos;organisation ci-dessous et
            cliquez sur Enregistrer.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="limitOverrides"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Limites supplémentaires</FormLabel>
                  <FormControl>
                    <LimitsManager
                      limits={field.value || {}}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-muted-foreground text-xs">
                    Ces limites s&apos;ajoutent aux limites du plan
                    d&apos;abonnement
                  </p>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
