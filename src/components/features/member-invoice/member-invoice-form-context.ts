import {
  getInvoiceStatusClassification,
  getInvoiceSubjectTemplate,
  selectableInvoiceStatuses,
} from '@/services/rules/member-invoice-rules'
import type {ResolvedAssociationSettings} from '@/services/types/domain/association-settings-types'
import type {MemberParcelsDTO} from '@/services/types/domain/parcel-ownership-types'

import type {MemberInvoiceParcelOption} from './member-invoice-form'

/**
 * Ce que l'ecran de saisie lit des reglages (s19, ADR 059 §6 et §8) : le
 * modele d'objet et les statuts proposes, l'union des deux listes.
 */
export const invoiceFormSettingsOf = (
  settings: ResolvedAssociationSettings
): {statuses: string[]; subjectTemplate: string} => ({
  statuses: selectableInvoiceStatuses(getInvoiceStatusClassification(settings)),
  subjectTemplate: getInvoiceSubjectTemplate(settings),
})

/** Les parcelles de la fiche, actuelles et anciennes, avec leur periode. */
export const invoiceParcelOptionsOf = (
  parcels: MemberParcelsDTO
): MemberInvoiceParcelOption[] => [
  ...parcels.current.map(({parcelId, number, startsOn}) => ({
    parcelId,
    number,
    startsOn,
    endsOn: null,
  })),
  ...parcels.former.map(({parcelId, number, startsOn, endsOn}) => ({
    parcelId,
    number,
    startsOn,
    endsOn,
  })),
]
