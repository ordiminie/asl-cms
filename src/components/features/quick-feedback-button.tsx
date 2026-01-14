'use client'

import {
  Bug,
  Frown,
  Loader2,
  Meh,
  MessageSquare,
  Send,
  Smile,
  ThumbsDown,
} from 'lucide-react'
import {useState} from 'react'
import {toast} from 'sonner'

import {Button} from '@/components/ui/button'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {Textarea} from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import {createQuickFeedbackAction} from './quick-feedback-action'

const moodIcons = [
  {key: 'happy', icon: Smile, label: 'Satisfait'},
  {key: 'neutral', icon: Meh, label: 'Neutre'},
  {key: 'sad', icon: Frown, label: 'Déçu'},
  {key: 'unhappy', icon: ThumbsDown, label: 'Mécontent'},
  {key: 'bug', icon: Bug, label: 'Bug'},
]

export function QuickFeedbackButton() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedMood, setSelectedMood] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error('Veuillez entrer un message')
      return
    }

    setIsSubmitting(true)
    try {
      const moodLabel = selectedMood
        ? moodIcons.find((m) => m.key === selectedMood)?.label
        : null
      const fullMessage = moodLabel ? `[${moodLabel}] ${message}` : message

      const result = await createQuickFeedbackAction(fullMessage)

      if (result.success) {
        toast.success('Merci pour votre feedback !')
        setMessage('')
        setSelectedMood(null)
        setOpen(false)
      } else {
        toast.error(result.message || "Erreur lors de l'envoi")
      }
    } catch {
      toast.error("Erreur lors de l'envoi")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MessageSquare className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Envoyer un feedback</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent align="end" className="w-80">
        <div className="space-y-3">
          <div className="text-sm font-medium">Message</div>
          <Textarea
            placeholder="Votre message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[80px] resize-none"
            disabled={isSubmitting}
          />
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {moodIcons.map(({key, icon: Icon, label}) => (
                <TooltipProvider key={key}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedMood(selectedMood === key ? null : key)
                        }
                        className={`hover:bg-muted rounded p-1.5 transition-colors ${
                          selectedMood === key
                            ? 'bg-muted ring-primary ring-1'
                            : ''
                        }`}
                        disabled={isSubmitting}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>{label}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting || !message.trim()}
            >
              {isSubmitting ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1 h-4 w-4" />
              )}
              Envoyer
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
