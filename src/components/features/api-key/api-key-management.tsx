'use client'

import {Copy, Plus, Trash2} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useEffect, useState} from 'react'
import {toast} from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {Button} from '@/components/ui/button'
import {Checkbox} from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {authClient} from '@/lib/better-auth/auth-client'

interface ApiKey {
  id: string
  name: string | null
  key: string
  createdAt: string
  expiresAt?: string
}

const toIsoString = (date: Date | string) =>
  date instanceof Date ? date.toISOString() : date

const fetchApiKeys = async (): Promise<ApiKey[]> => {
  const response = await authClient.apiKey.list()
  if (!response.data) {
    return []
  }
  return response.data.apiKeys.map((key) => ({
    id: key.id,
    name: key.name,
    key: '****-****-****-****', // Hidden key for security
    createdAt: toIsoString(key.createdAt),
    expiresAt: key.expiresAt ? toIsoString(key.expiresAt) : undefined,
  }))
}

export function ApiKeyManagement() {
  const t = useTranslations('ApiKeysPage')
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string>('')
  const [minExpiresAt, setMinExpiresAt] = useState<string>('')
  const [neverExpires, setNeverExpires] = useState(false)
  // Remove visibility toggle since we can't retrieve keys after creation

  const loadApiKeys = async () => {
    setIsLoading(true)
    try {
      setApiKeys(await fetchApiKeys())
    } catch (error) {
      console.error('Error loading API keys:', error)
      toast.error(t('errors.loadFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  const createApiKey = async () => {
    if (!newKeyName.trim()) {
      toast.error(t('errors.nameRequired'))
      return
    }

    setIsLoading(true)
    try {
      const createData: {name: string; expiresIn?: number} = {
        name: newKeyName.trim(),
      }

      // Add expiration if not "never"
      if (!neverExpires && expiresAt) {
        const expirationDate = new Date(expiresAt)
        const now = new Date()

        if (expirationDate <= now) {
          toast.error(t('errors.invalidExpiration'))
          setIsLoading(false)
          return
        }

        // Calculate expiration in seconds from now
        const expiresIn = Math.floor(
          (expirationDate.getTime() - now.getTime()) / 1000
        )
        createData.expiresIn = expiresIn
      }

      const response = await authClient.apiKey.create(createData)
      //alert(JSON.stringify(response))

      if (response.data) {
        setNewlyCreatedKey(response.data.key) // Use key property
        await loadApiKeys()
        toast.success(t('messages.keyCreated'))
        // Note: Don't clear newKeyName or close dialog yet - user needs to copy the key
      }
    } catch (error) {
      console.error('Error creating API key:', error)
      toast.error(t('errors.createFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  const deleteApiKey = async (keyId: string) => {
    setIsLoading(true)
    try {
      await authClient.apiKey.delete({
        keyId,
      })
      await loadApiKeys()
      toast.success(t('messages.keyDeleted'))
    } catch (error) {
      console.error('Error deleting API key:', error)
      toast.error(t('errors.deleteFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success(t('messages.copiedToClipboard'))
  }

  // Load API keys on component mount
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const keys = await fetchApiKeys()
        if (cancelled) return
        setApiKeys(keys)
      } catch (error) {
        if (cancelled) return
        console.error('Error loading API keys:', error)
        toast.error(t('errors.loadFailed'))
      }
    }

    void load()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreateDialogOpenChange = (open: boolean) => {
    setIsCreateDialogOpen(open)
    if (open) {
      // Minimum 1 minute from now
      setMinExpiresAt(new Date(Date.now() + 60_000).toISOString().slice(0, 16))
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-medium">{t('management.title')}</h3>
          <p className="text-muted-foreground text-sm">
            {t('management.description')}
          </p>
        </div>
        <Dialog
          open={isCreateDialogOpen}
          onOpenChange={handleCreateDialogOpenChange}
        >
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              {t('actions.createKey')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('createDialog.title')}</DialogTitle>
              <DialogDescription>
                {t('createDialog.description')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="keyName">{t('createDialog.nameLabel')}</Label>
                <Input
                  id="keyName"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder={t('createDialog.namePlaceholder')}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-3">
                <Label>{t('createDialog.expirationLabel')}</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="neverExpires"
                    checked={neverExpires}
                    onCheckedChange={(checked) => {
                      setNeverExpires(checked as boolean)
                      if (checked) {
                        setExpiresAt('')
                      }
                    }}
                    disabled={isLoading}
                  />
                  <Label htmlFor="neverExpires" className="text-sm font-normal">
                    {t('createDialog.neverExpires')}
                  </Label>
                </div>
                {!neverExpires && (
                  <div className="space-y-2">
                    <Label htmlFor="expiresAt" className="text-sm">
                      {t('createDialog.expiresAtLabel')}
                    </Label>
                    <Input
                      id="expiresAt"
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      disabled={isLoading}
                      min={minExpiresAt}
                    />
                    <p className="text-muted-foreground text-xs">
                      {t('createDialog.expirationHelp')}
                    </p>
                  </div>
                )}
              </div>

              {newlyCreatedKey && (
                <div className="space-y-2">
                  <Label>{t('createDialog.newKeyLabel')}</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      value={newlyCreatedKey}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(newlyCreatedKey)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-amber-600">
                    {t('createDialog.keyWarning')}
                  </p>
                </div>
              )}
              <div className="flex justify-end space-x-2">
                {!newlyCreatedKey ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsCreateDialogOpen(false)
                        setNewKeyName('')
                        setNewlyCreatedKey(null)
                        setExpiresAt('')
                        setNeverExpires(false)
                      }}
                    >
                      {t('actions.cancel')}
                    </Button>
                    <Button
                      onClick={createApiKey}
                      disabled={isLoading || !newKeyName.trim()}
                    >
                      {isLoading ? t('actions.creating') : t('actions.create')}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => {
                      setIsCreateDialogOpen(false)
                      setNewKeyName('')
                      setNewlyCreatedKey(null)
                      setExpiresAt('')
                      setNeverExpires(false)
                    }}
                  >
                    {t('actions.done')}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('table.name')}</TableHead>
              <TableHead className="hidden sm:table-cell">
                {t('table.key')}
              </TableHead>
              <TableHead>{t('table.created')}</TableHead>
              <TableHead>{t('table.expires')}</TableHead>
              <TableHead className="text-right">{t('table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apiKeys.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center sm:col-span-5"
                >
                  <div className="text-muted-foreground">
                    {t('table.noKeys')}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              apiKeys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">
                    {key.name || 'Unnamed Key'}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <code className="text-sm">{key.key}</code>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {t('table.keyHidden')}
                    </p>
                  </TableCell>
                  <TableCell>{formatDate(key.createdAt)}</TableCell>
                  <TableCell>
                    {key.expiresAt
                      ? formatDate(key.expiresAt)
                      : t('table.never')}
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {t('deleteDialog.title')}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('deleteDialog.description', {
                              name: key.name || 'Unnamed Key',
                            })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            {t('actions.cancel')}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteApiKey(key.id)}
                            className="bg-destructive hover:bg-destructive/90 text-white"
                          >
                            {t('actions.delete')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
