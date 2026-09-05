// Types spécifiques aux paiements en plusieurs fois
export enum InstallmentType {
  FULL_PAYMENT = 'full_payment',
  TWO_INSTALLMENTS = 'two_installments',
  THREE_INSTALLMENTS = 'three_installments',
  FOUR_INSTALLMENTS = 'four_installments',
}

export type InstallmentPlan = {
  type: InstallmentType
  numberOfPayments: number
  interval: 'month' | 'week'
  description: string
}

export const InstallmentPlans: Record<InstallmentType, InstallmentPlan> = {
  [InstallmentType.FULL_PAYMENT]: {
    type: InstallmentType.FULL_PAYMENT,
    numberOfPayments: 1,
    interval: 'month',
    description: 'Paiement unique',
  },
  [InstallmentType.TWO_INSTALLMENTS]: {
    type: InstallmentType.TWO_INSTALLMENTS,
    numberOfPayments: 2,
    interval: 'month',
    description: 'Paiement en 2 fois',
  },
  [InstallmentType.THREE_INSTALLMENTS]: {
    type: InstallmentType.THREE_INSTALLMENTS,
    numberOfPayments: 3,
    interval: 'month',
    description: 'Paiement en 3 fois',
  },
  [InstallmentType.FOUR_INSTALLMENTS]: {
    type: InstallmentType.FOUR_INSTALLMENTS,
    numberOfPayments: 4,
    interval: 'month',
    description: 'Paiement en 4 fois',
  },
}

export function calculateInstallmentAmount(
  totalAmount: number,
  numberOfPayments: number
): {installmentAmount: number; lastPaymentAmount: number} {
  const installmentAmount = Math.floor(totalAmount / numberOfPayments)
  const lastPaymentAmount =
    totalAmount - installmentAmount * (numberOfPayments - 1)

  return {
    installmentAmount,
    lastPaymentAmount,
  }
}
