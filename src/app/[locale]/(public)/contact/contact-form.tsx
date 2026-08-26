'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {AlertCircle, CheckCircle2, Loader2, Mail, Send} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useState} from 'react'
import {useForm} from 'react-hook-form'

import {Alert, AlertDescription} from '@/components/ui/alert'
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'

import {submitContactAction} from './actions'
import {
  ContactFormSchemaType,
  createContactFormSchema,
} from './contact-form-validation'

export function ContactForm() {
  const t = useTranslations('ContactPage')
  const contactFormSchema = createContactFormSchema(t)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  const form = useForm<ContactFormSchemaType>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      email: '',
      subject: '',
      content: '',
    },
  })

  const onSubmit = async (data: ContactFormSchemaType) => {
    setIsSubmitting(true)
    setSubmitResult(null)

    const formData = new FormData()
    formData.append('email', data.email)
    formData.append('subject', data.subject)
    formData.append('content', data.content)

    try {
      const result = await submitContactAction(
        {success: false, message: ''},
        formData
      )
      setSubmitResult(result)

      if (result.success) {
        form.reset()
      }
    } catch {
      setSubmitResult({
        success: false,
        message: t('errors.generic'),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitResult?.success) {
    return (
      <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/50">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-green-800 dark:text-green-200">
              {t('success.title')}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              {submitResult.message}
            </p>
            <Button
              variant="outline"
              onClick={() => setSubmitResult(null)}
              className="border-green-300 dark:border-green-700"
            >
              {t('success.cta')}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="bg-primary/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
          <Mail className="text-primary h-6 w-6" />
        </div>
        <CardTitle className="text-2xl">{t('card.title')}</CardTitle>
        <CardDescription>{t('card.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {submitResult && !submitResult.success && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{submitResult.message}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="email"
              render={({field}) => (
                <FormItem>
                  <FormLabel>{t('fields.email.label')}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder={t('fields.email.placeholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subject"
              render={({field}) => (
                <FormItem>
                  <FormLabel>{t('fields.subject.label')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('fields.subject.placeholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({field}) => (
                <FormItem>
                  <FormLabel>{t('fields.content.label')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('fields.content.placeholder')}
                      className="min-h-[140px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('submit.pending')}
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {t('submit.idle')}
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
