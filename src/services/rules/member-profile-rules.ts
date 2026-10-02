import {MemberProfileDTO} from '../types/domain/member-profile-types'
import {isIncomplete} from './parcel-ownership-rules'

/**
 * La fiche telle que la presentation la lit : les colonnes de la ligne, plus
 * « incomplete », calculee a la lecture (decision G) et jamais stockee.
 */
export const toMemberProfileDto = (
  row: Omit<MemberProfileDTO, 'incomplete'>
): MemberProfileDTO => ({
  id: row.id,
  organizationId: row.organizationId,
  name: row.name,
  email: row.email,
  phone: row.phone,
  addressLine: row.addressLine,
  addressComplement: row.addressComplement,
  postalCode: row.postalCode,
  city: row.city,
  mailOnly: row.mailOnly,
  incomplete: isIncomplete(row),
})
