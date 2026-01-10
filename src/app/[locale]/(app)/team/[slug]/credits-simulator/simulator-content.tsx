'use client'

import {
  AlertCircle,
  CheckCircle2,
  Coins,
  Loader2,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react'
import {useState, useTransition} from 'react'
import {toast} from 'sonner'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Textarea} from '@/components/ui/textarea'

import {
  getCreditsBalanceAction,
  simulateAiGenerationAction,
  SimulatorResult,
} from './actions'

interface SimulatorContentProps {
  organizationId: string
  initialBalance: number
}

interface LogEntry {
  id: string
  timestamp: Date
  type: 'info' | 'success' | 'error' | 'refund'
  message: string
  credits?: number
}

export function SimulatorContent({
  organizationId,
  initialBalance,
}: SimulatorContentProps) {
  const [prompt, setPrompt] = useState('')
  const [balance, setBalance] = useState(initialBalance)
  const [isPending, startTransition] = useTransition()
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'init',
      timestamp: new Date(),
      type: 'info',
      message: 'Simulateur initialisé',
      credits: initialBalance,
    },
  ])
  const [lastResult, setLastResult] = useState<SimulatorResult | null>(null)

  const addLog = (
    type: LogEntry['type'],
    message: string,
    credits?: number
  ) => {
    setLogs((prev) => [
      {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type,
        message,
        credits,
      },
      ...prev.slice(0, 49),
    ])
  }

  const refreshBalance = async () => {
    const result = await getCreditsBalanceAction(organizationId)
    if (result.success && result.data !== undefined) {
      setBalance(result.data)
    }
  }

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error('Veuillez entrer un prompt')
      return
    }

    startTransition(async () => {
      addLog('info', `Génération en cours: "${prompt.slice(0, 40)}..."`, -5)

      const result = await simulateAiGenerationAction(organizationId, prompt)

      if (!result.success || !result.data) {
        addLog('error', result.message)
        toast.error(result.message)
        return
      }

      const data = result.data
      setLastResult(data)
      setBalance(data.newBalance)

      if (data.success) {
        addLog('success', 'Génération réussie', -5)
        toast.success('Génération terminée!')
      } else if (data.refunded) {
        addLog('refund', `Erreur API - Remboursement effectué`, +5)
        toast.warning('Erreur du service IA - Crédits remboursés')
      } else {
        addLog('error', data.error || 'Erreur inconnue')
        toast.error(data.error || 'Erreur lors de la génération')
      }

      setPrompt('')
    })
  }

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'refund':
        return <RefreshCw className="h-4 w-4 text-orange-500" />
      default:
        return <Zap className="h-4 w-4 text-blue-500" />
    }
  }

  const getLogBgColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-500/10 border-green-500/20'
      case 'error':
        return 'bg-red-500/10 border-red-500/20'
      case 'refund':
        return 'bg-orange-500/10 border-orange-500/20'
      default:
        return 'bg-blue-500/10 border-blue-500/20'
    }
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Simulateur de Crédits IA</h1>
          <p className="text-muted-foreground">
            Testez la consommation de crédits avec une fausse API IA (5 crédits
            par génération)
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={refreshBalance}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualiser
          </Button>
          <Badge
            variant="outline"
            className="flex items-center gap-2 px-4 py-2 text-lg"
          >
            <Coins className="h-5 w-5" />
            <span className="font-bold">{balance}</span> crédits
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Zone de prompt */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Prompt IA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Entrez votre prompt ici... (ex: Analyse les tendances du marché SaaS en 2024)"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              disabled={isPending}
              className="resize-none"
            />
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">
                Coût: <strong>5 crédits</strong> par génération
              </p>
              <Button
                onClick={handleGenerate}
                disabled={isPending || !prompt.trim()}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Générer (-5 crédits)
                  </>
                )}
              </Button>
            </div>

            {/* Dernier résultat */}
            {lastResult && (
              <div className="mt-4">
                {lastResult.success ? (
                  <Alert className="border-green-500/50 bg-green-500/10">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertTitle>Génération réussie</AlertTitle>
                    <AlertDescription className="mt-2 text-sm whitespace-pre-wrap">
                      {lastResult.output}
                    </AlertDescription>
                  </Alert>
                ) : lastResult.refunded ? (
                  <Alert className="border-orange-500/50 bg-orange-500/10">
                    <RefreshCw className="h-4 w-4 text-orange-500" />
                    <AlertTitle>Erreur - Crédits remboursés</AlertTitle>
                    <AlertDescription>{lastResult.error}</AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erreur</AlertTitle>
                    <AlertDescription>{lastResult.error}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Console des crédits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Coins className="h-5 w-5" />
                Console des Crédits
              </span>
              <Badge variant="secondary">{logs.length} événements</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 h-[400px] space-y-2 overflow-y-auto rounded-lg border p-3">
              {logs.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  Aucun événement pour le moment...
                </p>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className={`flex items-start gap-3 rounded-md border p-2 text-sm ${getLogBgColor(log.type)}`}
                  >
                    <div className="mt-0.5">{getLogIcon(log.type)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{log.message}</p>
                      <p className="text-muted-foreground text-xs">
                        {log.timestamp.toLocaleTimeString('fr-FR')}
                      </p>
                    </div>
                    {log.credits !== undefined && (
                      <Badge
                        variant={log.credits > 0 ? 'default' : 'secondary'}
                        className={
                          log.credits > 0
                            ? 'bg-green-600'
                            : log.credits < 0
                              ? 'bg-red-600'
                              : ''
                        }
                      >
                        {log.credits > 0 ? '+' : ''}
                        {log.credits}
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 font-semibold">
                <Zap className="h-4 w-4 text-blue-500" />
                Comment ça marche
              </h3>
              <p className="text-muted-foreground text-sm">
                Chaque génération consomme 5 crédits. Les crédits sont déduits
                avant l&apos;appel API.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                Gestion des erreurs
              </h3>
              <p className="text-muted-foreground text-sm">
                ~20% des requêtes échouent. En cas d&apos;erreur, les crédits
                sont automatiquement remboursés.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 font-semibold">
                <RefreshCw className="h-4 w-4 text-green-500" />
                Remboursement
              </h3>
              <p className="text-muted-foreground text-sm">
                Les remboursements apparaissent dans le ledger avec la source
                &quot;Refund&quot;.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
