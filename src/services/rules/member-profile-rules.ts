import {MemberProfileFieldsDTO} from '../types/domain/member-profile-types'
import {isIncomplete} from './parcel-ownership-rules'

/**
 * La fiche telle que la presentation la lit : les colonnes de la ligne, plus
 * « incomplete », calculee a la lecture (decision G) et jamais stockee.
 */
export const toMemberProfileDto = (
  row: Omit<MemberProfileFieldsDTO, 'incomplete'>
): MemberProfileFieldsDTO => ({
  id: row.id,
  organizationId: row.organizationId,
  name: row.name,
  email: row.email,
  phone: row.phone,
  homeAddressLine: row.homeAddressLine,
  homeAddressComplement: row.homeAddressComplement,
  homePostalCode: row.homePostalCode,
  homeCity: row.homeCity,
  landAddressLine: row.landAddressLine,
  landAddressComplement: row.landAddressComplement,
  landPostalCode: row.landPostalCode,
  landCity: row.landCity,
  companyName: row.companyName,
  mailOnly: row.mailOnly,
  incomplete: isIncomplete(row),
})
