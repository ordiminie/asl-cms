'use client'

import {useState, useTransition} from 'react'
import {toast} from 'sonner'

import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {type EmailDefinition} from '@/lib/emails/email-registry'

import {sendTestEmailAction} from './actions'

type EmailsTestFormProps = {
  emailRegistry: Record<string, EmailDefinition>
}

export default function EmailsTestForm({emailRegistry}: EmailsTestFormProps) {
  const [selectedEmailId, setSelectedEmailId] = useState<string>('')
  const [params, setParams] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  const selectedEmail = selectedEmailId ? emailRegistry[selectedEmailId] : null

  const handleEmailChange = (emailId: string) => {
    setSelectedEmailId(emailId)
    const emailDef = emailRegistry[emailId]
    if (emailDef) {
      const initialParams: Record<string, string> = {}
      emailDef.params.forEach((param) => {
        initialParams[param.key] = param.default || ''
      })
      setParams(initialParams)
    }
  }

  const handleParamChange = (key: string, value: string) => {
    setParams((prev) => ({...prev, [key]: value}))
  }

  const handleSubmit = () => {
    if (!selectedEmailId || !selectedEmail) {
      toast.error('Please select an email')
      return
    }

    const missingFields = selectedEmail.params
      .filter((param) => param.required && !params[param.key])
      .map((param) => param.label)

    if (missingFields.length > 0) {
      toast.error(`Missing required fields: ${missingFields.join(', ')}`)
      return
    }

    startTransition(async () => {
      const result = await sendTestEmailAction(selectedEmailId, params)
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Email Test Configuration</CardTitle>
          <CardDescription>
            Select an email type and configure parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-select">Email Type</Label>
            <Select value={selectedEmailId} onValueChange={handleEmailChange}>
              <SelectTrigger id="email-select">
                <SelectValue placeholder="Select an email" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(emailRegistry).map((email) => (
                  <SelectItem key={email.id} value={email.id}>
                    {email.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedEmail && (
            <>
              <p className="text-muted-foreground text-sm">
                {selectedEmail.description}
              </p>

              <div className="space-y-4">
                {selectedEmail.params.map((param) => (
                  <div key={param.key} className="space-y-2">
                    <Label htmlFor={param.key}>
                      {param.label}
                      {param.required && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </Label>
                    {param.type === 'select' && param.options ? (
                      <Select
                        value={params[param.key] || ''}
                        onValueChange={(value) =>
                          handleParamChange(param.key, value)
                        }
                      >
                        <SelectTrigger id={param.key}>
                          <SelectValue placeholder={`Select ${param.label}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {param.options.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={param.key}
                        type={param.type === 'email' ? 'email' : 'text'}
                        value={params[param.key] || ''}
                        onChange={(e) =>
                          handleParamChange(param.key, e.target.value)
                        }
                        placeholder={param.default || `Enter ${param.label}`}
                      />
                    )}
                  </div>
                ))}
              </div>

              <Button
                onClick={handleSubmit}
                disabled={isPending || !selectedEmailId}
                className="w-full"
              >
                {isPending ? 'Sending...' : 'Send Test Email'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parameters Preview</CardTitle>
          <CardDescription>JSON preview of current parameters</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted max-h-96 overflow-auto rounded-lg p-4 text-sm">
            {JSON.stringify(
              {
                emailId: selectedEmailId || null,
                params: selectedEmailId ? params : {},
              },
              null,
              2
            )}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
