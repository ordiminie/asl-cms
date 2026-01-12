import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Tailwind,
} from '@react-email/components'
import {getTranslations} from 'next-intl/server'
import React, {Fragment} from 'react'

type InternalEmailProps = {
  preview: string
  content: string | React.ReactNode
}

export default async function InternalEmail({
  preview,
  content,
}: InternalEmailProps) {
  const t = await getTranslations('email.admin.internal')

  return (
    <Html>
      <Head />
      <Tailwind>
        <Fragment>
          <Preview>{preview}</Preview>
          <Body className="mx-auto my-auto bg-white px-2 font-sans">
            <Container className="mx-auto my-[40px] max-w-[465px] rounded border border-solid border-[#eaeaea] p-8">
              {content}
              <div className="mt-6 border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-500">{t('footer')}</p>
              </div>
            </Container>
          </Body>
        </Fragment>
      </Tailwind>
    </Html>
  )
}
