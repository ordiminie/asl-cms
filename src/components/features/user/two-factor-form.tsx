'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import Image from 'next/image'
import {useTranslations} from 'next-intl'
import QRCode from 'qrcode'
import {useEffect, useState} from 'react'
import {useForm, useWatch} from 'react-hook-form'
import {toast} from 'sonner'
import {z} from 'zod'

import {Button} from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {Switch} from '@/components/ui/switch'
import {AuthClientAppConfig} from '@/lib/better-auth/auth-client'
import {User} from '@/services/types/domain/user-types'

import {
  update2FAAction,
  updateUserSettingsAction,
  verifyTotpAction,
} from './action'
import {twoFactorFormSchema} from './user-form-validation'

type FormValues = z.infer<typeof twoFactorFormSchema>

export function TwoFactorForm({user}: {user: User}) {
  const t = useTranslations('AccountPage.UserSecuritySection.twoFactor')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showBackupCodes, setShowBackupCodes] = useState(false)
  const [showValidationModal, setShowValidationModal] = useState(false)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [totpURI, setTotpURI] = useState<string>('')
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
  const [validationCode, setValidationCode] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [isUpdatingType, setIsUpdatingType] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(twoFactorFormSchema),
    defaultValues: {
      action: user.twoFactorEnabled ? 'disable' : 'enable',
      password: '',
    },
  })

  const selectedAction = useWatch({control: form.control, name: 'action'})

  // Générer le QR code quand l'URI TOTP est disponible
  useEffect(() => {
    if (totpURI) {
      QRCode.toDataURL(totpURI, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })
        .then((dataUrl) => {
          setQrCodeDataUrl(dataUrl)
          return dataUrl
        })
        .catch((err) => {
          console.error('Erreur lors de la génération du QR code:', err)
        })
    }
  }, [totpURI])

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true)
    const formData = new FormData()
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        formData.append(key, value.toString())
      }
    }

    const result = await update2FAAction(undefined, formData)
    setIsSubmitting(false)

    if (result.success) {
      toast(t('success'), {
        description: result.message,
      })

      // Si c'est une activation et qu'on a des codes de sauvegarde
      if (selectedAction === 'enable' && result.backupCodes && result.totpURI) {
        setBackupCodes(result.backupCodes)
        setTotpURI(result.totpURI)
        setShowBackupCodes(true)
      }

      // Réinitialiser le formulaire après succès
      form.reset()
      setShowModal(false)
      // Mettre à jour l'action en fonction du nouveau statut
      form.setValue('action', user.twoFactorEnabled ? 'enable' : 'disable')
    } else {
      for (const error of result?.errors ?? []) {
        form.setError(error.field as never, {
          type: 'manual',
          message: error.message,
        })
      }
      toast(t('error'), {
        description: result.message,
      })
    }
  }

  // Nouvelle fonction pour changer le type de 2FA
  const handleChangeTwoFactorType = async (type: 'otp' | 'totp') => {
    if (!user.twoFactorEnabled) {
      toast(t('error'), {
        description: t('typeSelection.error'),
      })
      return
    }

    setIsUpdatingType(true)
    const formData = new FormData()
    formData.append('twoFactorType', type)

    const result = await updateUserSettingsAction(undefined, formData)
    setIsUpdatingType(false)

    if (result.success) {
      toast(t('success'), {
        description:
          type === 'totp'
            ? t('typeSelection.successTotp')
            : t('typeSelection.successOtp'),
      })
    } else {
      toast(t('error'), {
        description: result.message,
      })
    }
  }

  const handleSwitchChange = (enabled: boolean) => {
    const action = enabled ? 'enable' : 'disable'
    form.setValue('action', action)
    form.setValue('password', '') // Réinitialiser le mot de passe
    setShowModal(true)
  }

  const handleCancel = () => {
    setShowModal(false)
    form.reset()
    form.setValue('action', user.twoFactorEnabled ? 'disable' : 'enable')
  }

  const handleBackupCodesClose = () => {
    setShowBackupCodes(false)
    setBackupCodes([])
    setTotpURI('')
    setQrCodeDataUrl('')
  }

  const handleValidateCode = async () => {
    if (!validationCode.trim()) {
      toast(t('error'), {
        description: t('validation.error'),
      })
      return
    }

    setIsValidating(true)

    try {
      const formData = new FormData()
      formData.append('code', validationCode)
      formData.append('backupCode', backupCodes[0] || '')

      const result = await verifyTotpAction(undefined, formData)

      if (result.success) {
        toast(t('success'), {
          description: result.message,
        })
        setShowValidationModal(false)
        setValidationCode('')
        // Optionnel : fermer aussi la modal des codes de sauvegarde
        handleBackupCodesClose()
      } else {
        toast(t('error'), {
          description: result.message,
        })
      }
    } catch {
      toast(t('error'), {
        description: t('validation.errorGeneral'),
      })
    } finally {
      setIsValidating(false)
    }
  }

  return (
    <>
      <div className="space-y-4">
        <h4 className="text-sm font-medium">{t('title')}</h4>

        {/* Statut actuel avec switch */}
        <div className="flex flex-col gap-4 rounded-lg p-4 sm:flex-row sm:items-center sm:justify-between sm:border">
          <div className="flex-1 space-y-0.5">
            <p className="text-sm font-medium">{t('status.title')}</p>
            <p className="text-muted-foreground text-sm">
              {user.twoFactorEnabled
                ? t('status.enabled')
                : t('status.disabled')}
            </p>
          </div>
          <Switch
            checked={user.twoFactorEnabled ?? false}
            onCheckedChange={handleSwitchChange}
            disabled={isSubmitting}
          />
        </div>

        {/* Sélection du type de 2FA - visible seulement si 2FA est activé */}
        {user.twoFactorEnabled && (
          <div className="rounded-lg p-4 sm:border">
            <div className="space-y-3">
              <div>
                <h5 className="text-sm font-medium">
                  {t('typeSelection.title')}
                </h5>
                <p className="text-muted-foreground text-sm">
                  {t('typeSelection.description')}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant={
                    user.settings?.twoFactorType === 'totp'
                      ? 'default'
                      : 'outline'
                  }
                  size="sm"
                  onClick={() => handleChangeTwoFactorType('totp')}
                  disabled={isUpdatingType}
                >
                  {isUpdatingType && user.settings?.twoFactorType === 'totp'
                    ? t('typeSelection.updating')
                    : t('typeSelection.totp')}
                </Button>

                <Button
                  variant={
                    user.settings?.twoFactorType === 'otp'
                      ? 'default'
                      : 'outline'
                  }
                  size="sm"
                  onClick={() => handleChangeTwoFactorType('otp')}
                  disabled={isUpdatingType}
                >
                  {isUpdatingType && user.settings?.twoFactorType === 'otp'
                    ? t('typeSelection.updating')
                    : t('typeSelection.otp')}
                </Button>
              </div>

              <p className="text-muted-foreground text-xs">
                {t('typeSelection.help')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modal pour le mot de passe */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedAction === 'enable'
                ? t('modal.enableTitle')
                : t('modal.disableTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedAction === 'enable'
                ? t('modal.enableDescription')
                : t('modal.disableDescription')}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>{t('modal.password')}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={t('modal.passwordPlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  {t('modal.cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? t('modal.processing')
                    : selectedAction === 'enable'
                      ? t('modal.enable')
                      : t('modal.disable')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal pour les codes de sauvegarde */}
      <Dialog open={showBackupCodes} onOpenChange={setShowBackupCodes}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('setup.title')}</DialogTitle>
            <DialogDescription>{t('setup.description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* QR Code */}
            {qrCodeDataUrl && (
              <div className="text-center">
                <h4 className="mb-3 text-sm font-medium">
                  {t('setup.qrCode')}
                </h4>
                <p className="text-muted-foreground mb-3 text-sm">
                  {t('setup.qrDescription')}
                </p>
                <div className="flex justify-center">
                  <Image
                    src={qrCodeDataUrl}
                    alt="QR Code pour configuration 2FA"
                    width={200}
                    height={200}
                    className="rounded-lg border"
                  />
                </div>
              </div>
            )}

            {/* Codes de sauvegarde */}
            <div>
              <h4 className="mb-2 text-sm font-medium">
                {t('setup.backupCodes')}
              </h4>
              <p className="text-muted-foreground mb-3 text-sm">
                {t('setup.backupDescription')}
              </p>
              <div className="bg-muted grid grid-cols-2 gap-2 rounded-lg p-3">
                {backupCodes.map((code, index) => (
                  <div
                    key={index}
                    className="bg-background rounded border p-2 text-center font-mono text-sm"
                  >
                    {code}
                  </div>
                ))}
              </div>
            </div>

            {/* URI TOTP (optionnel) */}
            {totpURI && (
              <div>
                <h4 className="mb-2 text-sm font-medium">
                  {t('setup.totpUri')}
                </h4>
                <p className="text-muted-foreground mb-2 text-sm">
                  {t('setup.totpDescription')}
                </p>
                <div className="bg-muted rounded p-2 font-mono text-xs break-all">
                  {totpURI}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {!AuthClientAppConfig.skipVerificationOnEnable && (
              <Button
                variant="outline"
                onClick={() => setShowValidationModal(true)}
                className="w-full sm:w-auto"
              >
                {t('setup.validate')}
              </Button>
            )}
            <Button
              onClick={handleBackupCodesClose}
              className="w-full sm:w-auto"
            >
              {t('setup.configured')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal pour valider le code */}
      <Dialog open={showValidationModal} onOpenChange={setShowValidationModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('validation.title')}</DialogTitle>
            <DialogDescription>{t('validation.description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {t('validation.codeLabel')}
              </label>
              <Input
                type="text"
                placeholder={t('validation.codePlaceholder')}
                value={validationCode}
                onChange={(e) => setValidationCode(e.target.value)}
                className="mt-2 text-center font-mono text-lg tracking-wider"
              />
              <p className="text-muted-foreground mt-2 text-sm">
                {t('validation.codeHelper')}{' '}
                <span className="font-mono">{backupCodes[0]}</span>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowValidationModal(false)
                setValidationCode('')
              }}
            >
              {t('validation.cancel')}
            </Button>
            <Button
              onClick={handleValidateCode}
              disabled={isValidating || !validationCode.trim()}
            >
              {isValidating
                ? t('validation.validating')
                : t('validation.validate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
