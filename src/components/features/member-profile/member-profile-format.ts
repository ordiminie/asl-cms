import type {MemberProfileContact} from '@/services/types/domain/member-profile-types'

/**
 * L'adresse postale — le domicile (s55, ADR 058) — sur une ligne (« 8 chemin
 * des Pins, 33680 Lacanau »), ou rien quand la fiche n'en porte aucune partie.
 */
export const postalAddressLineOf = (
  contact: Pick<
    MemberProfileContact,
    'homeAddressLine' | 'homePostalCode' | 'homeCity'
  >
): string | null => {
  const locality = [contact.homePostalCode, contact.homeCity]
    .filter((part): part is string => Boolean(part))
    .join(' ')
  const line = [contact.homeAddressLine, locality]
    .filter((part): part is string => Boolean(part))
    .join(', ')

  return line || null
}
