import unpaidReminderServiceInterceptor from './interceptors/unpaid-reminder-service-logger-interceptor'

/**
 * `runUnpaidRemindersJobService` n'est **pas** expose : la relance n'est
 * lancee que par le planificateur (ADR 070 §4), dont la facade compose les
 * gestionnaires.
 */
export const scheduleUnpaidRemindersService =
  unpaidReminderServiceInterceptor.scheduleUnpaidRemindersService
export const getUnpaidRemindersOverviewService =
  unpaidReminderServiceInterceptor.getUnpaidRemindersOverviewService
