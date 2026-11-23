import {AlertTriangle} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import type {ReactNode} from 'react'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Card} from '@/components/ui/card'
import {joinParcelNumbers} from '@/services/rules/campaign-rules'
import type {
  CampaignLetterContextDTO,
  CampaignLetterContextResult,
  CampaignLetterProfileRefDTO,
} from '@/services/types/domain/campaign-types'

import {memberProfilePathOf} from '../member-profile/member-profile-paths'
import {dayLabelOf} from './campaign-format'
import {CampaignLetterDownload} from './campaign-letter-download'
import {CAMPAIGN_LETTERS_ANCHOR} from './campaign-paths'

type CampaignLetterCardProps = {
  campaignId: string
  result: CampaignLetterContextResult
}

const data = (chunks: ReactNode) => (
  <span className="font-mono text-[16px] tabular-nums">{chunks}</span>
)

/**
 * La carte « Courrier postal » du detail d'une campagne (s28, design s28) :
 * l'autre canal de la meme campagne. Vide, anterieure au courrier, ou prete :
 * compteur, homonymes signales, fiches sans domicile, telechargements.
 */
export function CampaignLetterCard({
  campaignId,
  result,
}: CampaignLetterCardProps) {
  const t = useTranslations('CampaignsBureau.letters')
  if (result.status === 'not_found') return null

  return (
    <Card
      id={CAMPAIGN_LETTERS_ANCHOR}
      className="scroll-mt-6 gap-4 px-4 py-6 shadow-none sm:px-6"
    >
      <h2 className="font-serif text-[24px] leading-snug font-semibold">
        {t('title')}
      </h2>
      {result.status === 'ready' ? (
        <ReadyLetters campaignId={campaignId} context={result.context} />
      ) : (
        <Alert role="status" className="bg-muted">
          <AlertDescription className="text-foreground text-[17px]">
            <p>{t(result.status)}</p>
          </AlertDescription>
        </Alert>
      )}
    </Card>
  )
}

function ReadyLetters({
  campaignId,
  context,
}: {
  campaignId: string
  context: CampaignLetterContextDTO
}) {
  const t = useTranslations('CampaignsBureau.letters')
  const counter: [string, ReactNode][] = [
    [t('counter.withoutEmail'), context.withoutEmailCount],
    [t('counter.withoutHome'), context.withoutHomeCount],
    [t('counter.date'), dayLabelOf(context.sendDate)],
  ]

  return (
    <>
      <p className="text-[17px]">{t('usage')}</p>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
        {counter.map(([term, value]) => (
          <div
            key={term}
            className="flex flex-row justify-between gap-1 sm:flex-col"
          >
            <dt className="text-muted-foreground text-[15px]">{term}</dt>
            <dd className="font-mono text-[17px] font-medium tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {context.homonymGroups.length > 0 && (
        <HomonymsAlert groups={context.homonymGroups} />
      )}
      {(context.landAddressed.length > 0 || context.nameOnly.length > 0) && (
        <WithoutHomeAlert
          landAddressed={context.landAddressed}
          nameOnly={context.nameOnly}
        />
      )}
      {context.addressTooWide.length > 0 && (
        <AddressTooWideAlert profiles={context.addressTooWide} />
      )}
      <CampaignLetterDownload
        campaignId={campaignId}
        homonymGroups={context.homonymGroups}
      />
      <p className="text-muted-foreground text-[15px]">{t('note')}</p>
    </>
  )
}

function HomonymsAlert({
  groups,
}: {
  groups: CampaignLetterContextDTO['homonymGroups']
}) {
  const t = useTranslations('CampaignsBureau.letters.homonyms')

  return (
    <Alert className="border-warning-border bg-warning text-warning-foreground [&>svg]:size-5">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle className="text-[15px] whitespace-normal">
        {t('title')}
      </AlertTitle>
      <AlertDescription className="text-foreground">
        <ul className="flex flex-col gap-3">
          {groups.map((group) => (
            <li
              key={`${group.name}|${group.homeAddress}`}
              className="border-border border-l-2 pl-3"
            >
              <p className="text-[17px] font-semibold">{group.name}</p>
              <p className="text-[17px]">{group.homeAddress}</p>
              <p className="text-muted-foreground text-[15px]">
                {t('meta', {
                  count: group.profileCount,
                  parcelCount: group.parcelNumbers.length,
                  parcels: joinParcelNumbers(group.parcelNumbers),
                })}
              </p>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

function ProfileLinks({
  profiles,
}: {
  profiles: readonly CampaignLetterProfileRefDTO[]
}) {
  const t = useTranslations('CampaignsBureau.letters.withoutHome')

  return (
    <ul className="mt-1 flex flex-col gap-1">
      {profiles.map((profile) => (
        <li key={profile.id}>
          <Link href={memberProfilePathOf(profile.id)} className="underline">
            {profile.name}
          </Link>{' '}
          {t.rich('parcels', {
            data,
            count: profile.parcelNumbers.length,
            parcels: joinParcelNumbers(profile.parcelNumbers),
          })}
        </li>
      ))}
    </ul>
  )
}

function WithoutHomeAlert({
  landAddressed,
  nameOnly,
}: {
  landAddressed: readonly CampaignLetterProfileRefDTO[]
  nameOnly: readonly CampaignLetterProfileRefDTO[]
}) {
  const t = useTranslations('CampaignsBureau.letters.withoutHome')
  const lists: [string, readonly CampaignLetterProfileRefDTO[]][] = [
    [t('land'), landAddressed],
    [t('nameOnly'), nameOnly],
  ]

  return (
    <Alert role="status" className="bg-muted">
      <AlertDescription className="text-foreground flex flex-col gap-3 text-[17px]">
        {lists
          .filter(([, profiles]) => profiles.length > 0)
          .map(([label, profiles]) => (
            <div key={label}>
              <p>{label}</p>
              <ProfileLinks profiles={profiles} />
            </div>
          ))}
        <p>{t('hint')}</p>
      </AlertDescription>
    </Alert>
  )
}

/** Les lettres dont l'adresse deborderait la fenetre (§6.1) : a corriger. */
function AddressTooWideAlert({
  profiles,
}: {
  profiles: readonly CampaignLetterProfileRefDTO[]
}) {
  const t = useTranslations('CampaignsBureau.letters.addressTooWide')

  return (
    <Alert role="status" className="bg-muted">
      <AlertDescription className="text-foreground flex flex-col gap-3 text-[17px]">
        <div>
          <p>{t('label')}</p>
          <ProfileLinks profiles={profiles} />
        </div>
        <p>{t('hint')}</p>
      </AlertDescription>
    </Alert>
  )
}
