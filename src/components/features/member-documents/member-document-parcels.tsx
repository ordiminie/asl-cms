'use client'

import {useTranslations} from 'next-intl'
import type {ReactNode} from 'react'

const DATA_CLASS = 'font-mono font-medium tabular-nums'

const mono = (chunks: ReactNode) => <span className={DATA_CLASS}>{chunks}</span>

export const PARCEL_LIST = new Intl.ListFormat('fr', {
  style: 'long',
  type: 'conjunction',
})

/**
 * Les parcelles d'une fiche, dans le vocabulaire de « Mes factures » :
 * « Parcelle 27 », « Parcelles 12 et 13 », puis le compteur s'il est connu.
 */
export function MemberDocumentParcels({
  parcelNumbers,
  meterNumber,
}: {
  parcelNumbers: readonly string[]
  meterNumber?: string | null
}) {
  const t = useTranslations('BureauMemberDocuments')
  const [single] = parcelNumbers

  return (
    <span>
      {parcelNumbers.length === 0
        ? t('landMissing')
        : parcelNumbers.length === 1
          ? t.rich('parcel', {number: single, mono})
          : t.rich('parcels', {
              numbers: PARCEL_LIST.format(parcelNumbers),
              mono,
            })}
      {meterNumber && (
        <>
          {' · '}
          {t.rich('meter', {number: meterNumber, mono})}
        </>
      )}
    </span>
  )
}
