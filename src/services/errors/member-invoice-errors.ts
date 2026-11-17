import {AuthorizationError} from './authorization-error'

/**
 * Une facture venue de Pennylane ne se corrige pas sur le site (s19, ADR 059
 * §7, critere 9) : refus porte par le service, quel que soit l'appelant. Une
 * `AuthorizationError` : l'action la distingue pour dire « corrigez-la dans
 * Pennylane ».
 */
export class ReadOnlyInvoiceError extends AuthorizationError {
  constructor() {
    super('Cette facture vient de Pennylane : elle ne se corrige que là-bas')
    this.name = 'ReadOnlyInvoiceError'
  }
}
