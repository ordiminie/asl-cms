import type {MemberProfileContact} from '@/services/types/domain/member-profile-types'

/**
 * L'adresse postale sur une ligne (« 8 chemin des Pins, 33680 Lacanau »), ou
 * rien quand la fiche n'en porte aucune partie.
 */
export const postalAddressLineOf = (
  contact: Pick<MemberProfileContact, 'addressLine' | 'postalCode' | 'city'>
): string | null => {
  const locality = [contact.postalCode, contact.city]
    .filter((part): part is string => Boolean(part))
    .join(' ')
  const line = [contact.addressLine, locality]
    .filter((part): part is string => Boolean(part))
    .join(', ')

  return line || null
}
