import {Img} from 'react-email'

import type {AccentHue} from '@/services/types/domain/association-settings-types'

import {EMAIL_FONTS} from './theme'

/** L'association telle qu'un email transactionnel la montre. */
export type EmailAssociation = {
  name: string
  /** URL absolue d'un logo PNG ; absente, le nom seul (s03, manque n° 2). */
  logoUrl?: string
  hue: AccentHue
}

const LOGO_SIZE = 36

/**
 * En-tete d'un email transactionnel (design system §5) : logo PNG de 36 px
 * suivi du nom, ou le nom seul. Partage par le lien de connexion et
 * l'invitation (s42a), pour ne pas en tenir une copie par gabarit.
 */
export function AssociationHeader({
  association,
  color,
}: {
  association: EmailAssociation
  color: string
}) {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0}>
      <tbody>
        <tr>
          {association.logoUrl && (
            <td style={{paddingRight: '12px', verticalAlign: 'middle'}}>
              <Img
                src={association.logoUrl}
                alt={association.name}
                width={LOGO_SIZE}
                height={LOGO_SIZE}
                style={{display: 'block'}}
              />
            </td>
          )}
          <td
            style={{
              verticalAlign: 'middle',
              fontFamily: EMAIL_FONTS.heading,
              fontSize: '20px',
              fontWeight: 600,
              color,
            }}
          >
            {association.name}
          </td>
        </tr>
      </tbody>
    </table>
  )
}
